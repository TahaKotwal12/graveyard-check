import {
  Anchor,
  ArrowRight,
  BookOpenCheck,
  Check,
  Copy,
  Database,
  FileJson,
  GitPullRequest,
  LifeBuoy,
  Scale,
  ShieldCheck,
  Workflow,
} from 'lucide-react';
import { useState } from 'react';
import { GithubIcon } from './components/GithubIcon';
import { CodeBlock, Terminal } from './components/Terminal';

const GITHUB_URL = 'https://github.com/TahaKotwal12/graveyard-check';

const NAV_LINKS = [
  { href: '#features', label: 'Features' },
  { href: '#verdicts', label: 'How it works' },
  { href: '#cli', label: 'CLI' },
  { href: '#action', label: 'GitHub Action' },
  { href: '#dataset', label: 'Dataset' },
  { href: '#contribute', label: 'Contribute' },
  { href: '#faq', label: 'FAQ' },
];

function CopyCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      onClick={copy}
      className="group flex items-center gap-3 rounded-xl border border-white/15 bg-navy-800 px-5 py-3 font-mono text-sm text-slate-200 transition hover:border-orange-400/60"
    >
      <span className="text-orange-400">$</span>
      {command}
      {copied ? (
        <Check className="h-4 w-4 text-green-400" />
      ) : (
        <Copy className="h-4 w-4 text-slate-500 transition group-hover:text-orange-400" />
      )}
    </button>
  );
}

