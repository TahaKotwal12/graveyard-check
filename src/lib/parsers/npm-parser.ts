import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Dependency } from '../../types.js';

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

interface LockfilePackageEntry {
  version?: string;
  dev?: boolean;
}

interface PackageLockV2V3 {
  packages?: Record<string, LockfilePackageEntry>;
}

/**
 * Extract the npm package name from a lockfile v2/v3 `packages` path key.
 * Examples: `node_modules/lodash` → `lodash`, `node_modules/@scope/pkg` → `@scope/pkg`.
 */
export function packageNameFromLockfilePath(lockfilePath: string): string | null {
  if (!lockfilePath) {
    return null;
  }

  const nodeModulesIndex = lockfilePath.lastIndexOf('node_modules/');
  if (nodeModulesIndex === -1) {
    return null;
  }

  const remainder = lockfilePath.slice(nodeModulesIndex + 'node_modules/'.length);
  if (!remainder) {
    return null;
  }

  if (remainder.startsWith('@')) {
    const slashIndex = remainder.indexOf('/', 1);
    if (slashIndex === -1) {
      return null;
    }
    return remainder.slice(
      0,
      slashIndex + 1 + remainder.slice(slashIndex + 1).split('/')[0].length,
    );
  }

  return remainder.split('/')[0];
}

export async function parseNpmLockfile(cwd: string): Promise<Dependency[]> {
  const lockfilePath = join(cwd, 'package-lock.json');

  let lockfileRaw: string;
  try {
    lockfileRaw = await readFile(lockfilePath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error('No package-lock.json found.');
    }
    throw error;
  }

  const packageJsonPath = join(cwd, 'package.json');
  let packageJsonRaw: string;
  try {
    packageJsonRaw = await readFile(packageJsonPath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(
        `Found package-lock.json but no package.json in ${cwd}. Run graveyard-check from your project root.`,
      );
    }
    throw error;
  }
  const packageJson = JSON.parse(packageJsonRaw) as PackageJson;

  const directDependencies = new Set(Object.keys(packageJson.dependencies ?? {}));
  const directDevDependencies = new Set(Object.keys(packageJson.devDependencies ?? {}));

  const lockfile = JSON.parse(lockfileRaw) as PackageLockV2V3;
  if (!lockfile.packages) {
    throw new Error(
      'Unsupported package-lock.json format: expected lockfile v2/v3 with a "packages" key. ' +
        'Regenerate it with `npm install --package-lock-only` using npm 7 or newer.',
    );
  }

  const aggregated = new Map<string, { version: string; devFlags: boolean[] }>();

  for (const [path, entry] of Object.entries(lockfile.packages)) {
    const name = packageNameFromLockfilePath(path);
    if (!name || !entry.version) {
      continue;
    }

    const isDevEntry = entry.dev === true;
    const existing = aggregated.get(name);

    if (existing) {
      existing.devFlags.push(isDevEntry);
      continue;
    }

    aggregated.set(name, {
      version: entry.version,
      devFlags: [isDevEntry],
    });
  }

  const dependencies: Dependency[] = [];

  for (const [name, { version, devFlags }] of aggregated) {
    const isDirect = directDependencies.has(name) || directDevDependencies.has(name);
    const isDev = resolveIsDev(name, directDependencies, directDevDependencies, devFlags);

    dependencies.push({
      name,
      currentVersion: version,
      isDirect,
      isDev,
      ecosystem: 'npm',
    });
  }

  return dependencies.sort((a, b) => a.name.localeCompare(b.name));
}

function resolveIsDev(
  name: string,
  directDependencies: Set<string>,
  directDevDependencies: Set<string>,
  devFlags: boolean[],
): boolean {
  if (directDevDependencies.has(name)) {
    return true;
  }

  if (directDependencies.has(name)) {
    return false;
  }

  return devFlags.length > 0 && devFlags.every(Boolean);
}
