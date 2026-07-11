import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { z } from 'zod';
import type { SuccessorRecord } from '../types.js';

const successorCandidateSchema = z.object({
  name: z.string().min(1),
  repoUrl: z.string().url(),
  type: z.enum([
    'official-successor',
    'community-fork',
    'api-compatible-alternative',
    'different-approach',
  ]),
  migrationEffort: z.enum(['drop-in', 'minor-changes', 'rewrite-required']),
  evidence: z.array(z.string().min(1)).min(1),
  lastVerified: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be an ISO date (YYYY-MM-DD)'),
});

const successorRecordSchema = z.object({
  deadPackage: z.string().min(1),
  ecosystem: z.enum(['npm', 'pypi', 'go', 'crates']),
  deprecatedSince: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'must be an ISO date (YYYY-MM-DD)')
    .nullable(),
  successors: z.array(successorCandidateSchema).min(1),
  notes: z.string().nullable(),
});

/**
 * Locate `data/successors` relative to this module. Works both from source
 * (src/lib/) and from the bundled CLI (dist/), where the relative depth differs.
 */
function defaultDataDir(): string {
  const moduleDir = fileURLToPath(new URL('.', import.meta.url));
  return moduleDir.includes('src')
    ? join(moduleDir, '..', '..', 'data', 'successors')
    : join(moduleDir, '..', 'data', 'successors');
}

export async function loadSuccessorGraph(
  dataDir: string = defaultDataDir(),
): Promise<Map<string, SuccessorRecord>> {
  let entries: string[];
  try {
    entries = await readdir(dataDir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return new Map();
    }
    throw error;
  }

  const graph = new Map<string, SuccessorRecord>();

  for (const entry of entries.filter((file) => /\.ya?ml$/i.test(file)).sort()) {
    const filePath = join(dataDir, entry);
    const raw = await readFile(filePath, 'utf8');

    let parsed: unknown;
    try {
      parsed = parse(raw);
    } catch (error) {
      throw new Error(
        `Invalid YAML in successor record ${entry}: ${(error as Error).message}\n` +
          'See data/successors/SCHEMA.md for the expected record format.',
      );
    }

    const result = successorRecordSchema.safeParse(parsed);
    if (!result.success) {
      const issues = result.error.issues
        .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
        .join('\n');
      throw new Error(
        `Invalid successor record ${entry}:\n${issues}\n` +
          'See data/successors/SCHEMA.md for the expected record format.',
      );
    }

    const record = result.data;
    if (graph.has(record.deadPackage)) {
      throw new Error(
        `Duplicate successor record for "${record.deadPackage}" (second definition in ${entry})`,
      );
    }

    graph.set(record.deadPackage, record);
  }

  return graph;
}

export function findSuccessors(
  packageName: string,
  graph: Map<string, SuccessorRecord>,
): SuccessorRecord | null {
  return graph.get(packageName) ?? null;
}
