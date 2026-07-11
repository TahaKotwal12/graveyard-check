import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadSuccessorGraph } from '../src/lib/successor-graph.js';

const dataDir = fileURLToPath(new URL('../data/successors', import.meta.url));

describe('shipped successor dataset', () => {
  it('every record in data/successors validates against the schema', async () => {
    const graph = await loadSuccessorGraph(dataDir);

    expect(graph.size).toBeGreaterThan(0);
    for (const [deadPackage, record] of graph) {
      expect(record.deadPackage).toBe(deadPackage);
      expect(record.successors.length).toBeGreaterThan(0);
    }
  });
});
