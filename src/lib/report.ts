import chalk from 'chalk';
import type { ScanResult, ScanResultEntry, SuccessorCandidate } from '../types.js';

export type ReportSeverity = 'at-risk' | 'likely-abandoned';

export interface ReportOptions {
  /** Show the insufficient-data summary line (hidden by default; too noisy). */
  verbose?: boolean;
  /** Only show findings at this confidence level or above. Defaults to 'at-risk'. */
  severity?: ReportSeverity;
}

const NAME_COLUMN_WIDTH = 18;

export function formatReport(result: ScanResult, options: ReportOptions = {}): string {
  const includeAtRisk = options.severity !== 'likely-abandoned';
  const shown = result.entries.filter(
    (entry) =>
      entry.verdict.confidence === 'likely-abandoned' ||
      (includeAtRisk && entry.verdict.confidence === 'at-risk'),
  );

  const lines: string[] = [];
  const { summary } = result;

  if (shown.length === 0) {
    lines.push(
      chalk.green(`All clear — none of the ${summary.total} scanned dependencies look abandoned.`),
    );
  } else {
    const headline = includeAtRisk
      ? `${shown.length} of ${summary.total} dependencies look abandoned or at risk:`
      : `${shown.length} of ${summary.total} dependencies look abandoned:`;
    lines.push(chalk.bold(headline));
    lines.push('');

    for (const entry of shown) {
      lines.push(...formatEntry(entry));
    }
  }

  if (options.verbose && summary.insufficientData > 0) {
    lines.push('');
    lines.push(
      chalk.dim(
        `${summary.insufficientData} package${summary.insufficientData === 1 ? '' : 's'} had insufficient GitHub data to assess`,
      ),
    );
  }

  lines.push('');
  lines.push(
    `Scanned ${summary.total} dependencies: ` +
      `${chalk.green(`${summary.maintained} maintained`)}, ` +
      `${chalk.yellow(`${summary.atRisk} at risk`)}, ` +
      `${chalk.red(`${summary.likelyAbandoned} likely abandoned`)}`,
  );

  return lines.join('\n');
}

function formatEntry(entry: ScanResultEntry): string[] {
  const { verdict, successorRecord } = entry;
  const color = verdict.confidence === 'likely-abandoned' ? chalk.red : chalk.yellow;
  const name = verdict.dependency.name.padEnd(NAME_COLUMN_WIDTH);
  const evidence = verdict.signals.map((signal) => signal.description).join(', ');

  const lines = [`  ${color(name)} ${evidence}`];

  if (successorRecord && successorRecord.successors.length > 0) {
    const label = successorRecord.successors.length === 1 ? 'successor' : 'successors';
    const successors = successorRecord.successors
      .map((candidate) => formatSuccessor(candidate))
      .join(', ');
    lines.push(chalk.cyan(`    -> ${label}: ${successors}`));
  }

  return lines;
}

function formatSuccessor(candidate: SuccessorCandidate): string {
  const type = candidate.type.replace(/-/g, ' ');
  return `${candidate.name} (${type}, ${candidate.migrationEffort})`;
}
