import { Command } from 'commander';
import ora from 'ora';
import pLimit from 'p-limit';
import {
  detectAbandonment,
  type GitHubData,
  type NpmMetadata,
} from '../lib/abandonment-detector.js';
import { fetchRepoActivity, type GitHubRepoActivity } from '../lib/github-client.js';
import { parseLockfile } from '../lib/lockfile-parser.js';
import { getPackageMetadata, type NpmPackageMetadata } from '../lib/npm-registry-client.js';
import { formatReport, type ReportSeverity } from '../lib/report.js';
import { findSuccessors, loadSuccessorGraph } from '../lib/successor-graph.js';
import type {
  AbandonmentVerdict,
  Dependency,
  ScanResult,
  ScanResultEntry,
  ScanResultSummary,
  SuccessorRecord,
} from '../types.js';

const DEFAULT_CONCURRENCY = 5;

export interface ScanClients {
  getPackageMetadata(name: string): Promise<NpmPackageMetadata | null>;
  fetchRepoActivity(ownerRepo: string): Promise<GitHubRepoActivity | null>;
  loadSuccessorGraph(): Promise<Map<string, SuccessorRecord>>;
}

const defaultClients: ScanClients = {
  getPackageMetadata,
  fetchRepoActivity,
  loadSuccessorGraph: () => loadSuccessorGraph(),
};

export interface PerformScanOptions {
  cwd: string;
  directOnly?: boolean;
  concurrency?: number;
  onProgress?: (completed: number, total: number, packageName: string) => void;
}

export async function performScan(
  options: PerformScanOptions,
  clients: ScanClients = defaultClients,
): Promise<ScanResult> {
  const allDependencies = await parseLockfile(options.cwd);
  const dependencies = options.directOnly
    ? allDependencies.filter((dep) => dep.isDirect)
    : allDependencies;

  const graph = await clients.loadSuccessorGraph();
  const limit = pLimit(options.concurrency ?? DEFAULT_CONCURRENCY);

  let completed = 0;
  const entries = await Promise.all(
    dependencies.map((dep) =>
      limit(async () => {
        const entry = await analyzeDependency(dep, clients, graph);
        completed += 1;
        options.onProgress?.(completed, dependencies.length, dep.name);
        return entry;
      }),
    ),
  );

  return {
    scannedAt: new Date().toISOString(),
    entries,
    summary: summarize(entries),
  };
}

async function analyzeDependency(
  dep: Dependency,
  clients: ScanClients,
  graph: Map<string, SuccessorRecord>,
): Promise<ScanResultEntry> {
  const npmMeta = await clients.getPackageMetadata(dep.name);

  let verdict: AbandonmentVerdict;
  if (!npmMeta) {
    verdict = {
      dependency: dep,
      confidence: 'insufficient-data',
      signals: [
        {
          type: 'maintainer-inactive',
          severity: 'warning',
          description: 'Package not found on the npm registry',
        },
      ],
      lastChecked: new Date().toISOString(),
    };
  } else {
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

    verdict = detectAbandonment(dep, metadata, ghData);
  }

  const successorRecord =
    verdict.confidence !== 'maintained' ? findSuccessors(dep.name, graph) : null;

  return { verdict, successorRecord };
}

function summarize(entries: ScanResultEntry[]): ScanResultSummary {
  const summary: ScanResultSummary = {
    total: entries.length,
    maintained: 0,
    atRisk: 0,
    likelyAbandoned: 0,
    insufficientData: 0,
    withKnownSuccessors: 0,
  };

  for (const entry of entries) {
    switch (entry.verdict.confidence) {
      case 'maintained':
        summary.maintained += 1;
        break;
      case 'at-risk':
        summary.atRisk += 1;
        break;
      case 'likely-abandoned':
        summary.likelyAbandoned += 1;
        break;
      case 'insufficient-data':
        summary.insufficientData += 1;
        break;
    }

    if (entry.successorRecord) {
      summary.withKnownSuccessors += 1;
    }
  }

  return summary;
}

interface ScanCliOptions {
  json?: boolean;
  directOnly?: boolean;
  severity?: string;
  verbose?: boolean;
}

export function registerScanCommand(program: Command): void {
  program
    .command('scan')
    .description('Scan project dependencies for abandoned packages')
    .option('--json', 'output the raw scan result as JSON (for CI/scripting)')
    .option('--direct-only', 'skip transitive dependencies (much faster)')
    .option(
      '--severity <level>',
      'only show findings at this level or above: "at-risk" or "likely-abandoned"',
    )
    .option('--verbose', 'include packages with insufficient data in the report')
    .action(async (options: ScanCliOptions) => {
      if (options.severity && !['at-risk', 'likely-abandoned'].includes(options.severity)) {
        console.error(
          `Invalid --severity value "${options.severity}". Use "at-risk" or "likely-abandoned".`,
        );
        process.exit(1);
      }

      const spinner = options.json ? null : ora('Reading lockfile...').start();

      try {
        const result = await performScan({
          cwd: process.cwd(),
          directOnly: options.directOnly,
          onProgress: (completed, total, packageName) => {
            if (spinner) {
              spinner.text = `Checked ${completed}/${total} dependencies (${packageName})`;
            }
          },
        });

        spinner?.stop();

        if (options.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log(
            formatReport(result, {
              verbose: options.verbose,
              severity: options.severity as ReportSeverity | undefined,
            }),
          );
        }
      } catch (error) {
        spinner?.stop();
        console.error(`Error: ${(error as Error).message}`);
        process.exit(1);
      }
    });
}