function SectionHeading({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return (
    <div className="mx-auto mb-12 max-w-2xl text-center">
      <p className="mb-2 font-mono text-sm font-medium uppercase tracking-widest text-orange-400">
        {eyebrow}
      </p>
      <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">{title}</h2>
      {sub && <p className="mt-4 text-lg text-slate-400">{sub}</p>}
    </div>
  );
}

const FEATURES = [
  {
    icon: ShieldCheck,
    title: 'Evidence, not vibes',
    body: 'Every verdict ships with human-readable proof — "No release in 3.1 years", never a bare label. Conservative by design: a false "abandoned" claim is worse than a missed one.',
  },
  {
    icon: Database,
    title: 'Crowdsourced successor graph',
    body: 'A public, reviewable dataset of YAML records maps dead packages to verified successors — maintainer endorsements, migration guides, and adoption facts, each with a last-verified date.',
  },
  {
    icon: Workflow,
    title: 'Built for CI',
    body: 'A composite GitHub Action posts a markdown summary to your job and fails the build on your severity threshold. Runs weekly — abandonment doesn\u2019t change hour to hour.',
  },
  {
    icon: FileJson,
    title: 'JSON output',
    body: 'graveyard-check scan --json emits the full structured result for scripting, dashboards, or piping into anything else in your pipeline.',
  },
  {
    icon: Anchor,
    title: 'Shell-guard exit codes',
    body: 'graveyard-check check <pkg> exits 1 when a package is at-risk or likely abandoned — usable on its own as a pre-install gate or script guard.',
  },
  {
    icon: Scale,
    title: 'MIT-licensed, no server',
    body: 'The CLI talks straight to the npm registry and GitHub API from your machine. No account, no telemetry, no backend.',
  },
];

const VERDICTS = [
  {
    label: 'maintained',
    color: 'border-green-500/40 text-green-400',
    dot: 'bg-green-400',
    body: 'Activity and maintenance signals look healthy. No meaningful concern.',
  },
  {
    label: 'at-risk',
    color: 'border-yellow-500/40 text-yellow-400',
    dot: 'bg-yellow-400',
    body: '12–24 months without commits or releases. Monitor, or plan a migration — not urgent.',
  },
  {
    label: 'likely-abandoned',
    color: 'border-red-500/40 text-red-400',
    dot: 'bg-red-400',
    body: 'npm deprecation flag, archived repository, or 24+ months with no commits and no releases.',
  },
  {
    label: 'insufficient-data',
    color: 'border-slate-500/40 text-slate-400',
    dot: 'bg-slate-400',
    body: 'The repository is missing or unreachable. Graveyard Check never guesses — it says so.',
  },
];

const SEED_PACKAGES = [
  'request',
  'request-promise',
  'node-sass',
  'moment',
  'istanbul',
  'gulp-util',
  'colors',
  'faker',
  'tslint',
];

const FAQS = [
  {
    q: "Doesn't Dependabot already do this?",
    a: 'No. Dependabot and Renovate only act when new versions exist — a dead package is invisible to them. Health scorecards like Snyk Advisor show risk but never answer "what should I use instead?". Graveyard Check covers exactly that gap.',
  },
  {
    q: 'What about false positives?',
    a: 'The detector is conservative on purpose. Stable, finished libraries with quiet repos land at "at-risk" at most, and the npm deprecation flag — maintainer-confirmed truth — is the only single signal that immediately means likely-abandoned. When data is missing, the verdict is "insufficient-data", not a guess.',
  },
  {
    q: 'Do you support pnpm or yarn lockfiles?',
    a: 'Not yet — npm package-lock.json (v2/v3) today, pnpm and yarn next. Meanwhile, generate an npm lockfile just for the scan: npm install --package-lock-only --ignore-scripts.',
  },
  {
    q: 'Why do I need a GITHUB_TOKEN?',
    a: 'Graveyard Check reads public repository activity from the GitHub API. Unauthenticated requests are capped at 60/hour, which a real scan exhausts. A fine-grained token with read-only public repository access raises that to 5,000/hour.',
  },
  {
    q: 'How do successor recommendations stay trustworthy?',
    a: 'Every record needs verifiable evidence with a last-verified date, and CI validates each YAML file against a strict schema. PRs with weak or unverifiable evidence are asked for more evidence, not auto-merged.',
  },
];

export default function App() {
  return (
    <div className="min-h-screen bg-navy-950 font-sans text-slate-300 antialiased">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-navy-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <a href="#" className="flex items-center gap-2 text-white">
            <LifeBuoy className="h-6 w-6 text-orange-400" />
            <span className="text-lg font-bold tracking-tight">Graveyard Check</span>
          </a>
          <nav className="hidden items-center gap-6 text-sm text-slate-400 md:flex">
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href} className="transition hover:text-white">
                {link.label}
              </a>
            ))}
          </nav>
          <a
            href={GITHUB_URL}
            className="flex items-center gap-2 rounded-lg border border-white/15 px-3 py-1.5 text-sm text-slate-200 transition hover:border-orange-400/60 hover:text-white"
          >
            <GithubIcon className="h-4 w-4" />
            GitHub
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(600px 300px at 50% 0%, rgba(249,115,22,0.12), transparent 70%)',
          }}
        />
        <div className="mx-auto max-w-6xl px-4 pb-20 pt-24 text-center">
          <p className="mx-auto mb-6 w-fit rounded-full border border-orange-400/30 bg-orange-400/10 px-4 py-1.5 font-mono text-xs text-orange-300">
            open source · MIT licensed · npm ecosystem
          </p>
          <h1 className="mx-auto max-w-3xl text-4xl font-extrabold tracking-tight text-white sm:text-6xl">
            Find maintained successors for{' '}
            <span className="text-orange-400">abandoned dependencies</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-400">
            Dependabot tells you when there&apos;s a new version. Nothing tells you when there will{' '}
            <em className="text-slate-200">never</em> be a new version. Graveyard Check reads your
            lockfile, flags dependencies that are effectively dead — with evidence — and recommends
            the verified community successor.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4">
            <CopyCommand command="npm i graveyard-check" />
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <CopyCommand command="graveyard-check scan" />
              <a
                href={GITHUB_URL}
                className="flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-sm font-semibold text-navy-950 transition hover:bg-orange-400"
              >
                Star on GitHub <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>

          <div className="mx-auto mt-16 max-w-3xl text-left">
            <Terminal title="graveyard-check scan">
              <span className="text-white">2 of 142 dependencies look abandoned or at risk:</span>
              {'\n\n  '}
              <span className="font-semibold text-red-400">request</span>
              {'            Package deprecated on npm: request has been deprecated'}
              {'\n    '}
              <span className="text-cyan-400">
                -&gt; successors: got (api compatible alternative), axios (api compatible
                alternative)
              </span>
              {'\n  '}
              <span className="font-semibold text-yellow-400">some-lib</span>
              {'           No commits in 2.4 years, No release in 2.4 years'}
              {'\n\n'}
              {'Scanned 142 dependencies: '}
              <span className="text-green-400">139 maintained</span>
              {', '}
              <span className="text-yellow-400">1 at risk</span>
              {', '}
              <span className="text-red-400">2 likely abandoned</span>
            </Terminal>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t border-white/5 bg-navy-900/40 py-24">
        <div className="mx-auto max-w-6xl px-4">
          <SectionHeading
            eyebrow="Features"
            title="The missing piece of dependency health"
            sub="Between “no updates available” and “this library died in 2022” sits a gap no other tool covers."
          />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="rounded-2xl border border-white/10 bg-navy-900 p-6 transition hover:border-orange-400/40"
              >
                <feature.icon className="mb-4 h-6 w-6 text-orange-400" />
                <h3 className="mb-2 font-semibold text-white">{feature.title}</h3>
                <p className="text-sm leading-relaxed text-slate-400">{feature.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Verdicts */}
      <section id="verdicts" className="py-24">
        <div className="mx-auto max-w-6xl px-4">
          <SectionHeading
            eyebrow="How it works"
            title="Four verdicts, always with evidence"
            sub="Signals come from the npm registry and GitHub: deprecation flags, archived repos, commit and release recency, README deprecation notices."
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {VERDICTS.map((verdict) => (
              <div
                key={verdict.label}
                className={`rounded-2xl border bg-navy-900 p-5 ${verdict.color.split(' ')[0]}`}
              >
                <div className="mb-3 flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${verdict.dot}`} />
                  <span className={`font-mono text-sm font-semibold ${verdict.color.split(' ')[1]}`}>
                    {verdict.label}
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-slate-400">{verdict.body}</p>
              </div>
            ))}
          </div>
          <p className="mx-auto mt-8 max-w-2xl text-center text-sm text-slate-500">
            npm&apos;s native <code className="text-orange-300">deprecated</code> flag is
            maintainer-confirmed truth and immediately means likely-abandoned. Everything else is
            weighed conservatively — a stale README note alone can bump one tier at most.
          </p>
        </div>
      </section>

      {/* CLI */}
      <section id="cli" className="border-t border-white/5 bg-navy-900/40 py-24">
        <div className="mx-auto max-w-6xl px-4">
          <SectionHeading
            eyebrow="CLI"
            title="Install once, scan anywhere"
            sub="Install globally, then scan a whole project or ask about a single package from anywhere."
          />
          <div className="mb-10 flex justify-center">
            <CopyCommand command="npm i graveyard-check" />
          </div>
          <div className="grid gap-8 lg:grid-cols-2">
            <div>
              <h3 className="mb-3 font-mono text-lg font-semibold text-white">graveyard-check scan</h3>
              <p className="mb-4 text-sm text-slate-400">
                Parses <code className="text-orange-300">package-lock.json</code>, checks every
                dependency against the npm registry and GitHub, and prints flagged packages with
                successor recommendations.
              </p>
              <CodeBlock title="flags">
                {'--json            structured output for CI/scripting\n'}
                {'--direct-only     skip transitive dependencies (faster)\n'}
                {'--severity <lvl>  at-risk | likely-abandoned\n'}
                {'--verbose         include insufficient-data count'}
              </CodeBlock>
            </div>
            <div>
              <h3 className="mb-3 font-mono text-lg font-semibold text-white">
                graveyard-check check &lt;package&gt;
              </h3>
              <p className="mb-4 text-sm text-slate-400">
                Single-package lookup with full detail. Exits 1 when the package is at-risk or
                likely abandoned, so it works as a CI gate on its own.
              </p>
              <Terminal title="graveyard-check check request">
                <span className="font-semibold text-white">request 2.88.2</span>
                {'\nStatus: '}
                <span className="font-semibold text-red-400">likely-abandoned</span>
                {'\n  - Package deprecated on npm: request has been deprecated'}
                {'\n\n'}
                <span className="text-white">Recommended successors:</span>
                {'\n  '}
                <span className="text-cyan-400">got</span>
                {'             api-compatible-alternative   minor-changes\n'}
                <span className="text-slate-500">
                  {'    - 19 stable npm releases in the last 12 months'}
                </span>
              </Terminal>
            </div>
          </div>
          <div className="mt-10 rounded-2xl border border-orange-400/20 bg-orange-400/5 p-5 text-sm text-slate-300">
            <strong className="text-orange-300">Tip:</strong> set{' '}
            <code className="text-orange-300">GITHUB_TOKEN</code> before scanning. Unauthenticated
            GitHub API requests are capped at 60/hour; a fine-grained token with read-only public
            repository access raises that to 5,000/hour.
          </div>
        </div>
      </section>

      {/* GitHub Action */}
      <section id="action" className="py-24">
        <div className="mx-auto max-w-6xl px-4">
          <SectionHeading
            eyebrow="GitHub Action"
            title="A weekly lookout, not a hourly alarm"
            sub="Abandonment status doesn't change hour to hour. Run Graveyard Check on a schedule, get a markdown summary in the job, and fail the build at your threshold."
          />
          <div className="mx-auto max-w-3xl">
            <CodeBlock title=".github/workflows/dependency-health.yml">
              {'name: Dependency health\n\n'}
              {'on:\n'}
              {"  schedule:\n    - cron: '0 6 * * 1' # Mondays 06:00 UTC\n"}
              {'  workflow_dispatch:\n\n'}
              {'jobs:\n'}
              {'  graveyard-check:\n'}
              {'    runs-on: ubuntu-latest\n'}
              {'    steps:\n'}
              {'      - uses: actions/checkout@v4\n'}
              {'      - uses: TahaKotwal12/graveyard-check@v1\n'}
              {'        with:\n'}
              {'          fail-on: likely-abandoned'}
            </CodeBlock>
            <p className="mt-6 text-center text-sm text-slate-500">
              The graveyard-check repository runs this same action on its own dependencies every week.
              Dogfooding included.
            </p>
          </div>
        </div>
      </section>

      {/* Dataset */}
      <section id="dataset" className="border-t border-white/5 bg-navy-900/40 py-24">
        <div className="mx-auto max-w-6xl px-4">
          <SectionHeading
            eyebrow="The successor dataset"
            title="Nobody owned the successor graph. Now everybody does."
            sub="Which fork of a dead library is the real continuation? Today that answer lives in scattered Reddit threads. Graveyard Check versions it as reviewable YAML records."
          />
          <div className="grid gap-8 lg:grid-cols-2">
            <CodeBlock title="data/successors/request.yaml">
              {'deadPackage: request\n'}
              {'ecosystem: npm\n'}
              {'deprecatedSince: 2020-02-11\n'}
              {'successors:\n'}
              {'  - name: got\n'}
              {'    repoUrl: https://github.com/sindresorhus/got\n'}
              {'    type: api-compatible-alternative\n'}
              {'    migrationEffort: minor-changes\n'}
              {'    evidence:\n'}
              {"      - Listed in request's maintainer-curated\n"}
              {'        alternatives list (request/request#3143)\n'}
              {'      - 19 stable npm releases in the 12 months\n'}
              {'        to 2026-07-11\n'}
              {'    lastVerified: 2026-07-11'}
            </CodeBlock>
            <div className="flex flex-col justify-center">
              <h3 className="mb-3 text-xl font-semibold text-white">
                Seeded with the famous cases
              </h3>
              <p className="mb-6 text-sm leading-relaxed text-slate-400">
                The dataset ships with researched, source-linked records for the packages everyone
                has been burned by — including both 2022 sabotage incidents — and every record is
                validated against a strict schema in CI.
              </p>
              <div className="flex flex-wrap gap-2">
                {SEED_PACKAGES.map((pkg) => (
                  <span
                    key={pkg}
                    className="rounded-full border border-white/15 bg-navy-800 px-3 py-1 font-mono text-xs text-slate-300"
                  >
                    {pkg}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contribute */}
      <section id="contribute" className="py-24">
        <div className="mx-auto max-w-6xl px-4">
          <SectionHeading
            eyebrow="Contribute"
            title="Know the successor of a dead package?"
            sub="Adding a record is the highest-value, lowest-friction contribution. No TypeScript required."
          />
          <div className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: GithubIcon, step: '1. Fork', body: 'Fork the repository on GitHub.' },
              {
                icon: BookOpenCheck,
                step: '2. Copy the example',
                body: 'Duplicate the commented record in SCHEMA.md into a new YAML file.',
              },
              {
                icon: ShieldCheck,
                step: '3. Add real evidence',
                body: 'Maintainer endorsements, migration guides, dated activity facts. Verifiable or it doesn\u2019t ship.',
              },
              {
                icon: GitPullRequest,
                step: '4. Open a PR',
                body: 'CI validates your record against the schema automatically.',
              },
            ].map((item) => (
              <div key={item.step} className="rounded-2xl border border-white/10 bg-navy-900 p-5">
                <item.icon className="mb-3 h-5 w-5 text-orange-400" />
                <h3 className="mb-1 font-semibold text-white">{item.step}</h3>
                <p className="text-sm text-slate-400">{item.body}</p>
              </div>
            ))}
          </div>
          <blockquote className="mx-auto mt-10 max-w-2xl border-l-2 border-orange-400/60 pl-4 text-sm italic text-slate-400">
            &ldquo;PRs with weak or unverifiable evidence will be asked for more evidence, not
            merged as-is. The entire value of this dataset is that people can trust it.&rdquo;
            <span className="mt-1 block not-italic text-slate-500">— CONTRIBUTING.md</span>
          </blockquote>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-t border-white/5 bg-navy-900/40 py-24">
        <div className="mx-auto max-w-3xl px-4">
          <SectionHeading eyebrow="FAQ" title="Questions people actually ask" />
          <div className="space-y-4">
            {FAQS.map((faq) => (
              <details
                key={faq.q}
                className="group rounded-xl border border-white/10 bg-navy-900 p-5 open:border-orange-400/40"
              >
                <summary className="cursor-pointer font-medium text-white marker:text-orange-400">
                  {faq.q}
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-slate-400">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 text-center">
        <div className="mx-auto max-w-2xl px-4">
          <LifeBuoy className="mx-auto mb-6 h-12 w-12 text-orange-400" />
          <h2 className="text-3xl font-bold text-white">
            Your auth library was abandoned in 2022.
          </h2>
          <p className="mt-3 text-lg text-slate-400">Find out in the next 30 seconds.</p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3">
            <CopyCommand command="npm i graveyard-check" />
            <CopyCommand command="graveyard-check scan" />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-sm text-slate-500 sm:flex-row">
          <div className="flex items-center gap-2">
            <LifeBuoy className="h-4 w-4 text-orange-400" />
            <span>Graveyard Check — MIT licensed open source</span>
          </div>
          <div className="flex items-center gap-6">
            <a href={GITHUB_URL} className="transition hover:text-white">
              GitHub
            </a>
            <a href={`${GITHUB_URL}/blob/main/CONTRIBUTING.md`} className="transition hover:text-white">
              Contributing
            </a>
            <a
              href={`${GITHUB_URL}/blob/main/data/successors/SCHEMA.md`}
              className="transition hover:text-white"
            >
              Dataset schema
            </a>
            <a href={`${GITHUB_URL}/blob/main/docs/github-action.md`} className="transition hover:text-white">
              Action docs
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
