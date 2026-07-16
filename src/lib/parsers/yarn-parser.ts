import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parse } from 'yaml';
import type { Dependency } from '../../types.js';

/**
 * Parser for yarn.lock — both classic (v1, custom text format) and Berry
 * (v2+, YAML with an `__metadata` block).
 *
 * Neither yarn lockfile format records which packages are dev-only, so dev
 * classification comes from package.json: direct deps are classified exactly,
 * transitive deps are reported as non-dev (unknowable from the lockfile alone).
 */

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

interface BerryEntry {
  version?: string | number;
}

/** Extract the package name from a lockfile selector like `@scope/pkg@npm:^1.0.0` or `debug@^4.0.0`. */
export function packageNameFromYarnSelector(rawSelector: string): string | null {
  const selector = rawSelector.trim().replace(/^"|"$/g, '');
  if (!selector) {
    return null;
  }

  const atIndex = selector.lastIndexOf('@');
  if (atIndex <= 0) {
    return null;
  }

  const name = selector.slice(0, atIndex);
  return name || null;
}

export async function parseYarnLockfile(cwd: string): Promise<Dependency[]> {
  const lockfilePath = join(cwd, 'yarn.lock');

  let raw: string;
  try {
    raw = await readFile(lockfilePath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error('No yarn.lock found.');
    }
    throw error;
  }

  let packageJsonRaw: string;
  try {
    packageJsonRaw = await readFile(join(cwd, 'package.json'), 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(
        `Found yarn.lock but no package.json in ${cwd}. Run graveyard-check from your project root.`,
      );
    }
    throw error;
  }
  const packageJson = JSON.parse(packageJsonRaw) as PackageJson;

  const resolved = raw.includes('__metadata:')
    ? parseBerryLockfile(raw)
    : parseClassicLockfile(raw);

  const directDependencies = new Set(Object.keys(packageJson.dependencies ?? {}));
  const directDevDependencies = new Set(Object.keys(packageJson.devDependencies ?? {}));

  const dependencies: Dependency[] = [];
  for (const [name, currentVersion] of resolved) {
    dependencies.push({
      name,
      currentVersion,
      isDirect: directDependencies.has(name) || directDevDependencies.has(name),
      isDev: directDevDependencies.has(name),
      ecosystem: 'npm',
    });
  }

  return dependencies.sort((a, b) => a.name.localeCompare(b.name));
}

/** Berry lockfiles are YAML: `"debug@npm:^4.3.0":` blocks with a `version` field. */
function parseBerryLockfile(raw: string): Map<string, string> {
  const parsed = parse(raw) as Record<string, BerryEntry> | null;
  const resolved = new Map<string, string>();
  if (!parsed) {
    return resolved;
  }

  for (const [key, entry] of Object.entries(parsed)) {
    if (key === '__metadata' || entry?.version === undefined) {
      continue;
    }

    // Workspace-local packages aren't registry dependencies.
    if (key.includes('@workspace:')) {
      continue;
    }

    const firstSelector = key.split(',')[0].trim();
    const name = packageNameFromYarnSelector(stripBerryProtocol(firstSelector));
    if (name && !resolved.has(name)) {
      resolved.set(name, String(entry.version));
    }
  }

  return resolved;
}

/** Reduce `name@npm:^1.0.0` to `name@^1.0.0` so selector parsing is shared with classic. */
function stripBerryProtocol(selector: string): string {
  return selector.replace(/@(npm|patch|portal|link|file|exec|git|github|https?):/, '@');
}

/**
 * Classic yarn.lock blocks look like:
 *
 *   "debug@^4.0.0", "debug@^4.3.0":
 *     version "4.3.7"
 */
function parseClassicLockfile(raw: string): Map<string, string> {
  const resolved = new Map<string, string>();
  let currentName: string | null = null;

  for (const line of raw.split('\n')) {
    if (!line.trim() || line.trimStart().startsWith('#')) {
      continue;
    }

    // Unindented lines ending in `:` start a new entry block.
    if (!line.startsWith(' ') && line.trimEnd().endsWith(':')) {
      const selectors = line.trimEnd().slice(0, -1);
      currentName = packageNameFromYarnSelector(selectors.split(',')[0]);
      continue;
    }

    if (currentName && line.startsWith('  version')) {
      const versionMatch = /^\s*version\s+"?([^"\s]+)"?\s*$/.exec(line);
      if (versionMatch && !resolved.has(currentName)) {
        resolved.set(currentName, versionMatch[1]);
      }
      currentName = null;
    }
  }

  return resolved;
}
