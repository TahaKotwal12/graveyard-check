import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  detectAbandonment,
  type GitHubData,
  type NpmMetadata,
} from '../src/lib/abandonment-detector.js';
import type { Dependency } from '../src/types.js';

const AS_OF = new Date('2026-07-11T12:00:00.000Z');

const baseDependency: Dependency = {
  name: 'example-pkg',
  currentVersion: '1.0.0',
  isDirect: true,
  isDev: false,
  ecosystem: 'npm',
};

function monthsAgo(months: number, from: Date = AS_OF): Date {
  return new Date(from.getTime() - months * 30.4375 * 24 * 60 * 60 * 1000);
}

function npmMeta(overrides: Partial<NpmMetadata> = {}): NpmMetadata {
  return {
    deprecated: null,
    lastModified: monthsAgo(1),
    ownerRepo: 'acme/example-pkg',
    ...overrides,
  };
}

function ghData(overrides: Partial<GitHubData> = {}): GitHubData {
  return {
    lastCommitDate: monthsAgo(1),
    lastReleaseDate: monthsAgo(1),
    isArchived: false,
    hasDeprecationInReadme: false,
    ...overrides,
  };
}

describe('detectAbandonment', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(AS_OF);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('marks npm deprecated packages as likely-abandoned and skips time heuristics', () => {
    const verdict = detectAbandonment(
      baseDependency,
      npmMeta({ deprecated: 'This package is no longer supported' }),
      ghData({
        lastCommitDate: monthsAgo(36),
        lastReleaseDate: monthsAgo(36),
      }),
    );

    expect(verdict.confidence).toBe('likely-abandoned');
    expect(verdict.signals).toEqual([
      {
        type: 'deprecated-flag',
        severity: 'critical',
        description: 'Package deprecated on npm: This package is no longer supported',
      },
    ]);
  });

  it('still marks npm deprecated packages as likely-abandoned when GitHub activity is recent', () => {
    const verdict = detectAbandonment(
      baseDependency,
      npmMeta({ deprecated: 'Maintainer-endorsed deprecation notice' }),
      ghData({
        lastCommitDate: monthsAgo(1),
        lastReleaseDate: monthsAgo(1),
      }),
    );

    expect(verdict.confidence).toBe('likely-abandoned');
    expect(verdict.signals).toHaveLength(1);
    expect(verdict.signals[0]?.type).toBe('deprecated-flag');
  });

  it('includes both deprecated and archived signals when npm deprecated and GitHub archived', () => {
    const verdict = detectAbandonment(
      baseDependency,
      npmMeta({ deprecated: 'Package deprecated by maintainer' }),
      ghData({ isArchived: true }),
    );

    expect(verdict.confidence).toBe('likely-abandoned');
    expect(verdict.signals).toEqual([
      {
        type: 'deprecated-flag',
        severity: 'critical',
        description: 'Package deprecated on npm: Package deprecated by maintainer',
      },
      {
        type: 'maintainer-inactive',
        severity: 'critical',
        description: 'GitHub repository is archived (read-only)',
      },
    ]);
  });

  it('returns insufficient-data when GitHub data is unavailable', () => {
    const verdict = detectAbandonment(baseDependency, npmMeta({ ownerRepo: null }), null);

    expect(verdict.confidence).toBe('insufficient-data');
    expect(verdict.signals).toEqual([
      {
        type: 'maintainer-inactive',
        severity: 'warning',
        description: 'No GitHub repository URL is listed for this package',
      },
    ]);
  });

  it('returns insufficient-data when the GitHub repository could not be found', () => {
    const verdict = detectAbandonment(
      baseDependency,
      npmMeta({ ownerRepo: 'acme/missing' }),
      null,
    );

    expect(verdict.confidence).toBe('insufficient-data');
    expect(verdict.signals[0]?.description).toContain('acme/missing');
  });

  it('marks archived repositories as likely-abandoned', () => {
    const verdict = detectAbandonment(
      baseDependency,
      npmMeta(),
      ghData({
        isArchived: true,
        lastCommitDate: monthsAgo(1),
        lastReleaseDate: monthsAgo(1),
      }),
    );

    expect(verdict.confidence).toBe('likely-abandoned');
    expect(verdict.signals).toEqual([
      {
        type: 'maintainer-inactive',
        severity: 'critical',
        description: 'GitHub repository is archived (read-only)',
      },
    ]);
  });

  it('marks packages with no commits and no releases in 24+ months as likely-abandoned', () => {
    const verdict = detectAbandonment(
      baseDependency,
      npmMeta({ lastModified: monthsAgo(30) }),
      ghData({
        lastCommitDate: monthsAgo(30),
        lastReleaseDate: monthsAgo(30),
      }),
    );

    expect(verdict.confidence).toBe('likely-abandoned');
    expect(verdict.signals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'no-commits',
          description: expect.stringMatching(/2\.5 years/),
        }),
        expect.objectContaining({
          type: 'no-release',
          description: expect.stringMatching(/2\.5 years/),
        }),
      ]),
    );
  });

  it('marks packages at exactly the 24-month boundary as likely-abandoned when both signals apply', () => {
    const verdict = detectAbandonment(
      baseDependency,
      npmMeta({ lastModified: monthsAgo(24) }),
      ghData({
        lastCommitDate: monthsAgo(24),
        lastReleaseDate: monthsAgo(24),
      }),
    );

    expect(verdict.confidence).toBe('likely-abandoned');
    expect(verdict.signals.map((signal) => signal.description)).toEqual([
      'No commits in 2.0 years',
      'No release in 2.0 years',
    ]);
  });

  it('marks packages at exactly the 12-month boundary as at-risk', () => {
    const verdict = detectAbandonment(
      baseDependency,
      npmMeta({ lastModified: monthsAgo(12) }),
      ghData({
        lastCommitDate: monthsAgo(12),
        lastReleaseDate: monthsAgo(1),
      }),
    );

    expect(verdict.confidence).toBe('at-risk');
    expect(verdict.signals).toEqual([
      {
        type: 'no-commits',
        severity: 'warning',
        description: 'No commits in 1.0 years',
      },
    ]);
  });

  it('marks packages as at-risk when only commits or only releases are stale', () => {
    const staleCommits = detectAbandonment(
      baseDependency,
      npmMeta({ lastModified: monthsAgo(1) }),
      ghData({
        lastCommitDate: monthsAgo(18),
        lastReleaseDate: monthsAgo(1),
      }),
    );

    expect(staleCommits.confidence).toBe('at-risk');
    expect(staleCommits.signals).toEqual([
      {
        type: 'no-commits',
        severity: 'warning',
        description: 'No commits in 1.5 years',
      },
    ]);

    const staleReleases = detectAbandonment(
      baseDependency,
      npmMeta({ lastModified: monthsAgo(18) }),
      ghData({
        lastCommitDate: monthsAgo(1),
        lastReleaseDate: monthsAgo(18),
      }),
    );

    expect(staleReleases.confidence).toBe('at-risk');
    expect(staleReleases.signals).toEqual([
      {
        type: 'no-release',
        severity: 'warning',
        description: 'No release in 1.5 years',
      },
    ]);
  });

  it('marks packages as at-risk when one signal is 24+ months but the other is recent', () => {
    const verdict = detectAbandonment(
      baseDependency,
      npmMeta({ lastModified: monthsAgo(1) }),
      ghData({
        lastCommitDate: monthsAgo(30),
        lastReleaseDate: monthsAgo(1),
      }),
    );

    expect(verdict.confidence).toBe('at-risk');
    expect(verdict.signals).toEqual([
      {
        type: 'no-commits',
        severity: 'critical',
        description: 'No commits in 2.5 years',
      },
    ]);
  });

  it('adds README deprecation language as a signal and bumps confidence by one tier', () => {
    const maintainedWithReadme = detectAbandonment(
      baseDependency,
      npmMeta(),
      ghData({ hasDeprecationInReadme: true }),
    );

    expect(maintainedWithReadme.confidence).toBe('at-risk');
    expect(maintainedWithReadme.signals).toContainEqual({
      type: 'deprecated-flag',
      severity: 'warning',
      description: 'README contains deprecation or unmaintained language',
    });

    const atRiskWithReadme = detectAbandonment(
      baseDependency,
      npmMeta({ lastModified: monthsAgo(18) }),
      ghData({
        lastCommitDate: monthsAgo(18),
        lastReleaseDate: monthsAgo(1),
        hasDeprecationInReadme: true,
      }),
    );

    expect(atRiskWithReadme.confidence).toBe('likely-abandoned');
    expect(atRiskWithReadme.signals).toContainEqual({
      type: 'deprecated-flag',
      severity: 'warning',
      description: 'README contains deprecation or unmaintained language',
    });
  });

  it('does not let README deprecation alone reach likely-abandoned without other stale signals', () => {
    const verdict = detectAbandonment(
      baseDependency,
      npmMeta(),
      ghData({
        lastCommitDate: monthsAgo(1),
        lastReleaseDate: monthsAgo(1),
        hasDeprecationInReadme: true,
      }),
    );

    expect(verdict.confidence).toBe('at-risk');
    expect(verdict.signals).toHaveLength(1);
  });

  it('marks recent activity as maintained with no abandonment signals', () => {
    const verdict = detectAbandonment(
      baseDependency,
      npmMeta(),
      ghData({
        lastCommitDate: monthsAgo(6),
        lastReleaseDate: monthsAgo(6),
      }),
    );

    expect(verdict.confidence).toBe('maintained');
    expect(verdict.signals).toEqual([]);
    expect(verdict.lastChecked).toBe(AS_OF.toISOString());
  });
});

