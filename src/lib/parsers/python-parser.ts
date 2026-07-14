import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import type { Dependency } from '../../types.js';

const PACKAGE_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*/;

export async function parseRequirementsTxt(cwd: string): Promise<Dependency[]> {
  return parseRequirementsFile(join(cwd, 'requirements.txt'), new Set());
}

async function parseRequirementsFile(
  requirementsPath: string,
  visited: Set<string>,
): Promise<Dependency[]> {
  const absolutePath = resolve(requirementsPath);
  if (visited.has(absolutePath)) {
    return [];
  }
  visited.add(absolutePath);

  const raw = await readFile(absolutePath, 'utf8');
  const dependencies: Dependency[] = [];

  for (const rawLine of raw.split(/\r?\n/)) {
    const line = stripComment(rawLine).trim();
    if (!line) {
      continue;
    }

    const includePath = parseIncludePath(line);
    if (includePath) {
      dependencies.push(
        ...(await parseRequirementsFile(resolve(dirname(absolutePath), includePath), visited)),
      );
      continue;
    }

    const requirement = line.split(';', 1)[0].trim();
    const name = PACKAGE_NAME_PATTERN.exec(requirement)?.[0];
    if (!name) {
      continue;
    }

    const normalizedSpecifier = stripExtras(requirement.slice(name.length)).trim();

    dependencies.push({
      name,
      currentVersion: normalizedSpecifier.startsWith('==')
        ? normalizedSpecifier.slice(2).trim()
        : normalizedSpecifier,
      // requirements.txt does not contain the transitive graph that package-lock.json does,
      // so every listed Python requirement is treated as direct.
      isDirect: true,
      isDev: false,
      ecosystem: 'pypi',
    });
  }

  return dependencies;
}

function stripComment(line: string): string {
  const commentIndex = line.search(/\s#/);
  if (commentIndex !== -1) {
    return line.slice(0, commentIndex);
  }
  return line.trimStart().startsWith('#') ? '' : line;
}

function parseIncludePath(line: string): string | null {
  for (const prefix of ['-r', '--requirement']) {
    if (line.startsWith(`${prefix} `) || line.startsWith(`${prefix}\t`)) {
      return line.slice(prefix.length).trim();
    }
  }
  return null;
}

function stripExtras(requirementSuffix: string): string {
  if (!requirementSuffix.startsWith('[')) {
    return requirementSuffix;
  }

  const extrasEnd = requirementSuffix.indexOf(']');
  return extrasEnd === -1 ? requirementSuffix : requirementSuffix.slice(extrasEnd + 1);
}
