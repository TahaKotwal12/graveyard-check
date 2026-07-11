const NPM_REGISTRY_BASE = 'https://registry.npmjs.org';

export interface NpmPackageMetadata {
  name: string;
  latestVersion: string;
  lastModified: Date;
  /** Native npm deprecation message on the latest version, if present. */
  deprecated: string | null;
  repositoryUrl: string | null;
  /** Parsed GitHub `owner/repo`, when the repository URL can be normalized. */
  ownerRepo: string | null;
}

interface NpmRepositoryField {
  type?: string;
  url?: string;
  directory?: string;
}

interface NpmVersionMetadata {
  deprecated?: string;
  repository?: string | NpmRepositoryField;
}

interface NpmRegistryResponse {
  name?: string;
  'dist-tags'?: {
    latest?: string;
  };
  time?: {
    modified?: string;
  };
  repository?: string | NpmRepositoryField;
  versions?: Record<string, NpmVersionMetadata>;
}

const packageMetadataCache = new Map<string, NpmPackageMetadata | null>();

export function clearNpmRegistryCache(): void {
  packageMetadataCache.clear();
}

export async function getPackageMetadata(name: string): Promise<NpmPackageMetadata | null> {
  const cacheKey = name.trim().toLowerCase();
  if (packageMetadataCache.has(cacheKey)) {
    return packageMetadataCache.get(cacheKey) ?? null;
  }

  let response: Response;
  try {
    response = await fetch(`${NPM_REGISTRY_BASE}/${encodeURIComponent(name)}`);
  } catch (error) {
    throw new Error(
      `Could not reach the npm registry (${(error as Error).message}). ` +
        'Check your internet connection and proxy settings, then retry.',
    );
  }
  if (response.status === 404) {
    packageMetadataCache.set(cacheKey, null);
    return null;
  }

  if (!response.ok) {
    throw new Error(
      `npm registry request failed for ${name}: ${response.status} ${response.statusText}`,
    );
  }

  const payload = (await response.json()) as NpmRegistryResponse;
  const latestVersion = payload['dist-tags']?.latest;
  const modified = payload.time?.modified;

  if (!payload.name || !latestVersion || !modified) {
    throw new Error(`npm registry returned incomplete metadata for ${name}`);
  }

  const latestVersionMetadata = payload.versions?.[latestVersion];
  const repositoryUrl =
    extractRepositoryUrl(latestVersionMetadata?.repository) ??
    extractRepositoryUrl(payload.repository);
  const deprecated =
    typeof latestVersionMetadata?.deprecated === 'string'
      ? latestVersionMetadata.deprecated
      : null;

  const metadata: NpmPackageMetadata = {
    name: payload.name,
    latestVersion,
    lastModified: new Date(modified),
    deprecated,
    repositoryUrl,
    ownerRepo: parseRepositoryOwnerRepo(repositoryUrl),
  };

  packageMetadataCache.set(cacheKey, metadata);
  return metadata;
}

export function extractRepositoryUrl(
  repository: string | NpmRepositoryField | undefined,
): string | null {
  if (!repository) {
    return null;
  }

  if (typeof repository === 'string') {
    return repository;
  }

  return typeof repository.url === 'string' ? repository.url : null;
}

export function parseRepositoryOwnerRepo(repositoryUrl: string | null): string | null {
  if (!repositoryUrl) {
    return null;
  }

  const trimmed = repositoryUrl.trim();

  if (trimmed.startsWith('github:')) {
    const shorthand = trimmed.slice('github:'.length).replace(/\.git$/i, '');
    return isValidOwnerRepo(shorthand) ? shorthand : null;
  }

  const sshMatch = trimmed.match(/^git@github\.com:([^/]+\/[^#?]+?)(?:\.git)?$/i);
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
    if (parsed.hostname.toLowerCase() !== 'github.com') {
      return null;
    }

    const [owner, repoWithSuffix] = parsed.pathname.split('/').filter(Boolean);
    if (!owner || !repoWithSuffix) {
      return null;
    }

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
