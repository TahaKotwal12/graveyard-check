// Consumes a `graveyard-check scan --json` report inside the GitHub Action:
// writes a markdown table to the job summary and exits non-zero when any
// dependency meets or exceeds the FAIL_ON threshold.
import { appendFileSync, readFileSync } from 'node:fs';

const VALID_THRESHOLDS = ['at-risk', 'likely-abandoned'];

const reportPath = process.argv[2];
if (!reportPath) {
  console.error('Usage: node action-summary.mjs <report.json>');
  process.exit(1);
}

const failOn = process.env.FAIL_ON || 'likely-abandoned';
if (!VALID_THRESHOLDS.includes(failOn)) {
  console.error(
    `Invalid fail-on value "${failOn}". Use "at-risk" or "likely-abandoned".`,
  );
  process.exit(1);
}

const result = JSON.parse(readFileSync(reportPath, 'utf8'));
const { summary } = result;

const flagged = result.entries.filter((entry) =>
  ['at-risk', 'likely-abandoned'].includes(entry.verdict.confidence),
);

const failing = flagged.filter(
  (entry) => failOn === 'at-risk' || entry.verdict.confidence === 'likely-abandoned',
);

const escapeCell = (text) => text.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');

const lines = ['## Graveyard Check dependency scan', ''];

if (flagged.length === 0) {
  lines.push(`All clear — none of the ${summary.total} scanned dependencies look abandoned.`);
} else {
  lines.push('| Package | Version | Status | Evidence | Suggested successor |');
  lines.push('| --- | --- | --- | --- | --- |');

  for (const entry of flagged) {
    const { verdict, successorRecord } = entry;
    const evidence = verdict.signals.map((signal) => signal.description).join('; ');
    const successor = successorRecord?.successors[0]
      ? `${successorRecord.successors[0].name} (${successorRecord.successors[0].type})`
      : '—';
    const status = verdict.confidence === 'likely-abandoned' ? '🔴 likely abandoned' : '🟡 at risk';

    lines.push(
      `| \`${verdict.dependency.name}\` | ${verdict.dependency.currentVersion} | ${status} | ${escapeCell(evidence)} | ${escapeCell(successor)} |`,
    );
  }
}

lines.push('');
lines.push(
  `Scanned **${summary.total}** dependencies: ${summary.maintained} maintained, ` +
    `${summary.atRisk} at risk, ${summary.likelyAbandoned} likely abandoned` +
    (summary.insufficientData > 0
      ? `, ${summary.insufficientData} with insufficient data to assess`
      : '') +
    '.',
);
lines.push('');

const markdown = lines.join('\n');

if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
}

console.log(
  `Scanned ${summary.total} dependencies: ${summary.maintained} maintained, ` +
    `${summary.atRisk} at risk, ${summary.likelyAbandoned} likely abandoned.`,
);

if (failing.length > 0) {
  const names = failing.map((entry) => entry.verdict.dependency.name).join(', ');
  console.error(
    `${failing.length} dependenc${failing.length === 1 ? 'y meets' : 'ies meet'} the "${failOn}" threshold: ${names}`,
  );
  process.exit(1);
}
