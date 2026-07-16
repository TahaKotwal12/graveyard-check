import { ArrowRight, ExternalLink, Link2, Loader2, Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  checkPackage,
  PackageNotFoundError,
  type CheckResult,
  type Confidence,
  type Ecosystem,
} from '../lib/checker';
import { findSuccessorRecord, type SuccessorRecord } from '../lib/successors';

const VERDICT_STYLES: Record<Confidence, { badge: string; dot: string; border: string }> = {
  maintained: {
    badge: 'bg-green-500/15 text-green-400',
    dot: 'bg-green-400',
    border: 'border-green-500/40',
  },
  'at-risk': {
    badge: 'bg-yellow-500/15 text-yellow-400',
    dot: 'bg-yellow-400',
    border: 'border-yellow-500/40',
  },
  'likely-abandoned': {
    badge: 'bg-red-500/15 text-red-400',
    dot: 'bg-red-400',
    border: 'border-red-500/40',
  },
  'insufficient-data': {
    badge: 'bg-slate-500/15 text-slate-400',
    dot: 'bg-slate-400',
    border: 'border-slate-500/40',
  },
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'text-red-400',
  warning: 'text-yellow-400',
  info: 'text-green-400',
};

const EXAMPLES: { name: string; ecosystem: Ecosystem }[] = [
  { name: 'request', ecosystem: 'npm' },
  { name: 'moment', ecosystem: 'npm' },
  { name: 'nose', ecosystem: 'pypi' },
  { name: 'oauth2client', ecosystem: 'pypi' },
];

function readUrlParams(): { name: string; ecosystem: Ecosystem } | null {
  const url = new URL(window.location.href);

  const pathMatch = /^\/check\/([^/]+)(?:\/(npm|pypi))?$/.exec(url.pathname);
  if (pathMatch) {
    return {
      name: decodeURIComponent(pathMatch[1]),
      ecosystem: (pathMatch[2] as Ecosystem) ?? 'npm',
    };
  }

  const name = url.searchParams.get('check');
  if (name) {
    const eco = url.searchParams.get('ecosystem');
    return { name, ecosystem: eco === 'pypi' ? 'pypi' : 'npm' };
  }

  return null;
}

function writeUrlParams(name: string, ecosystem: Ecosystem): string {
  const url = new URL(window.location.href);
  url.pathname = '/';
  url.hash = '';
  url.searchParams.set('check', name);
  url.searchParams.set('ecosystem', ecosystem);
  window.history.replaceState(null, '', url.toString());
  return url.toString();
}

