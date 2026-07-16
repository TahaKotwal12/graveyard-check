import type { AbandonmentSignal, AbandonmentVerdict, Dependency } from '../types.js';

/**
 * Ecosystem-agnostic registry metadata consumed by the detector.
 *
 * `explicitDeprecationSignal` unifies each registry's maintainer-declared
 * deprecation: npm sets it from the native `deprecated` field, PyPI from the
 * "Development Status :: 7 - Inactive" trove classifier. Both carry equal
 * weight — each is a deliberate maintainer declaration. When the field is
 * omitted it is derived from `deprecated` being non-null, so existing npm
 * callers keep working unchanged.
 */
export interface RegistryMetadata {
  /** Human-readable deprecation message or classifier, if any. */
  deprecated: string | null;
  /** Maintainer-declared deprecation, regardless of how the registry expresses it. */
  explicitDeprecationSignal?: boolean;
  lastModified: Date;
  ownerRepo: string | null;
}

/** @deprecated Use {@link RegistryMetadata}; kept as an alias for npm-path callers. */
export type NpmMetadata = RegistryMetadata;

export interface GitHubData {
  lastCommitDate: Date;
  lastReleaseDate: Date | null;
  isArchived: boolean;
  hasDeprecationInReadme: boolean;
}

type Confidence = AbandonmentVerdict['confidence'];

const MONTHS_MS = 1000 * 60 * 60 * 24 * 30.4375;

export function detectAbandonment(
  dep: Dependency,
  meta: RegistryMetadata,
  ghData: GitHubData | null,
): AbandonmentVerdict {
  const asOf = new Date();
  const explicitlyDeprecated = meta.explicitDeprecationSignal ?? meta.deprecated !== null;
  if (explicitlyDeprecated) {
    return buildDeprecatedVerdict(dep, meta, ghData, asOf);
  }

  if (!ghData) {
    return {
      dependency: dep,
      confidence: 'insufficient-data',
      signals: [buildNoGitHubDataSignal(dep, meta)],
      lastChecked: asOf.toISOString(),
    };
  }

  const signals: AbandonmentSignal[] = [];
  let confidence: Confidence = 'maintained';

  if (ghData.isArchived) {
    signals.push({
      type: 'maintainer-inactive',
      severity: 'critical',
      description: 'GitHub repository is archived (read-only)',
    });
    confidence = 'likely-abandoned';
  } else {
    const commitMonths = monthsBetween(ghData.lastCommitDate, asOf);
    const releaseMonths = monthsBetween(ghData.lastReleaseDate ?? meta.lastModified, asOf);

    if (commitMonths >= 24 && releaseMonths >= 24) {
      signals.push({
        type: 'no-commits',
        severity: 'critical',
        description: `No commits in ${formatDuration(commitMonths)}`,
      });
      signals.push({
        type: 'no-release',
        severity: 'critical',
        description: `No release in ${formatDuration(releaseMonths)}`,
      });
      confidence = 'likely-abandoned';
    } else if (commitMonths >= 12 || releaseMonths >= 12) {
      if (commitMonths >= 12) {
        signals.push({
          type: 'no-commits',
          severity: commitMonths >= 24 ? 'critical' : 'warning',
          description: `No commits in ${formatDuration(commitMonths)}`,
        });
      }

      if (releaseMonths >= 12) {
        signals.push({
          type: 'no-release',
          severity: releaseMonths >= 24 ? 'critical' : 'warning',
          description: `No release in ${formatDuration(releaseMonths)}`,
        });
      }

      confidence = 'at-risk';
    }
  }

  if (ghData.hasDeprecationInReadme) {
    signals.push({
      type: 'deprecated-flag',
      severity: 'warning',
      description: 'README contains deprecation or unmaintained language',
    });
    confidence = bumpConfidence(confidence);
  }

  return {
    dependency: dep,
    confidence,
    signals,
    lastChecked: asOf.toISOString(),
  };
}

/**
 * Older PyPI packages frequently list no GitHub repository at all (many predate
 * GitHub), so that case gets an explicit `no-github-link` signal instead of
 * being silently skipped or scored as maintained.
 */
function buildNoGitHubDataSignal(dep: Dependency, meta: RegistryMetadata): AbandonmentSignal {
  if (dep.ecosystem === 'pypi' && !meta.ownerRepo) {
    return {
      type: 'no-github-link',
      severity: 'warning',
      description:
        'No GitHub repository could be resolved from PyPI metadata; activity cannot be assessed',
    };
  }

  return {
    type: 'maintainer-inactive',
    severity: 'warning',
    description: meta.ownerRepo
      ? `GitHub repository ${meta.ownerRepo} could not be found or accessed`
      : 'No GitHub repository URL is listed for this package',
  };
}

function buildDeprecatedVerdict(
  dep: Dependency,
  meta: RegistryMetadata,
  ghData: GitHubData | null,
  asOf: Date,
): AbandonmentVerdict {
  const signals: AbandonmentSignal[] = [
    {
      type: 'deprecated-flag',
      severity: 'critical',
      description:
        dep.ecosystem === 'pypi'
          ? `Package marked inactive on PyPI: ${meta.deprecated}`
          : `Package deprecated on npm: ${meta.deprecated}`,
    },
  ];

  if (ghData?.isArchived) {
    signals.push({
      type: 'maintainer-inactive',
      severity: 'critical',
      description: 'GitHub repository is archived (read-only)',
    });
  }

  return {
    dependency: dep,
    confidence: 'likely-abandoned',
    signals,
    lastChecked: asOf.toISOString(),
  };
}

function monthsBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / MONTHS_MS;
}

export function formatDuration(months: number): string {
  if (months >= 12) {
    return `${(months / 12).toFixed(1)} years`;
  }

  return `${Math.round(months)} months`;
}

function bumpConfidence(confidence: Confidence): Confidence {
  if (confidence === 'maintained') {
    return 'at-risk';
  }

  if (confidence === 'at-risk') {
    return 'likely-abandoned';
  }

  return confidence;
}
