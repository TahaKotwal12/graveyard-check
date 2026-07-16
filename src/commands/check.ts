import chalk from 'chalk';
import { Command } from 'commander';
import ora from 'ora';
import {
  detectAbandonment,
  type GitHubData,
  type RegistryMetadata,
} from '../lib/abandonment-detector.js';
import { fetchRepoActivity, type GitHubRepoActivity } from '../lib/github-client.js';
import {
  getPackageMetadata as getNpmPackageMetadata,
  type NpmPackageMetadata,
} from '../lib/npm-registry-client.js';
import {
  getPackageMetadata as getPypiPackageMetadata,
  type PypiPackageMetadata,
} from '../lib/pypi-registry-client.js';
import { findSuccessors, loadSuccessorGraph } from '../lib/successor-graph.js';
import type { AbandonmentVerdict, SuccessorCandidate, SuccessorRecord } from '../types.js';

export interface CheckClients {
  getPackageMetadata(name: string): Promise<NpmPackageMetadata | null>;
  getPypiPackageMetadata?(name: string): Promise<PypiPackageMetadata | null>;
  fetchRepoActivity(ownerRepo: string): Promise<GitHubRepoActivity | null>;
  loadSuccessorGraph(): Promise<Map<string, SuccessorRecord>>;
}

const defaultClients: CheckClients = {
  getPackageMetadata: getNpmPackageMetadata,
  getPypiPackageMetadata,
  fetchRepoActivity,
  loadSuccessorGraph: () => loadSuccessorGraph(),
};

export interface CheckResult {
  verdict: AbandonmentVerdict;
  successorRecord: SuccessorRecord | null;
}

export class PackageNotFoundError extends Error {
  constructor(packageName: string, ecosystem: 'npm' | 'pypi' = 'npm') {
    const registry = ecosystem === 'pypi' ? 'PyPI' : 'npm';
    super(
      `Package "${packageName}" was not found on the ${registry} registry. ` +
        `Check the spelling and confirm --ecosystem ${ecosystem} is correct.`,
    );
  }
}

export async function performCheck(
  packageName: string,
  clients: CheckClients = defaultClients,
  ecosystem: 'npm' | 'pypi' = 'npm',
): Promise<CheckResult> {
  const registryMeta =
    ecosystem === 'pypi'
      ? await getPypiMetadata(packageName, clients)
      : await clients.getPackageMetadata(packageName);
  if (!registryMeta) {
    throw new PackageNotFoundError(packageName, ecosystem);
  }

  const metadata: RegistryMetadata = {
    deprecated: registryMeta.deprecated,
    explicitDeprecationSignal:
      'explicitDeprecationSignal' in registryMeta
        ? registryMeta.explicitDeprecationSignal === true
        : registryMeta.deprecated !== null,
    lastModified: registryMeta.lastModified,
    ownerRepo: registryMeta.ownerRepo,
  };

  let ghData: GitHubData | null = null;
  if (registryMeta.ownerRepo) {
    const activity = await clients.fetchRepoActivity(registryMeta.ownerRepo);
    if (activity) {
      ghData = {
        lastCommitDate: activity.lastCommitDate,
        lastReleaseDate: activity.lastReleaseDate,
        isArchived: activity.isArchived,
        hasDeprecationInReadme: activity.hasDeprecationInReadme,
      };
    }
  }

  const verdict = detectAbandonment(
    {
      name: registryMeta.name,
      currentVersion: registryMeta.latestVersion,
      isDirect: true,
      isDev: false,
      ecosystem,
    },
    metadata,
    ghData,
  );

  const graph = await clients.loadSuccessorGraph();
  const candidateRecord =
    verdict.confidence !== 'maintained' ? findSuccessors(packageName, graph) : null;
  const successorRecord = candidateRecord?.ecosystem === ecosystem ? candidateRecord : null;

  return { verdict, successorRecord };
}

async function getPypiMetadata(
  packageName: string,
  clients: CheckClients,
): Promise<PypiPackageMetadata | null> {
  if (!clients.getPypiPackageMetadata) {
    throw new Error('PyPI registry client is not configured');
  }
  return clients.getPypiPackageMetadata(packageName);
}

const STATUS_COLORS: Record<AbandonmentVerdict['confidence'], (text: string) => string> = {
  maintained: chalk.green,
  'at-risk': chalk.yellow,
  'likely-abandoned': chalk.red,
  'insufficient-data': chalk.dim,
};

export function formatCheckReport(result: CheckResult): string {
  const { verdict, successorRecord } = result;
  const lines: string[] = [];

  lines.push(chalk.bold(`${verdict.dependency.name} ${verdict.dependency.currentVersion}`));
  lines.push(`Status: ${STATUS_COLORS[verdict.confidence](verdict.confidence)}`);

  if (verdict.signals.length === 0) {
    lines.push(chalk.green('  No abandonment signals detected.'));
  } else {
    for (const signal of verdict.signals) {
      lines.push(`  - ${signal.description}`);
    }
  }

  if (successorRecord && successorRecord.successors.length > 0) {
    lines.push('');
    lines.push(chalk.bold('Recommended successors:'));
    for (const candidate of successorRecord.successors) {
      lines.push(...formatSuccessor(candidate));
    }

    if (successorRecord.notes) {
      lines.push('');
      lines.push(chalk.dim(`Notes: ${successorRecord.notes}`));
    }
  }

  return lines.join('\n');
}

function formatSuccessor(candidate: SuccessorCandidate): string[] {
  const lines = [
    `  ${chalk.cyan(candidate.name.padEnd(16))}${candidate.type.padEnd(29)}${candidate.migrationEffort}`,
  ];

  for (const item of candidate.evidence) {
    lines.push(chalk.dim(`    - ${item}`));
  }

  return lines;
}

export function checkExitCode(verdict: AbandonmentVerdict): number {
  return verdict.confidence === 'at-risk' || verdict.confidence === 'likely-abandoned' ? 1 : 0;
}

export function registerCheckCommand(program: Command): void {
  program
    .command('check <package>')
    .description('Check a single package for abandonment and successors')
    .option(
      '--ecosystem <ecosystem>',
      'package ecosystem: "npm" or "pypi" (default: npm; package names are not guessed)',
      'npm',
    )
    .action(async (packageName: string, options: { ecosystem: string }) => {
      if (!['npm', 'pypi'].includes(options.ecosystem)) {
        console.error(`Invalid --ecosystem value "${options.ecosystem}". Use "npm" or "pypi".`);
        process.exit(1);
      }

      const spinner = ora(`Checking ${packageName}...`).start();

      try {
        const result = await performCheck(
          packageName,
          defaultClients,
          options.ecosystem as 'npm' | 'pypi',
        );
        spinner.stop();

        console.log(formatCheckReport(result));
        process.exitCode = checkExitCode(result.verdict);
      } catch (error) {
        spinner.stop();
        console.error(`Error: ${(error as Error).message}`);
        process.exit(1);
      }
    });
}
