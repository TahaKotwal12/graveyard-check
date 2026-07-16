/**
 * Browser port of the CLI's registry clients and abandonment detector
 * (src/lib/npm-registry-client.ts, pypi-registry-client.ts,
 * abandonment-detector.ts). Same signals and thresholds, minus the README
 * deprecation scan — that would cost an extra GitHub API request per check
 * and the browser shares an unauthenticated 60 req/hour rate limit per IP.
 */

export type Ecosystem = 'npm' | 'pypi';

export type Confidence = 'maintained' | 'at-risk' | 'likely-abandoned' | 'insufficient-data';

export interface Signal {
  severity: 'info' | 'warning' | 'critical';
  description: string;
}

export interface CheckResult {
  name: string;
  ecosystem: Ecosystem;
  latestVersion: string;
  confidence: Confidence;
  signals: Signal[];
  registryUrl: string;
  repositoryUrl: string | null;
  /** True when GitHub rate-limiting prevented assessing repo activity. */
  rateLimited: boolean;
}

interface RegistryMetadata {
  name: string;
  latestVersion: string;
  lastModified: Date;
  deprecated: string | null;
  repositoryUrl: string | null;
  ownerRepo: string | null;
}

interface GitHubData {
  lastCommitDate: Date;
  lastReleaseDate: Date | null;
  isArchived: boolean;
}

const MONTHS_MS = 1000 * 60 * 60 * 24 * 30.4375;
const INACTIVE_CLASSIFIER = 'Development Status :: 7 - Inactive';
const PROJECT_URL_KEYS = ['Homepage', 'Repository', 'Source', 'Source Code'];

export class PackageNotFoundError extends Error {
  constructor(name: string, ecosystem: Ecosystem) {
    super(`"${name}" was not found on ${ecosystem === 'npm' ? 'the npm registry' : 'PyPI'}.`);
    this.name = 'PackageNotFoundError';
  }
}

export async function checkPackage(name: string, ecosystem: Ecosystem): Promise<CheckResult> {
  const meta = ecosystem === 'npm' ? await fetchNpmMetadata(name) : await fetchPypiMetadata(name);

  if (!meta) {
    throw new PackageNotFoundError(name, ecosystem);
  }

  let ghData: GitHubData | null = null;
  let rateLimited = false;

  if (meta.ownerRepo) {
    const gh = await fetchGitHubData(meta.ownerRepo);
    ghData = gh.data;
    rateLimited = gh.rateLimited;
  }

  const { confidence, signals } = detect(ecosystem, meta, ghData, rateLimited);

  return {
    name: meta.name,
    ecosystem,
    latestVersion: meta.latestVersion,
    confidence,
    signals,
    registryUrl:
      ecosystem === 'npm'
        ? `https://www.npmjs.com/package/${encodeURIComponent(meta.name)}`
        : `https://pypi.org/project/${encodeURIComponent(meta.name)}/`,
    repositoryUrl: meta.repositoryUrl,
    rateLimited,
  };
}

/* --- Detector (mirrors src/lib/abandonment-detector.ts) ------------------ */

const ARCHIVED_SIGNAL: Signal = {
  severity: 'critical',
  description: 'GitHub repository is archived (read-only)',
};

function detect(
  ecosystem: Ecosystem,
  meta: RegistryMetadata,
  ghData: GitHubData | null,
  rateLimited: boolean,
): { confidence: Confidence; signals: Signal[] } {
  if (meta.deprecated !== null) {
    const signals: Signal[] = [
      {
        severity: 'critical',
        description:
          ecosystem === 'pypi'
            ? `Package marked inactive on PyPI: ${meta.deprecated}`
            : `Package deprecated on npm: ${meta.deprecated}`,
      },
      ...(ghData?.isArchived ? [ARCHIVED_SIGNAL] : []),
    ];
    return { confidence: 'likely-abandoned', signals };
  }

  if (!ghData) {
    return {
      confidence: 'insufficient-data',
      signals: [buildNoGitHubSignal(ecosystem, meta, rateLimited)],
    };
  }

  if (ghData.isArchived) {
    return { confidence: 'likely-abandoned', signals: [ARCHIVED_SIGNAL] };
  }

  return assessActivity(meta, ghData);
}

