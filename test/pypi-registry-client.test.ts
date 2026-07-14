import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { detectAbandonment } from '../src/lib/abandonment-detector.js';
import {
  clearPypiRegistryCache,
  getPackageMetadata,
} from '../src/lib/pypi-registry-client.js';

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

describe('getPackageMetadata', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    clearPypiRegistryCache();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns metadata for a normal package and finds the first GitHub project URL', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        info: {
          name: 'requests',
          version: '2.32.4',
          project_urls: {
            Homepage: 'https://requests.readthedocs.io',
            Repository: 'https://github.com/psf/requests',
            Source: 'https://github.com/ignored/lower-priority',
          },
          classifiers: ['Development Status :: 5 - Production/Stable'],
        },
        releases: {
          '2.32.4': [{ upload_time: '2025-06-09T16:43:05' }],
        },
      }),
    );

    const metadata = await getPackageMetadata('requests');

    expect(fetchMock).toHaveBeenCalledWith('https://pypi.org/pypi/requests/json');
    expect(metadata).toEqual({
      name: 'requests',
      latestVersion: '2.32.4',
      lastModified: new Date('2025-06-09T16:43:05'),
      deprecated: null,
      explicitDeprecationSignal: false,
      repositoryUrl: 'https://github.com/psf/requests',
      ownerRepo: 'psf/requests',
      classifiers: ['Development Status :: 5 - Production/Stable'],
    });
  });

  it('maps the inactive classifier to a strong deprecation-equivalent signal', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        info: {
          name: 'abandoned-project',
          version: '1.0.0',
          project_urls: {
            'Source Code': 'git+https://github.com/example/abandoned-project.git',
          },
          classifiers: ['Development Status :: 7 - Inactive'],
        },
        releases: {
          '1.0.0': [{ upload_time: '2018-01-02T03:04:05' }],
        },
      }),
    );

    const metadata = await getPackageMetadata('abandoned-project');
    expect(metadata?.deprecated).toBe('Development Status :: 7 - Inactive');
    if (!metadata) {
      throw new Error('Expected PyPI metadata');
    }

    const verdict = detectAbandonment(
      {
        name: 'abandoned-project',
        currentVersion: '1.0.0',
        isDirect: true,
        isDev: false,
        ecosystem: 'pypi',
      },
      metadata,
      null,
    );

    expect(verdict.confidence).toBe('likely-abandoned');
    expect(verdict.signals).toContainEqual(
      expect.objectContaining({
        type: 'deprecated-flag',
        severity: 'critical',
        description:
          'Package marked inactive on PyPI: Development Status :: 7 - Inactive',
      }),
    );
  });

  it('returns null repository fields when project_urls has no GitHub URL', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        info: {
          name: 'no-github-project',
          version: '3.1.0',
          project_urls: {
            Homepage: 'https://example.com',
            Source: 'https://gitlab.com/example/no-github-project',
          },
          classifiers: [],
        },
        releases: {
          '3.1.0': [{ upload_time: '2024-03-01T10:00:00' }],
        },
      }),
    );

    const metadata = await getPackageMetadata('no-github-project');

    expect(metadata?.repositoryUrl).toBeNull();
    expect(metadata?.ownerRepo).toBeNull();
  });

  it('returns null when the package is not found and caches the result', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'Not Found' }, { status: 404 }));

    await expect(getPackageMetadata('missing-project')).resolves.toBeNull();
    await expect(getPackageMetadata('missing-project')).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
