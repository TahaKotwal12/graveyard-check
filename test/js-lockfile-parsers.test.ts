import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  detectEcosystem,
  packageNameFromYarnSelector,
  parseLockfile,
  parsePnpmPackageKey,
} from '../src/lib/lockfile-parser.js';

const pnpmFixturesDir = fileURLToPath(new URL('./fixtures/pnpm-project', import.meta.url));
const yarnClassicFixturesDir = fileURLToPath(
  new URL('./fixtures/yarn-classic-project', import.meta.url),
);
const yarnBerryFixturesDir = fileURLToPath(
  new URL('./fixtures/yarn-berry-project', import.meta.url),
);

describe('parsePnpmPackageKey', () => {
  it('parses v9 keys with and without peer suffixes', () => {
    expect(parsePnpmPackageKey('debug@4.3.7')).toEqual({ name: 'debug', version: '4.3.7' });
    expect(parsePnpmPackageKey('debug@4.3.7(supports-color@8.1.1)')).toEqual({
      name: 'debug',
      version: '4.3.7',
    });
    expect(parsePnpmPackageKey('@babel/code-frame@7.24.7')).toEqual({
      name: '@babel/code-frame',
      version: '7.24.7',
    });
  });

  it('parses v6 keys with a leading slash', () => {
    expect(parsePnpmPackageKey('/debug@4.3.7(supports-color@8.1.1)')).toEqual({
      name: 'debug',
      version: '4.3.7',
    });
    expect(parsePnpmPackageKey('/@babel/core@7.24.0')).toEqual({
      name: '@babel/core',
      version: '7.24.0',
    });
  });

  it('returns null for malformed keys', () => {
    expect(parsePnpmPackageKey('')).toBeNull();
    expect(parsePnpmPackageKey('no-version')).toBeNull();
  });
});

describe('packageNameFromYarnSelector', () => {
  it('parses scoped and unscoped selectors', () => {
    expect(packageNameFromYarnSelector('debug@^4.0.0')).toBe('debug');
    expect(packageNameFromYarnSelector('"@babel/code-frame@^7.0.0"')).toBe('@babel/code-frame');
    expect(packageNameFromYarnSelector('')).toBeNull();
  });
});

describe('parseLockfile with pnpm-lock.yaml', () => {
  it('parses direct, dev, transitive, scoped, and peer-suffixed dependencies', async () => {
    expect(await detectEcosystem(pnpmFixturesDir)).toBe('npm');

    const dependencies = await parseLockfile(pnpmFixturesDir);
    expect(dependencies).toEqual([
      {
        name: '@babel/code-frame',
        currentVersion: '7.24.7',
        isDirect: true,
        isDev: false,
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
        isDirect: false,
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
        currentVersion: '8.1.1',
        isDirect: false,
        isDev: false,
        ecosystem: 'npm',
      },
    ]);
  });

  it('rejects pre-v6 lockfile formats with a clear error', async () => {
    const oldDir = await mkdtemp(join(tmpdir(), 'graveyard-check-pnpm-old-'));

    try {
      await writeFile(
        join(oldDir, 'pnpm-lock.yaml'),
        'lockfileVersion: 5.4\npackages:\n  /debug/4.3.7:\n    resolution: {integrity: sha512-x}\n',
      );
      await expect(parseLockfile(oldDir)).rejects.toThrow('Unsupported pnpm-lock.yaml version');
    } finally {
      await rm(oldDir, { recursive: true, force: true });
    }
  });
});

describe('parseLockfile with yarn.lock', () => {
  it('parses classic v1 lockfiles using package.json for direct/dev classification', async () => {
    expect(await detectEcosystem(yarnClassicFixturesDir)).toBe('npm');

    const dependencies = await parseLockfile(yarnClassicFixturesDir);
    expect(dependencies).toEqual([
      {
        name: '@babel/code-frame',
        currentVersion: '7.24.7',
        isDirect: true,
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
        isDirect: false,
        isDev: false,
        ecosystem: 'npm',
      },
    ]);
  });

  it('parses Berry lockfiles and skips workspace-local entries', async () => {
    const dependencies = await parseLockfile(yarnBerryFixturesDir);
    expect(dependencies).toEqual([
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
        isDirect: false,
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
    ]);
  });

  it('requires package.json next to yarn.lock', async () => {
    const bareDir = await mkdtemp(join(tmpdir(), 'graveyard-check-yarn-bare-'));

    try {
      await writeFile(join(bareDir, 'yarn.lock'), '# yarn lockfile v1\n');
      await expect(parseLockfile(bareDir)).rejects.toThrow('Found yarn.lock but no package.json');
    } finally {
      await rm(bareDir, { recursive: true, force: true });
    }
  });
});

describe('JS lockfile detection priority', () => {
  it('prefers package-lock.json over pnpm-lock.yaml and yarn.lock, and pnpm over yarn', async () => {
    const mixedDir = await mkdtemp(join(tmpdir(), 'graveyard-check-js-mixed-'));

    try {
      await writeFile(join(mixedDir, 'yarn.lock'), '# yarn lockfile v1\n');
      expect(await detectEcosystem(mixedDir)).toBe('npm');

      await writeFile(join(mixedDir, 'pnpm-lock.yaml'), "lockfileVersion: '9.0'\n");
      await writeFile(join(mixedDir, 'package-lock.json'), '{}');
      expect(await detectEcosystem(mixedDir)).toBe('npm');
    } finally {
      await rm(mixedDir, { recursive: true, force: true });
    }
  });

  it('takes pnpm-lock.yaml over requirements.txt', async () => {
    const mixedDir = await mkdtemp(join(tmpdir(), 'graveyard-check-pnpm-py-mixed-'));

    try {
      await writeFile(join(mixedDir, 'pnpm-lock.yaml'), "lockfileVersion: '9.0'\n");
      await writeFile(join(mixedDir, 'requirements.txt'), 'requests==2.31.0');
      expect(await detectEcosystem(mixedDir)).toBe('npm');
    } finally {
      await rm(mixedDir, { recursive: true, force: true });
    }
  });
});
