import { parse } from 'yaml';
import type { Ecosystem } from './checker';

/**
 * The real successor dataset, bundled at build time straight from
 * data/successors/*.yaml in the repository root — the website always shows
 * exactly what the CLI ships.
 */
export interface SuccessorEntry {
  name: string;
  repoUrl: string;
  type: string;
  migrationEffort: string;
  evidence: string[];
  lastVerified: string;
}

export interface SuccessorRecord {
  deadPackage: string;
  ecosystem: Ecosystem;
  deprecatedSince: string | null;
  successors: SuccessorEntry[];
  notes?: string;
}

const rawFiles = import.meta.glob('../../../data/successors/*.yaml', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const records: SuccessorRecord[] = Object.values(rawFiles)
  .map((raw) => parse(raw) as SuccessorRecord)
  .filter((record) => Boolean(record?.deadPackage));

export function findSuccessorRecord(name: string, ecosystem: Ecosystem): SuccessorRecord | null {
  const normalized = name.trim().toLowerCase();
  return (
    records.find(
      (record) => record.deadPackage.toLowerCase() === normalized && record.ecosystem === ecosystem,
    ) ?? null
  );
}

export const datasetSize = records.length;
