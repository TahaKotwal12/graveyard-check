import { access } from 'node:fs/promises';
import { join } from 'node:path';
import type { Dependency } from '../types.js';
import { parseNpmLockfile } from './parsers/npm-parser.js';
import { parsePnpmLockfile } from './parsers/pnpm-parser.js';
import { parseRequirementsTxt } from './parsers/python-parser.js';
import { parseYarnLockfile } from './parsers/yarn-parser.js';

export const NO_LOCKFILE_ERROR =
  'No supported dependency file found. Expected package-lock.json, pnpm-lock.yaml, yarn.lock, or requirements.txt.';

export type DetectedEcosystem = 'npm' | 'pypi' | 'unknown';

export { packageNameFromLockfilePath } from './parsers/npm-parser.js';
export { parsePnpmPackageKey } from './parsers/pnpm-parser.js';
export { packageNameFromYarnSelector } from './parsers/yarn-parser.js';

/** JS lockfiles in detection priority order — all resolve against the npm registry. */
const NPM_LOCKFILES = ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock'] as const;

export async function detectEcosystem(cwd: string): Promise<DetectedEcosystem> {
  for (const filename of NPM_LOCKFILES) {
    if (await fileExists(join(cwd, filename))) {
      return 'npm';
    }
  }

  for (const filename of ['requirements.txt', 'poetry.lock', 'Pipfile.lock']) {
    if (await fileExists(join(cwd, filename))) {
      return 'pypi';
    }
  }

  return 'unknown';
}

export async function parseLockfile(
  cwd: string,
  requestedEcosystem?: Exclude<DetectedEcosystem, 'unknown'>,
): Promise<Dependency[]> {
  const ecosystem = requestedEcosystem ?? (await detectEcosystem(cwd));

  if (ecosystem === 'npm') {
    if (await fileExists(join(cwd, 'package-lock.json'))) {
      return parseNpmLockfile(cwd);
    }

    if (await fileExists(join(cwd, 'pnpm-lock.yaml'))) {
      return parsePnpmLockfile(cwd);
    }

    if (await fileExists(join(cwd, 'yarn.lock'))) {
      return parseYarnLockfile(cwd);
    }

    throw new Error(
      `No package-lock.json, pnpm-lock.yaml, or yarn.lock found for requested npm ecosystem in ${cwd}.`,
    );
  }

  if (ecosystem === 'pypi') {
    if (await fileExists(join(cwd, 'requirements.txt'))) {
      return parseRequirementsTxt(cwd);
    }

    if (await fileExists(join(cwd, 'poetry.lock'))) {
      throw unsupportedPythonLockfileError('poetry.lock');
    }

    if (await fileExists(join(cwd, 'Pipfile.lock'))) {
      throw unsupportedPythonLockfileError('Pipfile.lock');
    }

    throw new Error(`No requirements.txt found for requested PyPI ecosystem in ${cwd}.`);
  }

  throw new Error(NO_LOCKFILE_ERROR);
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

function unsupportedPythonLockfileError(filename: 'poetry.lock' | 'Pipfile.lock'): Error {
  return new Error(
    `Detected ${filename}, but parsing isn't implemented yet. ` +
      'See https://github.com/TahaKotwal12/graveyard-check/issues for Python lockfile support.',
  );
}