function assessActivity(
  meta: RegistryMetadata,
  ghData: GitHubData,
): { confidence: Confidence; signals: Signal[] } {
  const asOf = new Date();
  const commitMonths = monthsBetween(ghData.lastCommitDate, asOf);
  const releaseMonths = monthsBetween(ghData.lastReleaseDate ?? meta.lastModified, asOf);

  const commitSignal: Signal = {
    severity: commitMonths >= 24 ? 'critical' : 'warning',
    description: `No commits in ${formatDuration(commitMonths)}`,
  };
  const releaseSignal: Signal = {
    severity: releaseMonths >= 24 ? 'critical' : 'warning',
    description: `No release in ${formatDuration(releaseMonths)}`,
  };

  if (commitMonths >= 24 && releaseMonths >= 24) {
    return { confidence: 'likely-abandoned', signals: [commitSignal, releaseSignal] };
  }

  if (commitMonths >= 12 || releaseMonths >= 12) {
    const signals = [
      ...(commitMonths >= 12 ? [commitSignal] : []),
      ...(releaseMonths >= 12 ? [releaseSignal] : []),
    ];
    return { confidence: 'at-risk', signals };
  }

  return {
    confidence: 'maintained',
    signals: [
      {
        severity: 'info',
        description: 'Recent repository and release activity — no abandonment signals detected',
      },
    ],
  };
}

function buildNoGitHubSignal(
  ecosystem: Ecosystem,
  meta: RegistryMetadata,
  rateLimited: boolean,
): Signal {
  if (rateLimited) {
    return {
      severity: 'warning',
      description:
        'GitHub API rate limit reached from your network — activity could not be assessed. Try again later, or run the CLI with a GITHUB_TOKEN.',
    };
  }

  if (ecosystem === 'pypi' && !meta.ownerRepo) {
    return {
      severity: 'warning',
      description:
        'No GitHub repository could be resolved from PyPI metadata; activity cannot be assessed',
    };
  }

  return {
    severity: 'warning',
    description: meta.ownerRepo
      ? `GitHub repository ${meta.ownerRepo} could not be found or accessed`
      : 'No GitHub repository URL is listed for this package',
  };
}

function monthsBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / MONTHS_MS;
}

function formatDuration(months: number): string {
  if (months >= 12) {
    return `${(months / 12).toFixed(1)} years`;
  }
  return `${Math.round(months)} months`;
}

/* --- npm registry --------------------------------------------------------- */

interface NpmRepositoryField {
  url?: string;
}

interface NpmRegistryResponse {
  name?: string;
  'dist-tags'?: { latest?: string };
  time?: { modified?: string };
  repository?: string | NpmRepositoryField;
  versions?: Record<string, { deprecated?: string; repository?: string | NpmRepositoryField }>;
}

async function fetchNpmMetadata(name: string): Promise<RegistryMetadata | null> {
  const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}`);
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`npm registry request failed: ${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as NpmRegistryResponse;
  const latestVersion = payload['dist-tags']?.latest;
  const modified = payload.time?.modified;
  if (!payload.name || !latestVersion || !modified) {
    throw new Error('npm registry returned incomplete metadata');
  }

  const latest = payload.versions?.[latestVersion];
  const repositoryUrl =
    extractRepositoryUrl(latest?.repository) ?? extractRepositoryUrl(payload.repository);

  return {
    name: payload.name,
    latestVersion,
    lastModified: new Date(modified),
    deprecated: typeof latest?.deprecated === 'string' ? latest.deprecated : null,
    repositoryUrl,
    ownerRepo: parseRepositoryOwnerRepo(repositoryUrl),
  };
}

function extractRepositoryUrl(repository: string | NpmRepositoryField | undefined): string | null {
  if (!repository) return null;
  if (typeof repository === 'string') return repository;
  return typeof repository.url === 'string' ? repository.url : null;
}

/* --- PyPI ------------------------------------------------------------------ */

interface PypiRegistryResponse {
  info?: {
    name?: string;
    version?: string;
    project_urls?: Record<string, string | null> | null;
    classifiers?: string[];
  };
  releases?: Record<string, { upload_time?: string }[]>;
}

