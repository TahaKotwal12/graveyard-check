import type {
  AbandonmentSignal,
  AbandonmentVerdict,
  Dependency,
} from '../types.js';

export interface NpmMetadata {
  deprecated: string | null;
  lastModified: Date;
  ownerRepo: string | null;
}

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
  npmMeta: NpmMetadata,
  ghData: GitHubData | null,
): AbandonmentVerdict {
  const asOf = new Date();
  if (npmMeta.deprecated) {
    return buildDeprecatedVerdict(dep, npmMeta, ghData, asOf);
  }

  if (!ghData) {
    return {
      dependency: dep,
      confidence: 'insufficient-data',
      signals: [
        {
          type: 'maintainer-inactive',
          severity: 'warning',
          description: npmMeta.ownerRepo
            ? `GitHub repository ${npmMeta.ownerRepo} could not be found or accessed`
            : 'No GitHub repository URL is listed for this package',
        },
      ],
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
    const releaseMonths = monthsBetween(ghData.lastReleaseDate ?? npmMeta.lastModified, asOf);

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

function buildDeprecatedVerdict(
  dep: Dependency,
  npmMeta: NpmMetadata,
  ghData: GitHubData | null,
  asOf: Date,
): AbandonmentVerdict {
  const signals: AbandonmentSignal[] = [
    {
      type: 'deprecated-flag',
      severity: 'critical',
      description: `Package deprecated on npm: ${npmMeta.deprecated}`,
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
