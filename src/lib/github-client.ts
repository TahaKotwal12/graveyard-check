const GITHUB_API_BASE = 'https://api.github.com';
const USER_AGENT = 'graveyard-check-cli';

const DEPRECATION_PATTERN = /deprecated|no longer maintained|unmaintained/i;

export interface GitHubRepoActivity {
  lastCommitDate: Date;
  lastReleaseDate: Date | null;
  openIssueCount: number;
  isArchived: boolean;
  hasDeprecationInReadme: boolean;
}

export class RateLimitError extends Error {
  override readonly name = 'RateLimitError';

  constructor(
    message = 'GitHub API rate limit exceeded. Set GITHUB_TOKEN in your environment to raise the limit.',
  ) {
    super(message);
  }
}

interface GitHubRepoResponse {
  archived: boolean;
  open_issues_count: number;
}

interface GitHubCommitResponse {
  commit: {
    committer: {
      date: string;
    } | null;
    author: {
      date: string;
    } | null;
  };
}

interface GitHubReleaseResponse {
  published_at: string | null;
  created_at: string;
}

interface GitHubReadmeResponse {
  content: string;
}

interface GitHubErrorResponse {
  message?: string;
}

const repoActivityCache = new Map<string, GitHubRepoActivity | null>();

export function clearGitHubClientCache(): void {
  repoActivityCache.clear();
}

export function parseOwnerRepo(ownerRepo: string): { owner: string; repo: string } | null {
  const trimmed = ownerRepo.trim();
  const slashIndex = trimmed.indexOf('/');
  if (slashIndex <= 0 || slashIndex === trimmed.length - 1) {
    return null;
  }

  return {
    owner: trimmed.slice(0, slashIndex),
    repo: trimmed.slice(slashIndex + 1),
  };
}

export async function fetchRepoActivity(ownerRepo: string): Promise<GitHubRepoActivity | null> {
  const cacheKey = ownerRepo.trim().toLowerCase();
  if (repoActivityCache.has(cacheKey)) {
    return repoActivityCache.get(cacheKey) ?? null;
  }

  const parsed = parseOwnerRepo(ownerRepo);
  if (!parsed) {
    throw new Error(`Invalid GitHub repository identifier: "${ownerRepo}"`);
  }

  const { owner, repo: repoName } = parsed;
  const repoUrl = `${GITHUB_API_BASE}/repos/${owner}/${repoName}`;

  const repoResponse = await githubFetch(repoUrl);
  if (repoResponse.status === 404) {
    repoActivityCache.set(cacheKey, null);
    return null;
  }

  const repoBody = await parseJsonResponse<GitHubRepoResponse | GitHubErrorResponse>(repoResponse);
  if (isRateLimited(repoResponse, repoBody)) {
    throw new RateLimitError();
  }

  if (!repoResponse.ok) {
    throw new Error(
      `GitHub API request failed for ${owner}/${repoName}: ${repoResponse.status} ${repoResponse.statusText}`,
    );
  }

  const repoMetadata = repoBody as GitHubRepoResponse;

  const [commits, latestRelease, readme] = await Promise.all([
    fetchCommits(owner, repoName),
    fetchLatestRelease(owner, repoName),
    fetchReadme(owner, repoName),
  ]);

  const activity: GitHubRepoActivity = {
    lastCommitDate: commits.lastCommitDate,
    lastReleaseDate: latestRelease,
    openIssueCount: repoMetadata.open_issues_count,
    isArchived: repoMetadata.archived,
    hasDeprecationInReadme: readme,
  };

  repoActivityCache.set(cacheKey, activity);
  return activity;
}

function getGitHubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': USER_AGENT,
    'X-GitHub-Api-Version': '2022-11-28',
  };

  const token = process.env.GITHUB_TOKEN;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

async function githubFetch(url: string): Promise<Response> {
  try {
    return await fetch(url, { headers: getGitHubHeaders() });
  } catch (error) {
    throw new Error(
      `Could not reach the GitHub API (${(error as Error).message}). ` +
        'Check your internet connection and proxy settings, then retry.',
    );
  }
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

function isRateLimited(response: Response, body: unknown): boolean {
  if (response.status !== 403) {
    return false;
  }

  const remaining = response.headers.get('x-ratelimit-remaining');
  if (remaining === '0') {
    return true;
  }

  const message = (body as GitHubErrorResponse).message;
  return message?.toLowerCase().includes('rate limit') ?? false;
}

async function fetchCommits(owner: string, repo: string): Promise<{ lastCommitDate: Date }> {
  const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/commits?per_page=1`;
  const response = await githubFetch(url);
  const body = await parseJsonResponse<GitHubCommitResponse[] | GitHubErrorResponse>(response);

  if (isRateLimited(response, body)) {
    throw new RateLimitError();
  }

  if (!response.ok) {
    throw new Error(
      `GitHub API request failed for ${owner}/${repo} commits: ${response.status} ${response.statusText}`,
    );
  }

  const commits = body as GitHubCommitResponse[];
  const latestCommit = commits[0];
  const commitDate =
    latestCommit?.commit.committer?.date ?? latestCommit?.commit.author?.date ?? null;

  if (!commitDate) {
    throw new Error(`GitHub returned no commits for ${owner}/${repo}`);
  }

  return { lastCommitDate: new Date(commitDate) };
}

async function fetchLatestRelease(owner: string, repo: string): Promise<Date | null> {
  const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/releases/latest`;
  const response = await githubFetch(url);

  if (response.status === 404) {
    return null;
  }

  const body = await parseJsonResponse<GitHubReleaseResponse | GitHubErrorResponse>(response);
  if (isRateLimited(response, body)) {
    throw new RateLimitError();
  }

  if (!response.ok) {
    throw new Error(
      `GitHub API request failed for ${owner}/${repo} releases: ${response.status} ${response.statusText}`,
    );
  }

  const release = body as GitHubReleaseResponse;
  const releaseDate = release.published_at ?? release.created_at;
  return releaseDate ? new Date(releaseDate) : null;
}

async function fetchReadme(owner: string, repo: string): Promise<boolean> {
  const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/readme`;
  const response = await githubFetch(url);

  if (response.status === 404) {
    return false;
  }

  const body = await parseJsonResponse<GitHubReadmeResponse | GitHubErrorResponse>(response);
  if (isRateLimited(response, body)) {
    throw new RateLimitError();
  }

  if (!response.ok) {
    throw new Error(
      `GitHub API request failed for ${owner}/${repo} readme: ${response.status} ${response.statusText}`,
    );
  }

  const readme = body as GitHubReadmeResponse;
  const decoded = Buffer.from(readme.content.replace(/\n/g, ''), 'base64').toString('utf8');
  return DEPRECATION_PATTERN.test(decoded);
}
