import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearNpmRegistryCache,
  getPackageMetadata,
  parseRepositoryOwnerRepo,
} from '../src/lib/npm-registry-client.js';

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

describe('parseRepositoryOwnerRepo', () => {
  it('parses common GitHub repository URL formats', () => {
    expect(parseRepositoryOwnerRepo('git+https://github.com/request/request.git')).toBe(
      'request/request',
    );
    expect(parseRepositoryOwnerRepo('git://github.com/sindresorhus/got.git')).toBe(
      'sindresorhus/got',
    );
    expect(parseRepositoryOwnerRepo('github:lodash/lodash')).toBe('lodash/lodash');
    expect(parseRepositoryOwnerRepo('git@github.com:visionmedia/debug.js.git')).toBe(
      'visionmedia/debug.js',
    );
  });

  it('returns null for malformed or non-GitHub repository URLs', () => {
    expect(parseRepositoryOwnerRepo('not-a-valid-url')).toBeNull();
    expect(parseRepositoryOwnerRepo('https://gitlab.com/foo/bar')).toBeNull();
    expect(parseRepositoryOwnerRepo('')).toBeNull();
  });
});

describe('getPackageMetadata', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    clearNpmRegistryCache();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns metadata for a normal package', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        name: 'debug',
        'dist-tags': { latest: '4.3.7' },
        time: { modified: '2024-09-20T18:42:11.123Z' },
        repository: {
          type: 'git',
          url: 'git://github.com/debug-js/debug.git',
        },
        versions: {
          '4.3.7': {
            repository: {
              type: 'git',
              url: 'git://github.com/debug-js/debug.git',
            },
          },
        },
      }),
    );

    const metadata = await getPackageMetadata('debug');

    expect(metadata).toEqual({
      name: 'debug',
      latestVersion: '4.3.7',
      lastModified: new Date('2024-09-20T18:42:11.123Z'),
      deprecated: null,
      repositoryUrl: 'git://github.com/debug-js/debug.git',
      ownerRepo: 'debug-js/debug',
    });
  });

  it('surfaces npm native deprecation on the latest version', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        name: 'request',
        'dist-tags': { latest: '2.88.2' },
        time: { modified: '2020-03-11T22:03:47.448Z' },
        repository: {
          type: 'git',
          url: 'git+https://github.com/request/request.git',
        },
        versions: {
          '2.88.2': {
            deprecated:
              'request has been deprecated, see https://github.com/request/request/issues/3142',
            repository: {
              type: 'git',
              url: 'git+https://github.com/request/request.git',
            },
          },
        },
      }),
    );

    const metadata = await getPackageMetadata('request');

    expect(metadata?.deprecated).toBe(
      'request has been deprecated, see https://github.com/request/request/issues/3142',
    );
    expect(metadata?.ownerRepo).toBe('request/request');
  });

  it('returns null ownerRepo for malformed repository fields without failing', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        name: 'weird-repo',
        'dist-tags': { latest: '1.0.0' },
        time: { modified: '2024-01-01T00:00:00.000Z' },
        repository: 'totally-not-parseable',
        versions: {
          '1.0.0': {
            repository: { url: 123 },
          },
        },
      }),
    );

    const metadata = await getPackageMetadata('weird-repo');

    expect(metadata).toEqual({
      name: 'weird-repo',
      latestVersion: '1.0.0',
      lastModified: new Date('2024-01-01T00:00:00.000Z'),
      deprecated: null,
      repositoryUrl: 'totally-not-parseable',
      ownerRepo: null,
    });
  });

  it('returns null when the package is not found', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'Not found' }, { status: 404 }));

    await expect(getPackageMetadata('this-package-does-not-exist')).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reuses the in-memory cache for repeated lookups', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        name: 'cached-pkg',
        'dist-tags': { latest: '1.0.0' },
        time: { modified: '2024-01-01T00:00:00.000Z' },
        versions: {
          '1.0.0': {},
        },
      }),
    );

    await getPackageMetadata('cached-pkg');
    await getPackageMetadata('cached-pkg');

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
