import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseRequirementsTxt } from '../src/lib/parsers/python-parser.js';

const fixturesDir = fileURLToPath(new URL('./fixtures/python-project', import.meta.url));

describe('parseRequirementsTxt', () => {
  it('parses exact pins', async () => {
    const dependencies = await parseRequirementsTxt(fixturesDir);

    expect(dependencies).toContainEqual({
      name: 'requests',
      currentVersion: '2.31.0',
      isDirect: true,
      isDev: false,
      ecosystem: 'pypi',
    });
  });

  it('preserves version ranges', async () => {
    const dependencies = await parseRequirementsTxt(fixturesDir);

    expect(dependencies).toContainEqual({
      name: 'django',
      currentVersion: '>=4.2,<5.0',
      isDirect: true,
      isDev: false,
      ecosystem: 'pypi',
    });
  });

  it('ignores comments and blank lines', async () => {
    const dependencies = await parseRequirementsTxt(fixturesDir);

    expect(dependencies).toHaveLength(6);
    expect(dependencies.some(({ name }) => name.startsWith('#'))).toBe(false);
  });

  it('recursively parses -r includes relative to their containing file', async () => {
    const dependencies = await parseRequirementsTxt(fixturesDir);

    expect(dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'flask', currentVersion: '3.0.0' }),
        expect.objectContaining({ name: 'sentry-sdk', currentVersion: '>=2.0,<3.0' }),
      ]),
    );
  });

  it('strips extras from the dependency name', async () => {
    const dependencies = await parseRequirementsTxt(fixturesDir);

    expect(dependencies).toContainEqual({
      name: 'uvicorn',
      currentVersion: '0.30.1',
      isDirect: true,
      isDev: false,
      ecosystem: 'pypi',
    });
  });

  it('strips environment markers while keeping the package', async () => {
    const dependencies = await parseRequirementsTxt(fixturesDir);

    expect(dependencies).toContainEqual({
      name: 'importlib-metadata',
      currentVersion: '7.0.0',
      isDirect: true,
      isDev: false,
      ecosystem: 'pypi',
    });
  });
});
