import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  checkExitCode,
  formatCheckReport,
  PackageNotFoundError,
  performCheck,
  type CheckClients,
} from '../src/commands/check.js';
import type { GitHubRepoActivity } from '../src/lib/github-client.js';
import type { NpmPackageMetadata } from '../src/lib/npm-registry-client.js';
import type { PypiPackageMetadata } from '../src/lib/pypi-registry-client.js';
import type { SuccessorRecord } from '../src/types.js';

const AS_OF = new Date('2026-07-11T12:00:00.000Z');

function monthsAgo(months: number): Date {
  return new Date(AS_OF.getTime() - months * 30.4375 * 24 * 60 * 60 * 1000);
}

function npmMeta(name: string, overrides: Partial<NpmPackageMetadata> = {}): NpmPackageMetadata {
  return {
    name,
    latestVersion: '2.88.2',
    lastModified: monthsAgo(1),
    deprecated: null,
    repositoryUrl: `https://github.com/acme/${name}`,
    ownerRepo: `acme/${name}`,
    ...overrides,
  };
}

function pypiMeta(name: string, overrides: Partial<PypiPackageMetadata> = {}): PypiPackageMetadata {
  return {
    name,
    latestVersion: '2.32.4',
    lastModified: monthsAgo(1),
    deprecated: null,
    explicitDeprecationSignal: false,
    repositoryUrl: `https://github.com/psf/${name}`,
    ownerRepo: `psf/${name}`,
    classifiers: [],
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

const requestRecord: SuccessorRecord = {
  deadPackage: 'request',
  ecosystem: 'npm',
  deprecatedSince: '2020-02-11',
  successors: [
    {
      name: 'got',
      repoUrl: 'https://github.com/sindresorhus/got',
      type: 'api-compatible-alternative',
      migrationEffort: 'minor-changes',
      evidence: ['Most widely adopted replacement', 'Actively maintained'],
      lastVerified: '2026-07-11',
    },
    {
      name: 'axios',
      repoUrl: 'https://github.com/axios/axios',
      type: 'api-compatible-alternative',
      migrationEffort: 'minor-changes',
      evidence: ['Promise-based, widest ecosystem adoption'],
      lastVerified: '2026-07-11',
    },
  ],
  notes: 'request was deprecated by its maintainers in February 2020.',
};

function createClients(overrides: Partial<CheckClients> = {}): CheckClients {
  return {
    getPackageMetadata: vi.fn(async (name: string) => npmMeta(name)),
    fetchRepoActivity: vi.fn(async () => ghActivity()),
    loadSuccessorGraph: vi.fn(async () => new Map([['request', requestRecord]])),
    ...overrides,
  };
}

describe('performCheck', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(AS_OF);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns a likely-abandoned verdict with successors for a deprecated package', async () => {
    const clients = createClients({
      getPackageMetadata: vi.fn(async (name: string) =>
        npmMeta(name, {
          deprecated: 'request has been deprecated',
        }),
      ),
    });

    const result = await performCheck('request', clients);

    expect(result.verdict.confidence).toBe('likely-abandoned');
    expect(result.successorRecord).toEqual(requestRecord);
    expect(checkExitCode(result.verdict)).toBe(1);
    expect(formatCheckReport(result)).toMatchSnapshot();
  });

  it('returns a maintained verdict with exit code 0 for a healthy package', async () => {
    const result = await performCheck('healthy-pkg', createClients());

    expect(result.verdict.confidence).toBe('maintained');
    expect(result.successorRecord).toBeNull();
    expect(checkExitCode(result.verdict)).toBe(0);
    expect(formatCheckReport(result)).toMatchSnapshot();
  });

  it('routes an explicitly selected PyPI package to the PyPI registry client', async () => {
    const clients = createClients({
      getPackageMetadata: vi.fn(async () => {
        throw new Error('npm client should not be called for an explicit PyPI check');
      }),
      getPypiPackageMetadata: vi.fn(async (name: string) => pypiMeta(name)),
    });

    const result = await performCheck('requests', clients, 'pypi');

    expect(clients.getPackageMetadata).not.toHaveBeenCalled();
    expect(clients.getPypiPackageMetadata).toHaveBeenCalledWith('requests');
    expect(result.verdict.dependency.ecosystem).toBe('pypi');
    expect(result.verdict.confidence).toBe('maintained');
    expect(result.successorRecord).toBeNull();
  });

  it('returns exit code 0 for insufficient-data verdicts', async () => {
    const clients = createClients({
      getPackageMetadata: vi.fn(async (name: string) =>
        npmMeta(name, { repositoryUrl: null, ownerRepo: null }),
      ),
    });

    const result = await performCheck('mystery-pkg', clients);

    expect(result.verdict.confidence).toBe('insufficient-data');
    expect(checkExitCode(result.verdict)).toBe(0);
  });

  it('returns exit code 1 for at-risk verdicts', async () => {
    const clients = createClients({
      fetchRepoActivity: vi.fn(async () =>
        ghActivity({
          lastCommitDate: monthsAgo(18),
          lastReleaseDate: monthsAgo(18),
        }),
      ),
    });

    const result = await performCheck('stale-pkg', clients);

    expect(result.verdict.confidence).toBe('at-risk');
    expect(checkExitCode(result.verdict)).toBe(1);
  });

  it('throws PackageNotFoundError for unknown packages', async () => {
    const clients = createClients({
      getPackageMetadata: vi.fn(async () => null),
    });

    await expect(performCheck('does-not-exist', clients)).rejects.toThrow(PackageNotFoundError);
    await expect(performCheck('does-not-exist', clients)).rejects.toThrow(
      'Package "does-not-exist" was not found on the npm registry',
    );
  });
});
