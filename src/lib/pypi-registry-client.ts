import { parseRepositoryOwnerRepo } from './npm-registry-client.js';

const PYPI_REGISTRY_BASE = 'https://pypi.org/pypi';
const INACTIVE_CLASSIFIER = 'Development Status :: 7 - Inactive';
const PROJECT_URL_KEYS = ['Homepage', 'Repository', 'Source', 'Source Code'] as const;

export interface PypiPackageMetadata {
  name: string;
  latestVersion: string;
  lastModified: Date;
  /** PyPI's deprecation-equivalent inactive classifier, if present. */
  deprecated: string | null;
  /**
   * True when the inactive classifier is present. Equal in weight to npm's
   * `deprecated` flag — both are deliberate maintainer declarations.
   */
  explicitDeprecationSignal: boolean;
  repositoryUrl: string | null;
  /** Parsed GitHub `owner/repo`, when a project URL can be normalized. */
  ownerRepo: string | null;
  classifiers: string[];
}

interface PypiReleaseFile {
  upload_time?: string;
}

interface PypiRegistryResponse {
  info?: {
    name?: string;
    version?: string;
    project_urls?: Record<string, string | null> | null;
    classifiers?: string[];
  };
  releases?: Record<string, PypiReleaseFile[]>;
}

const packageMetadataCache = new Map<string, PypiPackageMetadata | null>();

export function clearPypiRegistryCache(): void {
  packageMetadataCache.clear();
}

export async function getPackageMetadata(name: string): Promise<PypiPackageMetadata | null> {
  const cacheKey = name.trim().toLowerCase();
  if (packageMetadataCache.has(cacheKey)) {
    return packageMetadataCache.get(cacheKey) ?? null;
  }

  let response: Response;
  try {
    response = await fetch(`${PYPI_REGISTRY_BASE}/${encodeURIComponent(name)}/json`);
  } catch (error) {
    throw new Error(
      `Could not reach the PyPI registry (${(error as Error).message}). ` +
        'Check your internet connection and proxy settings, then retry.',
    );
  }

  if (response.status === 404) {
    packageMetadataCache.set(cacheKey, null);
    return null;
  }

  if (!response.ok) {
    throw new Error(
      `PyPI registry request failed for ${name}: ${response.status} ${response.statusText}`,
    );
  }

  const payload = (await response.json()) as PypiRegistryResponse;
  const packageName = payload.info?.name;
  const latestVersion = payload.info?.version;
  const uploadTime = latestVersion
    ? payload.releases?.[latestVersion]?.[0]?.upload_time
    : undefined;

  if (!packageName || !latestVersion || !uploadTime) {
    throw new Error(`PyPI registry returned incomplete metadata for ${name}`);
  }

  const classifiers = payload.info?.classifiers ?? [];
  const repository = findGitHubProjectUrl(payload.info?.project_urls);
  const deprecated = classifiers.includes(INACTIVE_CLASSIFIER) ? INACTIVE_CLASSIFIER : null;

  const metadata: PypiPackageMetadata = {
    name: packageName,
    latestVersion,
    lastModified: new Date(uploadTime),
    deprecated,
    explicitDeprecationSignal: deprecated !== null,
    repositoryUrl: repository?.url ?? null,
    ownerRepo: repository?.ownerRepo ?? null,
    classifiers,
  };

  packageMetadataCache.set(cacheKey, metadata);
  return metadata;
}

function findGitHubProjectUrl(
  projectUrls: Record<string, string | null> | null | undefined,
): { url: string; ownerRepo: string } | null {
  if (!projectUrls) {
    return null;
  }

  for (const key of PROJECT_URL_KEYS) {
    const url = projectUrls[key];
    if (typeof url !== 'string') {
      continue;
    }

    const ownerRepo = parseRepositoryOwnerRepo(url);
    if (ownerRepo) {
      return { url, ownerRepo };
    }
  }

  return null;
}
