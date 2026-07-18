import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import type { Dependency } from '../types.js';

/**
 * Project-level configuration from `.graveyardrc` / `.graveyardrc.json` (JSON).
 *
 * The `ignore` list acknowledges known findings so CI doesn't stay permanently
 * red over a dependency a team can't migrate yet:
 *
 *   {
 *     "ignore": [
 *       "moment",
 *       { "name": "nose", "ecosystem": "pypi", "reason": "migration planned Q3" }
 *     ]
 *   }
 */

export interface IgnoreEntry {
  name: string;
  /** Restrict the ignore to one ecosystem; omitted means both. */
  ecosystem?: Dependency['ecosystem'];
  /** Free-form note shown in reports so future readers know why. */
  reason?: string;
}

export interface GraveyardConfig {
  ignore: IgnoreEntry[];
}

export const CONFIG_FILENAMES = ['.graveyardrc', '.graveyardrc.json'] as const;

const ignoreEntrySchema = z.union([
  z.string().min(1),
  z.object({
    name: z.string().min(1),
    ecosystem: z.enum(['npm', 'pypi']).optional(),
    reason: z.string().optional(),
  }),
]);

const configSchema = z.object({
  ignore: z.array(ignoreEntrySchema).optional(),
});

export async function loadGraveyardConfig(cwd: string): Promise<GraveyardConfig> {
  for (const filename of CONFIG_FILENAMES) {
    const path = join(cwd, filename);

    let raw: string;
    try {
      raw = await readFile(path, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        continue;
      }
      throw error;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      throw new Error(`${filename} is not valid JSON: ${(error as Error).message}`);
    }

    const result = configSchema.safeParse(parsed);
    if (!result.success) {
      const issue = result.error.issues[0];
      const where = issue.path.length > 0 ? ` at "${issue.path.join('.')}"` : '';
      throw new Error(`${filename} is invalid${where}: ${issue.message}`);
    }

    return {
      ignore: (result.data.ignore ?? []).map((entry) =>
        typeof entry === 'string' ? { name: entry } : entry,
      ),
    };
  }

  return { ignore: [] };
}

/** Case-insensitive match; PyPI names additionally treat `-`, `_`, and `.` alike. */
export function isIgnored(dependency: Dependency, config: GraveyardConfig): IgnoreEntry | null {
  for (const entry of config.ignore) {
    if (entry.ecosystem && entry.ecosystem !== dependency.ecosystem) {
      continue;
    }

    if (
      normalizeName(entry.name, dependency.ecosystem) ===
      normalizeName(dependency.name, dependency.ecosystem)
    ) {
      return entry;
    }
  }

  return null;
}

function normalizeName(name: string, ecosystem: Dependency['ecosystem']): string {
  const lower = name.toLowerCase();
  return ecosystem === 'pypi' ? lower.replace(/[-_.]+/g, '-') : lower;
}
