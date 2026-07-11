import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { performScan, type ScanClients } from '../src/commands/scan.js';
import type { GitHubRepoActivity } from '../src/lib/github-client.js';
import type { NpmPackageMetadata } from '../src/lib/npm-registry-client.js';
import { formatReport } from '../src/lib/report.js';
import type { SuccessorRecord } from '../src/types.js';

const AS_OF = new Date('2026-07-11T12:00:00.000Z');
const fixturesDir = fileURLToPath(new URL('./fixtures/npm-project', import.meta.url));

function monthsAgo(months: number): Date {
  return new Date(AS_OF.getTime() - months * 30.4375 * 24 * 60 * 60 * 1000);
}

function npmMeta(name: string, overrides: Partial<NpmPackageMetadata> = {}): NpmPackageMetadata {
  return {
    name,
    latestVersion: '1.0.0',
    lastModified: monthsAgo(1),
    deprecated: null,
    repositoryUrl: `https://github.com/acme/${name}`,
    ownerRepo: `acme/${name}`,
    ...overrides,
  };
}

function ghActivity(overrides: Partial<GitHubRepoActivity> = {}): GitHubRepoActivity {
  return {
    lastCommitDate: monthsAgo(1),
    lastReleaseDate: monthsAgo(1),
    openIssueCount: 3,
    isArchived: false,
    hasDeprecationInReadme: false,
    ...overrides,
  };
}

const prettierSuccessorRecord: SuccessorRecord = {
  deadPackage: 'prettier',
  ecosystem: 'npm',
  deprecatedSince: '2026-01-01',
  successors: [
    {
      name: 'prettier-next',
      repoUrl: 'https://github.com/acme/prettier-next',
      type: 'official-successor',
      migrationEffort: 'drop-in',
      evidence: ['Endorsed by original maintainer'],
      lastVerified: '2026-07-01',
    },
  ],
  notes: null,
};

// Fixture lockfile contains: ansi-styles, debug, ms, prettier, supports-color.
// The mocks make prettier likely-abandoned (npm deprecated), supports-color
// at-risk (18 months stale), ansi-styles insufficient-data (no repo field),
// and debug/ms maintained.
function createMockClients(): ScanClients {
  return {
    getPackageMetadata: vi.fn(async (name: string) => {
      switch (name) {
        case 'prettier':
          return npmMeta(name, {
            deprecated: 'prettier is deprecated, use prettier-next instead',
          });
        case 'supports-color':
          return npmMeta(name, { lastModified: monthsAgo(18) });
        case 'ansi-styles':
          return npmMeta(name, { repositoryUrl: null, ownerRepo: null });
        default:
          return npmMeta(name);
      }
    }),
    fetchRepoActivity: vi.fn(async (ownerRepo: string) => {
      if (ownerRepo === 'acme/supports-color') {
        return ghActivity({
          lastCommitDate: monthsAgo(18),
          lastReleaseDate: monthsAgo(18),
        });
      }
      return ghActivity();
    }),
    loadSuccessorGraph: vi.fn(async () => {
      return new Map([['prettier', prettierSuccessorRecord]]);
    }),
  };
}

describe('performScan', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(AS_OF);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('produces a ScanResult combining verdicts and successor lookups', async () => {
    const result = await performScan({ cwd: fixturesDir }, createMockClients());

    expect(result.scannedAt).toBe(AS_OF.toISOString());
    expect(result.summary).toEqual({
      total: 5,
      maintained: 2,
      atRisk: 1,
      likelyAbandoned: 1,
      insufficientData: 1,
      withKnownSuccessors: 1,
    });

    const byName = new Map(
      result.entries.map((entry) => [entry.verdict.dependency.name, entry]),
    );

    expect(byName.get('debug')?.verdict.confidence).toBe('maintained');
    expect(byName.get('ms')?.verdict.confidence).toBe('maintained');
    expect(byName.get('supports-color')?.verdict.confidence).toBe('at-risk');
    expect(byName.get('ansi-styles')?.verdict.confidence).toBe('insufficient-data');

    const prettier = byName.get('prettier');
    expect(prettier?.verdict.confidence).toBe('likely-abandoned');
    expect(prettier?.verdict.signals[0]).toMatchObject({
      type: 'deprecated-flag',
      severity: 'critical',
    });
    expect(prettier?.successorRecord).toEqual(prettierSuccessorRecord);

    for (const entry of result.entries) {
      if (entry.verdict.confidence !== 'maintained') {
        expect(entry.verdict.signals.length).toBeGreaterThan(0);
      }
    }
  });

  it('skips transitive dependencies with directOnly', async () => {
    const clients = createMockClients();
    const result = await performScan({ cwd: fixturesDir, directOnly: true }, clients);

    expect(result.entries.map((entry) => entry.verdict.dependency.name)).toEqual([
      'debug',
      'ms',
      'prettier',
    ]);
    expect(result.summary.total).toBe(3);
    expect(clients.getPackageMetadata).toHaveBeenCalledTimes(3);
  });

  it('reports progress for each analyzed dependency', async () => {
    const onProgress = vi.fn();
    await performScan({ cwd: fixturesDir, onProgress }, createMockClients());

    expect(onProgress).toHaveBeenCalledTimes(5);
    expect(onProgress).toHaveBeenLastCalledWith(5, 5, expect.any(String));
  });

  it('formats the default report', async () => {
    const result = await performScan({ cwd: fixturesDir }, createMockClients());

    expect(formatReport(result)).toMatchSnapshot();
  });

  it('formats the verbose report including the insufficient-data count', async () => {
    const result = await performScan({ cwd: fixturesDir }, createMockClients());

    expect(formatReport(result, { verbose: true })).toMatchSnapshot();
  });

  it('filters to likely-abandoned only with severity', async () => {
    const result = await performScan({ cwd: fixturesDir }, createMockClients());

    expect(formatReport(result, { severity: 'likely-abandoned' })).toMatchSnapshot();
  });

  it('prints an encouraging line when nothing is abandoned', async () => {
    const clients = createMockClients();
    clients.getPackageMetadata = vi.fn(async (name: string) => npmMeta(name));
    clients.fetchRepoActivity = vi.fn(async () => ghActivity());

    const result = await performScan({ cwd: fixturesDir }, clients);

    expect(result.summary.likelyAbandoned).toBe(0);
    expect(result.summary.atRisk).toBe(0);
    expect(formatReport(result)).toMatchSnapshot();
  });
});