export function Checker() {
  const [input, setInput] = useState('');
  const [ecosystem, setEcosystem] = useState<Ecosystem>('npm');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [record, setRecord] = useState<SuccessorRecord | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);
  const requestSeq = useRef(0);

  const runCheck = async (name: string, eco: Ecosystem) => {
    const trimmed = name.trim();
    if (!trimmed) return;

    const seq = ++requestSeq.current;
    setLoading(true);
    setError(null);
    setResult(null);
    setRecord(null);
    setInput(trimmed);
    setEcosystem(eco);
    writeUrlParams(trimmed, eco);

    try {
      const checkResult = await checkPackage(trimmed, eco);
      if (seq !== requestSeq.current) return;
      setResult(checkResult);
      setRecord(findSuccessorRecord(trimmed, eco));
    } catch (err) {
      if (seq !== requestSeq.current) return;
      setError(
        err instanceof PackageNotFoundError
          ? err.message
          : `Check failed: ${(err as Error).message}`,
      );
    } finally {
      if (seq === requestSeq.current) {
        setLoading(false);
      }
    }
  };

  // Deep links: /?check=request&ecosystem=npm or /check/request/npm
  useEffect(() => {
    const params = readUrlParams();
    if (params) {
      void runCheck(params.name, params.ecosystem);
      sectionRef.current?.scrollIntoView({ block: 'center' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copyShareLink = async () => {
    if (!result) return;
    const url = writeUrlParams(result.name, result.ecosystem);
    await navigator.clipboard.writeText(url);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 1500);
  };

  const styles = result ? VERDICT_STYLES[result.confidence] : null;

  return (
    <div ref={sectionRef} className="mx-auto max-w-2xl">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void runCheck(input, ecosystem);
        }}
        className="flex flex-col gap-3 sm:flex-row"
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Package name, e.g. request or nose"
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            className="w-full rounded-xl border border-white/15 bg-navy-800 py-3 pl-11 pr-4 font-mono text-sm text-slate-200 outline-none transition placeholder:text-slate-500 focus:border-orange-400/60"
          />
        </div>
        <div className="flex gap-3">
          <div className="flex overflow-hidden rounded-xl border border-white/15">
            {(['npm', 'pypi'] as const).map((eco) => (
              <button
                key={eco}
                type="button"
                onClick={() => setEcosystem(eco)}
                className={`px-4 py-3 font-mono text-sm transition ${
                  ecosystem === eco
                    ? 'bg-orange-500 font-semibold text-navy-950'
                    : 'bg-navy-800 text-slate-400 hover:text-white'
                }`}
              >
                {eco === 'npm' ? 'npm' : 'PyPI'}
              </button>
            ))}
          </div>
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-sm font-semibold text-navy-950 transition duration-300 hover:scale-[1.03] hover:bg-orange-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Check'}
          </button>
        </div>
      </form>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span>Try:</span>
        {EXAMPLES.map((example) => (
          <button
            key={`${example.ecosystem}:${example.name}`}
            type="button"
            onClick={() => void runCheck(example.name, example.ecosystem)}
            className="rounded-full border border-white/10 bg-navy-800 px-2.5 py-0.5 font-mono transition hover:border-orange-400/50 hover:text-orange-300"
          >
            {example.name}
            <span className="ml-1 text-slate-600">({example.ecosystem})</span>
          </button>
        ))}
      </div>

      {error && (
        <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {result && styles && (
        <div className={`mt-6 rounded-2xl border bg-navy-900 p-6 text-left ${styles.border}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="font-mono text-lg font-semibold text-white">{result.name}</span>
              <span className="font-mono text-sm text-slate-500">{result.latestVersion}</span>
              <span className="rounded-full bg-white/5 px-2 py-0.5 font-mono text-[11px] text-slate-400">
                {result.ecosystem}
              </span>
            </div>
            <span
              className={`flex items-center gap-2 rounded-full px-3 py-1 font-mono text-sm font-semibold ${styles.badge}`}
            >
              <span className={`h-2 w-2 rounded-full ${styles.dot}`} />
              {result.confidence}
            </span>
          </div>

          <ul className="mt-4 space-y-1.5">
            {result.signals.map((signal) => (
              <li key={signal.description} className="flex gap-2 text-sm">
                <span className={SEVERITY_COLORS[signal.severity]}>•</span>
                <span className="text-slate-300">{signal.description}</span>
              </li>
            ))}
          </ul>

          {record && record.successors.length > 0 && (
            <div className="mt-5 border-t border-white/10 pt-4">
              <p className="mb-3 font-mono text-xs uppercase tracking-widest text-cyan-400">
                Recommended successors
              </p>
              <div className="space-y-3">
                {record.successors.map((successor) => (
                  <div key={successor.name} className="rounded-xl bg-navy-800 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={successor.repoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 font-mono font-semibold text-cyan-400 hover:underline"
                      >
                        {successor.name}
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                      <span className="rounded-full bg-white/5 px-2 py-0.5 font-mono text-[11px] text-slate-400">
                        {successor.type}
                      </span>
                      <span className="rounded-full bg-white/5 px-2 py-0.5 font-mono text-[11px] text-slate-400">
                        {successor.migrationEffort}
                      </span>
                    </div>
                    <ul className="mt-2 space-y-1">
                      {successor.evidence.slice(0, 2).map((item) => (
                        <li key={item} className="text-xs leading-relaxed text-slate-500">
                          — {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              {record.notes && (
                <p className="mt-3 text-xs leading-relaxed text-slate-500">{record.notes}</p>
              )}
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-white/10 pt-4 text-sm">
            <button
              type="button"
              onClick={() => void copyShareLink()}
              className="flex items-center gap-1.5 text-slate-400 transition hover:text-orange-300"
            >
              <Link2 className="h-4 w-4" />
              {shareCopied ? 'Link copied!' : 'Copy shareable link'}
            </button>
            <a
              href={result.registryUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-slate-400 transition hover:text-white"
            >
              View on {result.ecosystem === 'npm' ? 'npm' : 'PyPI'}
              <ArrowRight className="h-3.5 w-3.5" />
            </a>
            {result.repositoryUrl && (
              <a
                href={result.repositoryUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-slate-400 transition hover:text-white"
              >
                Repository <ArrowRight className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        </div>
      )}

      <p className="mt-4 text-center text-xs text-slate-600">
        Runs entirely in your browser against the public npm, PyPI, and GitHub APIs. The CLI adds
        full-project scans, README analysis, and authenticated rate limits.
      </p>
    </div>
  );
}
