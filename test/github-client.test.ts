import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearGitHubClientCache,
  fetchRepoActivity,
} from '../src/lib/github-client.js';

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return new Response(JSON.stringify(body), {
    ...init,
    headers,
  });
}

function encodeReadme(content: string): string {
  return Buffer.from(content, 'utf8').toString('base64');
}

describe('fetchRepoActivity', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    clearGitHubClientCache();
    vi.stubGlobal('fetch', fetchMock);
    delete process.env.GITHUB_TOKEN;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns repo activity for a successful response', async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);

      if (url.endsWith('/repos/acme/widget')) {
        return jsonResponse({
          archived: false,
          open_issues_count: 17,
        });
      }

      if (url.endsWith('/repos/acme/widget/commits?per_page=1')) {
        return jsonResponse([
          {
            commit: {
              committer: { date: '2024-05-10T12:00:00Z' },
              author: { date: '2024-05-10T12:00:00Z' },
            },
          },
        ]);
      }

      if (url.endsWith('/repos/acme/widget/releases/latest')) {
        return jsonResponse({
          published_at: '2023-11-01T08:30:00Z',
          created_at: '2023-11-01T08:00:00Z',
        });
      }

      if (url.endsWith('/repos/acme/widget/readme')) {
        return jsonResponse({
          content: encodeReadme('# Widget\n\nActively maintained.'),
        });
      }

      throw new Error(`Unexpected fetch URL: ${url}`);
    });

    const activity = await fetchRepoActivity('acme/widget');

    expect(activity).toEqual({
      lastCommitDate: new Date('2024-05-10T12:00:00Z'),
      lastReleaseDate: new Date('2023-11-01T08:30:00Z'),
      openIssueCount: 17,
      isArchived: false,
      hasDeprecationInReadme: false,
    });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('returns null when the repository is not found', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'Not Found' }, { status: 404 }));

    await expect(fetchRepoActivity('acme/missing')).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws RateLimitError on a rate-limited response', async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        jsonResponse(
          { message: 'API rate limit exceeded for 127.0.0.1.' },
          {
            status: 403,
            headers: { 'x-ratelimit-remaining': '0' },
          },
        ),
      ),
    );

    await expect(fetchRepoActivity('acme/rate-limited')).rejects.toMatchObject({
      name: 'RateLimitError',
      message: expect.stringContaining('Set GITHUB_TOKEN in your environment'),
    });
  });

  it('reports archived repositories and deprecation language in the README', async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);

      if (url.endsWith('/repos/acme/old-lib')) {
        return jsonResponse({
          archived: true,
          open_issues_count: 480,
        });
      }

      if (url.endsWith('/repos/acme/old-lib/commits?per_page=1')) {
        return jsonResponse([
          {
            commit: {
              committer: { date: '2019-03-14T00:00:00Z' },
              author: { date: '2019-03-14T00:00:00Z' },
            },
          },
        ]);
      }

      if (url.endsWith('/repos/acme/old-lib/releases/latest')) {
        return jsonResponse({ message: 'Not Found' }, { status: 404 });
      }

      if (url.endsWith('/repos/acme/old-lib/readme')) {
        return jsonResponse({
          content: encodeReadme('# old-lib\n\nThis project is no longer maintained.'),
        });
      }

      throw new Error(`Unexpected fetch URL: ${url}`);
    });

    const activity = await fetchRepoActivity('acme/old-lib');

    expect(activity).toEqual({
      lastCommitDate: new Date('2019-03-14T00:00:00Z'),
      lastReleaseDate: null,
      openIssueCount: 480,
      isArchived: true,
      hasDeprecationInReadme: true,
    });
  });

  it('reuses the in-memory cache for repeated lookups', async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);

      if (url.endsWith('/repos/acme/cached')) {
        return jsonResponse({
          archived: false,
          open_issues_count: 1,
        });
      }

      if (url.endsWith('/repos/acme/cached/commits?per_page=1')) {
        return jsonResponse([
          {
            commit: {
              committer: { date: '2024-01-01T00:00:00Z' },
              author: { date: '2024-01-01T00:00:00Z' },
            },
          },
        ]);
      }

      if (url.endsWith('/repos/acme/cached/releases/latest')) {
        return jsonResponse({ message: 'Not Found' }, { status: 404 });
      }

      if (url.endsWith('/repos/acme/cached/readme')) {
        return jsonResponse({
          content: encodeReadme('# cached'),
        });
      }

      throw new Error(`Unexpected fetch URL: ${url}`);
    });

    await fetchRepoActivity('acme/cached');
    await fetchRepoActivity('acme/cached');

    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('sends Authorization when GITHUB_TOKEN is set', async () => {
    process.env.GITHUB_TOKEN = 'test-token';

    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input);
      const headers = new Headers(init?.headers);

      expect(headers.get('Authorization')).toBe('Bearer test-token');

      if (url.endsWith('/repos/acme/auth-test')) {
        return jsonResponse({
          archived: false,
          open_issues_count: 0,
        });
      }

      if (url.endsWith('/repos/acme/auth-test/commits?per_page=1')) {
        return jsonResponse([
          {
            commit: {
              committer: { date: '2024-01-01T00:00:00Z' },
              author: { date: '2024-01-01T00:00:00Z' },
            },
          },
        ]);
      }

      if (url.endsWith('/repos/acme/auth-test/releases/latest')) {
        return jsonResponse({ message: 'Not Found' }, { status: 404 });
      }

      if (url.endsWith('/repos/acme/auth-test/readme')) {
        return jsonResponse({
          content: encodeReadme('# auth-test'),
        });
      }

      throw new Error(`Unexpected fetch URL: ${url}`);
    });

    await fetchRepoActivity('acme/auth-test');
    expect(fetchMock).toHaveBeenCalled();
  });
});