async function fetchPypiMetadata(name: string): Promise<RegistryMetadata | null> {
  const response = await fetch(`https://pypi.org/pypi/${encodeURIComponent(name)}/json`);
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`PyPI request failed: ${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as PypiRegistryResponse;
  const packageName = payload.info?.name;
  const latestVersion = payload.info?.version;
  const uploadTime = latestVersion
    ? payload.releases?.[latestVersion]?.[0]?.upload_time
    : undefined;
  if (!packageName || !latestVersion || !uploadTime) {
    throw new Error('PyPI returned incomplete metadata');
  }

  const classifiers = payload.info?.classifiers ?? [];
  const deprecated = classifiers.includes(INACTIVE_CLASSIFIER) ? INACTIVE_CLASSIFIER : null;

  let repositoryUrl: string | null = null;
  let ownerRepo: string | null = null;
  const projectUrls = payload.info?.project_urls;
  if (projectUrls) {
    for (const key of PROJECT_URL_KEYS) {
      const url = projectUrls[key];
      if (typeof url !== 'string') continue;
      const parsed = parseRepositoryOwnerRepo(url);
      if (parsed) {
        repositoryUrl = url;
        ownerRepo = parsed;
        break;
      }
    }
  }

  return {
    name: packageName,
    latestVersion,
    lastModified: new Date(uploadTime),
    deprecated,
    repositoryUrl,
    ownerRepo,
  };
}

/* --- GitHub ----------------------------------------------------------------- */

async function fetchGitHubData(
  ownerRepo: string,
): Promise<{ data: GitHubData | null; rateLimited: boolean }> {
  let repoResponse: Response;
  try {
    repoResponse = await fetch(`https://api.github.com/repos/${ownerRepo}`, {
      headers: { Accept: 'application/vnd.github+json' },
    });
  } catch {
    return { data: null, rateLimited: false };
  }

  if (repoResponse.status === 403 || repoResponse.status === 429) {
    return { data: null, rateLimited: true };
  }
  if (!repoResponse.ok) {
    return { data: null, rateLimited: false };
  }

  const repo = (await repoResponse.json()) as { pushed_at?: string; archived?: boolean };
  if (!repo.pushed_at) {
    return { data: null, rateLimited: false };
  }

  let lastReleaseDate: Date | null = null;
  try {
    const releaseResponse = await fetch(
      `https://api.github.com/repos/${ownerRepo}/releases/latest`,
      { headers: { Accept: 'application/vnd.github+json' } },
    );
    if (releaseResponse.ok) {
      const release = (await releaseResponse.json()) as { published_at?: string };
      if (release.published_at) {
        lastReleaseDate = new Date(release.published_at);
      }
    }
  } catch {
    // Release info is optional; the registry's lastModified covers the fallback.
  }

  return {
    data: {
      lastCommitDate: new Date(repo.pushed_at),
      lastReleaseDate,
      isArchived: repo.archived === true,
    },
    rateLimited: false,
  };
}

export function parseRepositoryOwnerRepo(repositoryUrl: string | null): string | null {
  if (!repositoryUrl) return null;

  const trimmed = repositoryUrl.trim();

  if (trimmed.startsWith('github:')) {
    const shorthand = trimmed.slice('github:'.length).replace(/\.git$/i, '');
    return isValidOwnerRepo(shorthand) ? shorthand : null;
  }

  const sshMatch = /^git@github\.com:([^/]+\/[^#?]+?)(?:\.git)?$/i.exec(trimmed);
  if (sshMatch) {
    const ownerRepo = sshMatch[1].replace(/\.git$/i, '');
    return isValidOwnerRepo(ownerRepo) ? ownerRepo : null;
  }

  const normalized = trimmed
    .replace(/^git\+/, '')
    .replace(/^git:\/\//, 'https://')
    .replace(/^git@github\.com\//, 'https://github.com/');

  try {
    const parsed = new URL(normalized);
    if (parsed.hostname.toLowerCase() !== 'github.com') return null;

    const [owner, repoWithSuffix] = parsed.pathname.split('/').filter(Boolean);
    if (!owner || !repoWithSuffix) return null;

    const repo = repoWithSuffix.replace(/\.git$/i, '');
    const ownerRepo = `${owner}/${repo}`;
    return isValidOwnerRepo(ownerRepo) ? ownerRepo : null;
  } catch {
    return null;
  }
}

function isValidOwnerRepo(ownerRepo: string): boolean {
  const slashIndex = ownerRepo.indexOf('/');
  return slashIndex > 0 && slashIndex < ownerRepo.length - 1;
}
