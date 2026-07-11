import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { findSuccessors, loadSuccessorGraph } from '../src/lib/successor-graph.js';

const fixturesDir = fileURLToPath(new URL('./fixtures/successors', import.meta.url));

describe('loadSuccessorGraph', () => {
  it('loads and validates all YAML records keyed by deadPackage', async () => {
    const graph = await loadSuccessorGraph(fixturesDir);

    expect(graph.size).toBe(2);
    expect(graph.get('request')?.successors[0]).toMatchObject({
      name: 'got',
      type: 'api-compatible-alternative',
      migrationEffort: 'minor-changes',
    });
    expect(graph.get('node-sass')).toMatchObject({
      deprecatedSince: null,
      notes: null,
    });
  });

  it('returns an empty map when the data directory does not exist', async () => {
    const graph = await loadSuccessorGraph(join(fixturesDir, 'does-not-exist'));
    expect(graph.size).toBe(0);
  });

  it('throws an error naming the file for records failing schema validation', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'graveyard-check-successors-'));

    try {
      await writeFile(
        join(dir, 'broken.yaml'),
        [
          'deadPackage: broken',
          'ecosystem: not-a-real-ecosystem',
          'deprecatedSince: null',
          'successors: []',
          'notes: null',
        ].join('\n'),
      );

      await expect(loadSuccessorGraph(dir)).rejects.toThrow(/broken\.yaml/);
      await expect(loadSuccessorGraph(dir)).rejects.toThrow(/ecosystem/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('throws an error naming the file for unparseable YAML', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'graveyard-check-successors-'));

    try {
      await writeFile(join(dir, 'garbage.yaml'), 'deadPackage: [unclosed');

      await expect(loadSuccessorGraph(dir)).rejects.toThrow(
        /Invalid YAML in successor record garbage\.yaml/,
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('rejects duplicate records for the same dead package', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'graveyard-check-successors-'));
    const record = [
      'deadPackage: dupe',
      'ecosystem: npm',
      'deprecatedSince: null',
      'successors:',
      '  - name: replacement',
      '    repoUrl: https://github.com/acme/replacement',
      '    type: community-fork',
      '    migrationEffort: drop-in',
      '    evidence:',
      '      - Active fork',
      '    lastVerified: 2026-07-01',
      'notes: null',
    ].join('\n');

    try {
      await writeFile(join(dir, 'a.yaml'), record);
      await writeFile(join(dir, 'b.yaml'), record);

      await expect(loadSuccessorGraph(dir)).rejects.toThrow(/Duplicate successor record.*dupe/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe('findSuccessors', () => {
  it('returns the record for a known dead package and null otherwise', async () => {
    const graph = await loadSuccessorGraph(fixturesDir);

    expect(findSuccessors('request', graph)?.deadPackage).toBe('request');
    expect(findSuccessors('left-pad', graph)).toBeNull();
  });
});