describe('detectAbandonment for PyPI packages', () => {
  const pypiDependency: Dependency = {
    name: 'example-py-pkg',
    currentVersion: '1.0.0',
    isDirect: true,
    isDev: false,
    ecosystem: 'pypi',
  };

  const INACTIVE_CLASSIFIER = 'Development Status :: 7 - Inactive';

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(AS_OF);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('treats the inactive classifier identically to npm deprecation, skipping time heuristics', () => {
    const verdict = detectAbandonment(
      pypiDependency,
      npmMeta({
        deprecated: INACTIVE_CLASSIFIER,
        explicitDeprecationSignal: true,
      }),
      ghData({
        lastCommitDate: monthsAgo(1),
        lastReleaseDate: monthsAgo(1),
      }),
    );

    expect(verdict.confidence).toBe('likely-abandoned');
    expect(verdict.signals).toEqual([
      {
        type: 'deprecated-flag',
        severity: 'critical',
        description: `Package marked inactive on PyPI: ${INACTIVE_CLASSIFIER}`,
      },
    ]);
  });

  it('returns insufficient-data with a no-github-link signal when PyPI metadata has no GitHub repo', () => {
    const verdict = detectAbandonment(
      pypiDependency,
      npmMeta({ ownerRepo: null, lastModified: monthsAgo(120) }),
      null,
    );

    expect(verdict.confidence).toBe('insufficient-data');
    expect(verdict.signals).toEqual([
      {
        type: 'no-github-link',
        severity: 'warning',
        description:
          'No GitHub repository could be resolved from PyPI metadata; activity cannot be assessed',
      },
    ]);
  });

  it('trusts recent GitHub activity over PyPI upload staleness', () => {
    const verdict = detectAbandonment(
      pypiDependency,
      npmMeta({ lastModified: monthsAgo(60) }),
      ghData({
        lastCommitDate: monthsAgo(2),
        lastReleaseDate: monthsAgo(3),
      }),
    );

    expect(verdict.confidence).toBe('maintained');
    expect(verdict.signals).toEqual([]);
  });
});
