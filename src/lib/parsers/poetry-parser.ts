import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parse } from 'smol-toml';
import type { Dependency } from '../../types.js';
import { normalizePypiName } from './uv-parser.js';

/**
 * Parser for poetry.lock (Poetry 1.x and 2.x).
 *
 * poetry.lock lists the full resolved graph but not which packages are
 * direct, so pyproject.toml is required alongside it (every Poetry project
 * has one). Dev classification uses, in order of preference: the project's
 * own dependency groups from pyproject.toml for direct deps, then the
 * lockfile's per-package `groups` (Poetry 2.x) or `category` (1.x) markers
 * for transitive deps.
 */

const PEP508_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*/;

interface PoetryLockPackage {
  name?: string;
  version?: string;
  /** Poetry 2.x (lock-version 2.1): e.g. ["main"], ["dev"], ["main", "dev"]. */
  groups?: string[];
  /** Poetry 1.x: "main" | "dev". */
  category?: string;
}

interface PoetryLockfile {
  package?: PoetryLockPackage[];
}

interface PyprojectToml {
  project?: {
    dependencies?: string[];
    'optional-dependencies'?: Record<string, string[]>;
  };
  'dependency-groups'?: Record<string, unknown[]>;
  tool?: {
    poetry?: {
      dependencies?: Record<string, unknown>;
      'dev-dependencies'?: Record<string, unknown>;
      group?: Record<string, { dependencies?: Record<string, unknown> }>;
    };
  };
}

export async function parsePoetryLockfile(cwd: string): Promise<Dependency[]> {
  const lockfilePath = join(cwd, 'poetry.lock');

  let raw: string;
  try {
    raw = await readFile(lockfilePath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error('No poetry.lock found.');
    }
    throw error;
  }

  let pyprojectRaw: string;
  try {
    pyprojectRaw = await readFile(join(cwd, 'pyproject.toml'), 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(
        `Found poetry.lock but no pyproject.toml in ${cwd}. Run graveyard-check from your project root.`,
      );
    }
    throw error;
  }

  let lockfile: PoetryLockfile;
  try {
    lockfile = parse(raw) as PoetryLockfile;
  } catch (error) {
    throw new Error(`Could not parse poetry.lock: ${(error as Error).message}`);
  }

  let pyproject: PyprojectToml;
  try {
    pyproject = parse(pyprojectRaw) as PyprojectToml;
  } catch (error) {
    throw new Error(`Could not parse pyproject.toml: ${(error as Error).message}`);
  }

  const { directNames, directDevNames } = collectDirectDependencies(pyproject);

  const dependencies: Dependency[] = [];
  const seen = new Set<string>();

  for (const pkg of lockfile.package ?? []) {
    if (!pkg.name || !pkg.version) {
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
      isDev: isDirectProd ? false : isDirectDev || isDevOnlyInLockfile(pkg),
      ecosystem: 'pypi',
    });
  }

  return dependencies.sort((a, b) => a.name.localeCompare(b.name));
}

/** A lockfile package that belongs to no prod group is dev-only. */
function isDevOnlyInLockfile(pkg: PoetryLockPackage): boolean {
  if (Array.isArray(pkg.groups)) {
    return pkg.groups.length > 0 && !pkg.groups.includes('main');
  }
  return pkg.category === 'dev';
}

function collectDirectDependencies(pyproject: PyprojectToml): {
  directNames: Set<string>;
  directDevNames: Set<string>;
} {
  const directNames = new Set<string>();
  const directDevNames = new Set<string>();

  collectPoetrySections(pyproject, directNames, directDevNames);
  collectPep621Sections(pyproject, directNames, directDevNames);

  return { directNames, directDevNames };
}

function collectPoetrySections(
  pyproject: PyprojectToml,
  directNames: Set<string>,
  directDevNames: Set<string>,
): void {
  const poetry = pyproject.tool?.poetry;

  for (const name of Object.keys(poetry?.dependencies ?? {})) {
    if (name.toLowerCase() !== 'python') {
      directNames.add(normalizePypiName(name));
    }
  }

  for (const name of Object.keys(poetry?.['dev-dependencies'] ?? {})) {
    directDevNames.add(normalizePypiName(name));
  }

  for (const [groupName, group] of Object.entries(poetry?.group ?? {})) {
    const target = groupName === 'main' ? directNames : directDevNames;
    for (const name of Object.keys(group.dependencies ?? {})) {
      target.add(normalizePypiName(name));
    }
  }
}

function collectPep621Sections(
  pyproject: PyprojectToml,
  directNames: Set<string>,
  directDevNames: Set<string>,
): void {
  for (const spec of pyproject.project?.dependencies ?? []) {
    addPep508Name(directNames, spec);
  }

  for (const specs of Object.values(pyproject.project?.['optional-dependencies'] ?? {})) {
    for (const spec of specs) {
      addPep508Name(directNames, spec);
    }
  }

  // PEP 735 dependency groups are dev-style by definition.
  for (const specs of Object.values(pyproject['dependency-groups'] ?? {})) {
    for (const spec of specs) {
      if (typeof spec === 'string') {
        addPep508Name(directDevNames, spec);
      }
    }
  }
}

function addPep508Name(target: Set<string>, specifier: string): void {
  const name = PEP508_NAME_PATTERN.exec(specifier.trim())?.[0];
  if (name) {
    target.add(normalizePypiName(name));
  }
}
