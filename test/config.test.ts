import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isIgnored, loadGraveyardConfig } from '../src/lib/config.js';
import type { Dependency } from '../src/types.js';

function dep(name: string, ecosystem: Dependency['ecosystem'] = 'npm'): Dependency {
  return { name, currentVersion: '1.0.0', isDirect: true, isDev: false, ecosystem };
}

async function withConfigDir(
  contents: string | null,
  run: (dir: string) => Promise<void>,
  filename = '.graveyardrc',
): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), 'graveyard-check-config-'));
  try {
    if (contents !== null) {
      await writeFile(join(dir, filename), contents);
    }
    await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

describe('loadGraveyardConfig', () => {
  it('returns an empty ignore list when no config file exists', async () => {
    await withConfigDir(null, async (dir) => {
      expect(await loadGraveyardConfig(dir)).toEqual({ ignore: [] });
    });
  });

  it('normalizes string and object entries', async () => {
    await withConfigDir(
      JSON.stringify({
        ignore: ['moment', { name: 'nose', ecosystem: 'pypi', reason: 'migration planned Q3' }],
      }),
      async (dir) => {
        expect(await loadGraveyardConfig(dir)).toEqual({
          ignore: [
            { name: 'moment' },
            { name: 'nose', ecosystem: 'pypi', reason: 'migration planned Q3' },
          ],
        });
      },
    );
  });

  it('also reads .graveyardrc.json', async () => {
    await withConfigDir(
      JSON.stringify({ ignore: ['left-pad'] }),
      async (dir) => {
        expect(await loadGraveyardConfig(dir)).toEqual({ ignore: [{ name: 'left-pad' }] });
      },
      '.graveyardrc.json',
    );
  });

  it('rejects invalid JSON with the filename in the error', async () => {
    await withConfigDir('{ not json', async (dir) => {
      await expect(loadGraveyardConfig(dir)).rejects.toThrow('.graveyardrc is not valid JSON');
    });
  });

  it('rejects schema violations with a field path', async () => {
    await withConfigDir(JSON.stringify({ ignore: [{ ecosystem: 'npm' }] }), async (dir) => {
      await expect(loadGraveyardConfig(dir)).rejects.toThrow('.graveyardrc is invalid');
    });
  });
});

describe('isIgnored', () => {
  it('matches case-insensitively', () => {
    const config = { ignore: [{ name: 'Moment' }] };
    expect(isIgnored(dep('moment'), config)).toEqual({ name: 'Moment' });
  });

  it('applies PEP 503 normalization for PyPI names', () => {
    const config = { ignore: [{ name: 'Flask_Script' }] };
    expect(isIgnored(dep('flask-script', 'pypi'), config)).not.toBeNull();
    expect(isIgnored(dep('flask-script', 'npm'), config)).toBeNull();
  });

  it('respects ecosystem scoping', () => {
    const config = { ignore: [{ name: 'requests', ecosystem: 'pypi' as const }] };
    expect(isIgnored(dep('requests', 'pypi'), config)).not.toBeNull();
    expect(isIgnored(dep('requests', 'npm'), config)).toBeNull();
  });

  it('returns null when nothing matches', () => {
    expect(isIgnored(dep('lodash'), { ignore: [{ name: 'moment' }] })).toBeNull();
  });
});
