import chalk from 'chalk';
import { Command } from 'commander';
import ora from 'ora';
import {
  detectAbandonment,
  type GitHubData,
  type NpmMetadata,
} from '../lib/abandonment-detector.js';
import { fetchRepoActivity, type GitHubRepoActivity } from '../lib/github-client.js';
import { getPackageMetadata, type NpmPackageMetadata } from '../lib/npm-registry-client.js';
import { findSuccessors, loadSuccessorGraph } from '../lib/successor-graph.js';
import type {
  AbandonmentVerdict,
  SuccessorCandidate,
  SuccessorRecord,
} from '../types.js';

export interface CheckClients {
  getPackageMetadata(name: string): Promise<NpmPackageMetadata | null>;
  fetchRepoActivity(ownerRepo: string): Promise<GitHubRepoActivity | null>;
  loadSuccessorGraph(): Promise<Map<string, SuccessorRecord>>;
}

const defaultClients: CheckClients = {
  getPackageMetadata,
  fetchRepoActivity,
  loadSuccessorGraph: () => loadSuccessorGraph(),
};

export interface CheckResult {
  verdict: AbandonmentVerdict;
  successorRecord: SuccessorRecord | null;
}

export class PackageNotFoundError extends Error {
  constructor(packageName: string) {
    super(
      `Package "${packageName}" was not found on the npm registry. ` +
        'Check the spelling — npm package names are lowercase and case-sensitive.',
    );
  }
}

export async function performCheck(
  packageName: string,
  clients: CheckClients = defaultClients,
): Promise<CheckResult> {
  const npmMeta = await clients.getPackageMetadata(packageName);
  if (!npmMeta) {
    throw new PackageNotFoundError(packageName);
  }

  const metadata: NpmMetadata = {
    deprecated: npmMeta.deprecated,
    lastModified: npmMeta.lastModified,
    ownerRepo: npmMeta.ownerRepo,
  };

  let ghData: GitHubData | null = null;
  if (npmMeta.ownerRepo) {
    const activity = await clients.fetchRepoActivity(npmMeta.ownerRepo);
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
      name: npmMeta.name,
      currentVersion: npmMeta.latestVersion,
      isDirect: true,
      isDev: false,
    },
    metadata,
    ghData,
  );

  const graph = await clients.loadSuccessorGraph();
  const successorRecord =
    verdict.confidence !== 'maintained' ? findSuccessors(packageName, graph) : null;

  return { verdict, successorRecord };
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
    .action(async (packageName: string) => {
      const spinner = ora(`Checking ${packageName}...`).start();

      try {
        const result = await performCheck(packageName);
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
