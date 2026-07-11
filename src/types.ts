/**
 * A dependency resolved from the project's lockfile.
 */
export interface Dependency {
  name: string;
  currentVersion: string;
  isDirect: boolean;
  isDev: boolean;
}

/**
 * A single piece of evidence that a dependency may be abandoned or at risk.
 *
 * Signal types:
 * - `no-release` — no published release within the expected window for this ecosystem.
 * - `no-commits` — the upstream repository shows no meaningful commits for an extended period.
 * - `deprecated-flag` — the package or repository carries an explicit deprecation notice.
 * - `unanswered-issues` — open issues or PRs go unanswered for a long time.
 * - `maintainer-inactive` — listed maintainers show no activity on this or related projects.
 *
 * Severity levels (how loudly to surface the signal):
 * - `info` — worth noting; on its own it does not imply abandonment (e.g. slow release cadence).
 * - `warning` — concerning; multiple warnings or one warning plus context may shift the verdict.
 * - `critical` — strong indicator on its own (e.g. explicit deprecation, years without releases).
 */
export interface AbandonmentSignal {
  type:
    | 'no-release'
    | 'no-commits'
    | 'deprecated-flag'
    | 'unanswered-issues'
    | 'maintainer-inactive';
  description: string;
  severity: 'info' | 'warning' | 'critical';
}

/**
 * Result of analyzing one dependency for abandonment.
 *
 * Confidence levels (overall judgment for this dependency):
 * - `maintained` — activity and maintenance signals look healthy; no meaningful concern.
 * - `at-risk` — some warning signals present; monitor or plan migration but not urgent.
 * - `likely-abandoned` — multiple critical/warning signals; treat as effectively unmaintained.
 * - `insufficient-data` — registry or GitHub data was missing or inconclusive; do not infer abandonment.
 */
export interface AbandonmentVerdict {
  dependency: Dependency;
  confidence: 'maintained' | 'at-risk' | 'likely-abandoned' | 'insufficient-data';
  signals: AbandonmentSignal[];
  /** ISO 8601 timestamp of when this dependency was last analyzed. */
  lastChecked: string;
}

/**
 * One recommended replacement for an abandoned or at-risk package.
 *
 * Successor types (how the replacement relates to the dead package):
 * - `official-successor` — endorsed or published by the original maintainer/org.
 * - `community-fork` — a fork that has become the de-facto maintained continuation.
 * - `api-compatible-alternative` — different project with a similar API; often a drop-in or near drop-in.
 * - `different-approach` — valid replacement that requires rethinking integration (different API/model).
 *
 * Migration effort (rough cost to switch):
 * - `drop-in` — swap dependency with minimal or no code changes.
 * - `minor-changes` — localized edits (imports, config, a few API calls).
 * - `rewrite-required` — substantial refactor; same problem space, different shape.
 */
export interface SuccessorCandidate {
  name: string;
  repoUrl: string;
  type:
    | 'official-successor'
    | 'community-fork'
    | 'api-compatible-alternative'
    | 'different-approach';
  migrationEffort: 'drop-in' | 'minor-changes' | 'rewrite-required';
  /** Human-readable bullets supporting why this successor is recommended. */
  evidence: string[];
  /** ISO 8601 date when this successor entry was last verified by a maintainer or contributor. */
  lastVerified: string;
}

/**
 * Full shape of a curated successor record (one YAML file in `data/successors/`).
 *
 * Used by contributors editing the public dataset; fields should stay stable for tooling and PR review.
 */
export interface SuccessorRecord {
  deadPackage: string;
  ecosystem: 'npm' | 'pypi' | 'go' | 'crates';
  /** ISO 8601 date when the package was officially deprecated, or null if unknown/informal. */
  deprecatedSince: string | null;
  successors: SuccessorCandidate[];
  /** Free-form context (migration guides, caveats, links) for humans and report output. */
  notes: string | null;
}

/**
 * Per-dependency row in a scan report: abandonment analysis plus optional curated successors.
 */
export interface ScanResultEntry {
  verdict: AbandonmentVerdict;
  /** Curated successor record from the dataset, if one exists for this package. */
  successorRecord: SuccessorRecord | null;
}

/**
 * Aggregate counts for quick summary lines and `--json` consumers.
 */
export interface ScanResultSummary {
  total: number;
  maintained: number;
  atRisk: number;
  likelyAbandoned: number;
  insufficientData: number;
  /** Dependencies with at least one curated successor in the dataset. */
  withKnownSuccessors: number;
}

/**
 * Final output of `lifeboat scan`: one entry per analyzed dependency plus roll-up counts.
 */
export interface ScanResult {
  /** ISO 8601 timestamp when the scan completed. */
  scannedAt: string;
  entries: ScanResultEntry[];
  summary: ScanResultSummary;
}
