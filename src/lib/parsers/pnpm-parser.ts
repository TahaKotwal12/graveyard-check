import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parse } from 'yaml';
import type { Dependency } from '../../types.js';

/**
 * Parser for pnpm-lock.yaml, lockfile format v6 (pnpm 8) and v9 (pnpm 9/10).
 *
 * Unlike the npm parser, no package.json is needed: pnpm lockfiles carry the
 * direct-dependency graph themselves (root `dependencies`/`devDependencies`
 * in v6 single-package projects, per-importer sections in workspaces).
 *
 * Dev classification for transitive dependencies is best-effort: v6 marks
 * dev-only packages with `dev: true`, v9 dropped that flag, so v9 transitive
 * deps are reported as non-dev. Direct dependencies are always classified
 * correctly from the importer sections.
 */

interface PnpmImporterEntry {
  specifier?: string;
  version?: string;
}

interface PnpmImporter {
  dependencies?: Record<string, PnpmImporterEntry | string>;
  devDependencies?: Record<string, PnpmImporterEntry | string>;
  optionalDependencies?: Record<string, PnpmImporterEntry | string>;
}

interface PnpmPackageEntry {
  dev?: boolean;
}

interface PnpmLockfile {
  lockfileVersion?: string | number;
  importers?: Record<string, PnpmImporter>;
  dependencies?: Record<string, PnpmImporterEntry | string>;
  devDependencies?: Record<string, PnpmImporterEntry | string>;
  packages?: Record<string, PnpmPackageEntry | null>;
}

/**
 * Extract `name` and `version` from a pnpm packages key.
 * v9: `debug@4.3.7`, `@babel/core@7.24.0(peer@1.0.0)`
 * v6: `/debug@4.3.7(supports-color@8.1.1)`
 */
export function parsePnpmPackageKey(rawKey: string): { name: string; version: string } | null {
  let key = rawKey.startsWith('/') ? rawKey.slice(1) : rawKey;

  const parenIndex = key.indexOf('(');
  if (parenIndex !== -1) {
    key = key.slice(0, parenIndex);
  }

  const atIndex = key.lastIndexOf('@');
  if (atIndex <= 0) {
    return null;
  }

  const name = key.slice(0, atIndex);
  const version = key.slice(atIndex + 1);
  if (!name || !version) {
    return null;
  }

  return { name, version };
}

export async function parsePnpmLockfile(cwd: string): Promise<Dependency[]> {
  const lockfilePath = join(cwd, 'pnpm-lock.yaml');

  let raw: string;
  try {
    raw = await readFile(lockfilePath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error('No pnpm-lock.yaml found.');
    }
    throw error;
  }

  const lockfile = parse(raw) as PnpmLockfile | null;
  if (!lockfile) {
    throw new Error('pnpm-lock.yaml is empty or invalid.');
  }

  const version = Number.parseFloat(String(lockfile.lockfileVersion ?? '0'));
  if (Number.isNaN(version) || version < 6) {
    throw new Error(
      `Unsupported pnpm-lock.yaml version (${String(lockfile.lockfileVersion)}). ` +
        'Lockfile format v6 (pnpm 8) or newer is required — regenerate with `pnpm install --lockfile-only`.',
    );
  }

  // Direct dependencies come from importers (workspaces) or the root sections
  // (v6 single-package layout). Merging all importers means workspace repos get
  // every workspace's direct deps flagged as direct, which is the useful reading.
  const direct = new Map<string, { version: string; isDev: boolean }>();
  const importers = lockfile.importers
    ? Object.values(lockfile.importers)
    : [{ dependencies: lockfile.dependencies, devDependencies: lockfile.devDependencies }];

  for (const importer of importers) {
    collectImporterSection(direct, importer.dependencies, false);
    collectImporterSection(direct, importer.devDependencies, true);
  }

  const aggregated = new Map<string, { version: string; isDirect: boolean; isDev: boolean }>();

  for (const [key, entry] of Object.entries(lockfile.packages ?? {})) {
    const parsed = parsePnpmPackageKey(key);
    if (!parsed || aggregated.has(parsed.name)) {
      continue;
    }

    const directInfo = direct.get(parsed.name);
    aggregated.set(parsed.name, {
      version: directInfo?.version ?? parsed.version,
      isDirect: directInfo !== undefined,
      isDev: directInfo?.isDev ?? entry?.dev === true,
    });
  }

  // Lockfiles without a packages section (e.g. only workspace links) still
  // surface whatever the importers declared directly.
  for (const [name, info] of direct) {
    if (!aggregated.has(name)) {
      aggregated.set(name, { version: info.version, isDirect: true, isDev: info.isDev });
    }
  }

  const dependencies: Dependency[] = [];
  for (const [name, { version: currentVersion, isDirect, isDev }] of aggregated) {
    dependencies.push({ name, currentVersion, isDirect, isDev, ecosystem: 'npm' });
  }

  return dependencies.sort((a, b) => a.name.localeCompare(b.name));
}

function collectImporterSection(
  direct: Map<string, { version: string; isDev: boolean }>,
  section: Record<string, PnpmImporterEntry | string> | undefined,
  isDev: boolean,
): void {
  if (!section) {
    return;
  }

  for (const [name, entry] of Object.entries(section)) {
    const rawVersion = typeof entry === 'string' ? entry : entry.version;
    if (!rawVersion) {
      continue;
    }

    // `link:` and `workspace:` entries point at local packages, not the registry.
    if (rawVersion.startsWith('link:') || rawVersion.startsWith('workspace:')) {
      continue;
    }

    const parenIndex = rawVersion.indexOf('(');
    const cleanVersion = parenIndex === -1 ? rawVersion : rawVersion.slice(0, parenIndex);

    const existing = direct.get(name);
    // A dependency that is a prod dep anywhere in the workspace outranks dev.
    if (!existing || (existing.isDev && !isDev)) {
      direct.set(name, { version: cleanVersion, isDev });
    }
  }
}
