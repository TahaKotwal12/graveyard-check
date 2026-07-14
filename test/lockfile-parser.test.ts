import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  detectEcosystem,
  NO_LOCKFILE_ERROR,
  packageNameFromLockfilePath,
  parseLockfile,
} from '../src/lib/lockfile-parser.js';

const fixturesDir = fileURLToPath(new URL('./fixtures/npm-project', import.meta.url));
const pythonFixturesDir = fileURLToPath(new URL('./fixtures/python-project', import.meta.url));

describe('packageNameFromLockfilePath', () => {
  it('parses unscoped and scoped package paths', () => {
    expect(packageNameFromLockfilePath('node_modules/lodash')).toBe('lodash');
    expect(packageNameFromLockfilePath('node_modules/@babel/core')).toBe('@babel/core');
    expect(packageNameFromLockfilePath('node_modules/debug/node_modules/ms')).toBe('ms');
    expect(packageNameFromLockfilePath('node_modules/@babel/core/node_modules/@babel/code-frame')).toBe(
      '@babel/code-frame',
    );
  });

  it('returns null for the lockfile root entry', () => {
    expect(packageNameFromLockfilePath('')).toBeNull();
  });
});

describe('parseLockfile', () => {
  it('parses direct, dev, transitive, and overlapping dependencies from package-lock.json', async () => {
    const dependencies = await parseLockfile(fixturesDir);

    expect(dependencies).toEqual([
      {
        name: 'ansi-styles',
        currentVersion: '4.3.0',
        isDirect: false,
        isDev: true,
        ecosystem: 'npm',
      },
      {
        name: 'debug',
        currentVersion: '4.3.7',
        isDirect: true,
        isDev: false,
        ecosystem: 'npm',
      },
      {
        name: 'ms',
        currentVersion: '2.1.3',
        isDirect: true,
        isDev: false,
        ecosystem: 'npm',
      },
      {
        name: 'prettier',
        currentVersion: '3.3.3',
        isDirect: true,
        isDev: true,
        ecosystem: 'npm',
      },
      {
        name: 'supports-color',
        currentVersion: '7.2.0',
        isDirect: false,
        isDev: false,
        ecosystem: 'npm',
      },
    ]);
  });

  it('detects and parses requirements.txt projects', async () => {
    expect(await detectEcosystem(pythonFixturesDir)).toBe('pypi');

    const dependencies = await parseLockfile(pythonFixturesDir);
    expect(dependencies).toContainEqual(
      expect.objectContaining({ name: 'requests', ecosystem: 'pypi' }),
    );
  });

  it('prefers package-lock.json when multiple ecosystem files exist', async () => {
    const mixedDir = await mkdtemp(join(tmpdir(), 'graveyard-check-mixed-ecosystem-'));

    try {
      await writeFile(join(mixedDir, 'package-lock.json'), '{}');
      await writeFile(join(mixedDir, 'requirements.txt'), 'requests==2.31.0');
      expect(await detectEcosystem(mixedDir)).toBe('npm');
    } finally {
      await rm(mixedDir, { recursive: true, force: true });
    }
  });

  it('throws a clear error when package-lock.json is missing', async () => {
    const emptyDir = await mkdtemp(join(tmpdir(), 'graveyard-check-lockfile-'));

    try {
      await expect(parseLockfile(emptyDir)).rejects.toThrow(NO_LOCKFILE_ERROR);
    } finally {
      await rm(emptyDir, { recursive: true, force: true });
    }
  });

  it('rejects legacy lockfiles without a packages key', async () => {
    const legacyDir = await mkdtemp(join(tmpdir(), 'graveyard-check-legacy-lockfile-'));

    try {
      await writeFile(
        join(legacyDir, 'package.json'),
        JSON.stringify({ name: 'legacy-app', version: '1.0.0' }),
      );
      await writeFile(
        join(legacyDir, 'package-lock.json'),
        JSON.stringify({
          name: 'legacy-app',
          version: '1.0.0',
          lockfileVersion: 1,
          dependencies: {
            lodash: {
              version: '4.17.21',
            },
          },
        }),
      );

      await expect(parseLockfile(legacyDir)).rejects.toThrow(
        'Unsupported package-lock.json format: expected lockfile v2/v3 with a "packages" key.',
      );
    } finally {
      await rm(legacyDir, { recursive: true, force: true });
    }
  });

  it.each(['poetry.lock', 'Pipfile.lock'] as const)(
    'reports detected but unsupported Python lockfile %s',
    async (filename) => {
      const pythonDir = await mkdtemp(join(tmpdir(), 'graveyard-check-python-lockfile-'));

      try {
        await writeFile(join(pythonDir, filename), '');
        await expect(parseLockfile(pythonDir)).rejects.toThrow(
          `Detected ${filename}, but parsing isn't implemented yet.`,
        );
      } finally {
        await rm(pythonDir, { recursive: true, force: true });
      }
    },
  );
});
