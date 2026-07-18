import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { detectEcosystem, parseLockfile } from '../src/lib/lockfile-parser.js';
import { normalizePypiName } from '../src/lib/parsers/uv-parser.js';

const uvFixturesDir = fileURLToPath(new URL('./fixtures/uv-project', import.meta.url));
const poetryFixturesDir = fileURLToPath(new URL('./fixtures/poetry-project', import.meta.url));

describe('normalizePypiName', () => {
  it('applies PEP 503 normalization', () => {
    expect(normalizePypiName('Flask-Script')).toBe('flask-script');
    expect(normalizePypiName('zope.interface')).toBe('zope-interface');
    expect(normalizePypiName('some__weird--name')).toBe('some-weird-name');
  });
});

describe('parseLockfile with uv.lock', () => {
  it('parses direct, dev, and transitive dependencies without a pyproject.toml', async () => {
    expect(await detectEcosystem(uvFixturesDir)).toBe('pypi');

    const dependencies = await parseLockfile(uvFixturesDir);
    expect(dependencies).toEqual([
      {
        name: 'certifi',
        currentVersion: '2024.8.30',
        isDirect: false,
        isDev: false,
        ecosystem: 'pypi',
      },
      {
        name: 'flask-script',
        currentVersion: '2.0.6',
        isDirect: true,
        isDev: false,
        ecosystem: 'pypi',
      },
      {
        name: 'pytest',
        currentVersion: '8.3.3',
        isDirect: true,
        isDev: true,
        ecosystem: 'pypi',
      },
      {
        name: 'requests',
        currentVersion: '2.32.3',
        isDirect: true,
        isDev: false,
        ecosystem: 'pypi',
      },
    ]);
  });

  it('rejects unparseable uv.lock files with a clear error', async () => {
    const brokenDir = await mkdtemp(join(tmpdir(), 'graveyard-check-uv-broken-'));

    try {
      await writeFile(join(brokenDir, 'uv.lock'), 'version = = broken');
      await expect(parseLockfile(brokenDir)).rejects.toThrow('Could not parse uv.lock');
    } finally {
      await rm(brokenDir, { recursive: true, force: true });
    }
  });
});

describe('parseLockfile with poetry.lock', () => {
  it('parses Poetry 2.x lockfiles using pyproject.toml for direct classification', async () => {
    expect(await detectEcosystem(poetryFixturesDir)).toBe('pypi');

    const dependencies = await parseLockfile(poetryFixturesDir);
    expect(dependencies).toEqual([
      {
        name: 'certifi',
        currentVersion: '2024.8.30',
        isDirect: false,
        isDev: false,
        ecosystem: 'pypi',
      },
      {
        name: 'flask-script',
        currentVersion: '2.0.6',
        isDirect: true,
        isDev: false,
        ecosystem: 'pypi',
      },
      {
        name: 'pytest',
        currentVersion: '8.3.3',
        isDirect: true,
        isDev: true,
        ecosystem: 'pypi',
      },
      {
        name: 'requests',
        currentVersion: '2.32.3',
        isDirect: true,
        isDev: false,
        ecosystem: 'pypi',
      },
    ]);
  });

  it('supports Poetry 1.x category markers and tool.poetry.dependencies', async () => {
    const legacyDir = await mkdtemp(join(tmpdir(), 'graveyard-check-poetry-legacy-'));

    try {
      await writeFile(
        join(legacyDir, 'pyproject.toml'),
        [
          '[tool.poetry]',
          'name = "legacy-app"',
          'version = "1.0.0"',
          '',
          '[tool.poetry.dependencies]',
          'python = "^3.9"',
          'requests = "^2.31.0"',
          '',
          '[tool.poetry.dev-dependencies]',
          'pytest = "^7.0"',
        ].join('\n'),
      );
      await writeFile(
        join(legacyDir, 'poetry.lock'),
        [
          '[[package]]',
          'name = "certifi"',
          'version = "2023.7.22"',
          'category = "main"',
          'optional = false',
          '',
          '[[package]]',
          'name = "pytest"',
          'version = "7.4.4"',
          'category = "dev"',
          'optional = false',
          '',
          '[[package]]',
          'name = "requests"',
          'version = "2.31.0"',
          'category = "main"',
          'optional = false',
        ].join('\n'),
      );

      const dependencies = await parseLockfile(legacyDir);
      expect(dependencies).toEqual([
        {
          name: 'certifi',
          currentVersion: '2023.7.22',
          isDirect: false,
          isDev: false,
          ecosystem: 'pypi',
        },
        {
          name: 'pytest',
          currentVersion: '7.4.4',
          isDirect: true,
          isDev: true,
          ecosystem: 'pypi',
        },
        {
          name: 'requests',
          currentVersion: '2.31.0',
          isDirect: true,
          isDev: false,
          ecosystem: 'pypi',
        },
      ]);
    } finally {
      await rm(legacyDir, { recursive: true, force: true });
    }
  });

  it('requires pyproject.toml next to poetry.lock', async () => {
    const bareDir = await mkdtemp(join(tmpdir(), 'graveyard-check-poetry-bare-'));

    try {
      await writeFile(join(bareDir, 'poetry.lock'), '[[package]]\nname = "x"\nversion = "1.0"');
      await expect(parseLockfile(bareDir)).rejects.toThrow(
        'Found poetry.lock but no pyproject.toml',
      );
    } finally {
      await rm(bareDir, { recursive: true, force: true });
    }
  });
});

describe('Python lockfile detection priority', () => {
  it('prefers requirements.txt, then uv.lock, then poetry.lock', async () => {
    const mixedDir = await mkdtemp(join(tmpdir(), 'graveyard-check-py-priority-'));

    try {
      await writeFile(
        join(mixedDir, 'uv.lock'),
        [
          'version = 1',
          '',
          '[[package]]',
          'name = "app"',
          'version = "0.1.0"',
          'source = { virtual = "." }',
          'dependencies = [{ name = "requests" }]',
          '',
          '[[package]]',
          'name = "requests"',
          'version = "2.32.3"',
          'source = { registry = "https://pypi.org/simple" }',
        ].join('\n'),
      );
      await writeFile(join(mixedDir, 'requirements.txt'), 'nose==1.3.7');

      const fromRequirements = await parseLockfile(mixedDir);
      expect(fromRequirements.map((dep) => dep.name)).toEqual(['nose']);

      await rm(join(mixedDir, 'requirements.txt'));
      const fromUv = await parseLockfile(mixedDir);
      expect(fromUv.map((dep) => dep.name)).toEqual(['requests']);
    } finally {
      await rm(mixedDir, { recursive: true, force: true });
    }
  });

  it('still reports Pipfile.lock as unsupported', async () => {
    const pipenvDir = await mkdtemp(join(tmpdir(), 'graveyard-check-pipenv-'));

    try {
      await writeFile(join(pipenvDir, 'Pipfile.lock'), '{}');
      await expect(parseLockfile(pipenvDir)).rejects.toThrow(
        "Detected Pipfile.lock, but parsing isn't implemented yet.",
      );
    } finally {
      await rm(pipenvDir, { recursive: true, force: true });
    }
  });
});
