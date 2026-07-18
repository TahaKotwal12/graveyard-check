import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parse } from 'smol-toml';
import type { Dependency } from '../../types.js';

/**
 * Parser for uv.lock (uv's cross-platform lockfile, TOML).
 *
 * The lockfile is self-contained: workspace roots appear as packages with a
 * `virtual` or `editable` source, and their `dependencies` /
 * `dev-dependencies` sections give the direct graph — no pyproject.toml read
 * is needed. Transitive dev classification is not recorded by uv, so only
 * direct dev-group dependencies are reported as dev.
 */

interface UvDependencyRef {
  name?: string;
}

interface UvPackage {
  name?: string;
  version?: string;
  source?: {
    registry?: string;
    virtual?: string;
    editable?: string;
  };
  dependencies?: UvDependencyRef[];
  'dev-dependencies'?: Record<string, UvDependencyRef[]>;
}

interface UvLockfile {
  version?: number;
  package?: UvPackage[];
}

/** PEP 503 normalization so lockfile and pyproject spellings always match. */
export function normalizePypiName(name: string): string {
  return name.toLowerCase().replace(/[-_.]+/g, '-');
}

export async function parseUvLockfile(cwd: string): Promise<Dependency[]> {
  const lockfilePath = join(cwd, 'uv.lock');

  let raw: string;
  try {
    raw = await readFile(lockfilePath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error('No uv.lock found.');
    }
    throw error;
  }

  let lockfile: UvLockfile;
  try {
    lockfile = parse(raw) as UvLockfile;
  } catch (error) {
    throw new Error(`Could not parse uv.lock: ${(error as Error).message}`);
  }

  const packages = lockfile.package ?? [];
  const roots = packages.filter(isWorkspaceRoot);
  const { directNames, directDevNames } = collectDirectSets(roots);

  const dependencies: Dependency[] = [];
  const seen = new Set<string>();

  for (const pkg of packages) {
    if (!pkg.name || !pkg.version || isWorkspaceRoot(pkg)) {
      continue;
    }

    const normalized = normalizePypiName(pkg.name);
    if (seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);

    const isDirectProd = directNames.has(normalized);
    const isDirectDev = directDevNames.has(normalized);

    dependencies.push({
      name: pkg.name,
      currentVersion: pkg.version,
      isDirect: isDirectProd || isDirectDev,
      // A package used by both prod and dev groups counts as prod.
      isDev: isDirectDev && !isDirectProd,
      ecosystem: 'pypi',
    });
  }

  return dependencies.sort((a, b) => a.name.localeCompare(b.name));
}

function collectDirectSets(roots: UvPackage[]): {
  directNames: Set<string>;
  directDevNames: Set<string>;
} {
  const directNames = new Set<string>();
  const directDevNames = new Set<string>();

  for (const root of roots) {
    addRefNames(directNames, root.dependencies ?? []);
    for (const group of Object.values(root['dev-dependencies'] ?? {})) {
      addRefNames(directDevNames, group);
    }
  }

  return { directNames, directDevNames };
}

function addRefNames(target: Set<string>, refs: UvDependencyRef[]): void {
  for (const ref of refs) {
    if (ref.name) {
      target.add(normalizePypiName(ref.name));
    }
  }
}

function isWorkspaceRoot(pkg: UvPackage): boolean {
  return pkg.source?.virtual !== undefined || pkg.source?.editable !== undefined;
}
