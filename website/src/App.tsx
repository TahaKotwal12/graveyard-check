import {
  Anchor,
  ArrowRight,
  BookOpenCheck,
  Boxes,
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
import { Checker } from './components/Checker';
import { GithubIcon } from './components/GithubIcon';
import { Reveal } from './components/Reveal';
import { CodeBlock, Terminal } from './components/Terminal';

const GITHUB_URL = 'https://github.com/TahaKotwal12/graveyard-check';

const NAV_LINKS = [
  { href: '#try', label: 'Try it' },
  { href: '#features', label: 'Features' },
  { href: '#ecosystems', label: 'Ecosystems' },
  { href: '#verdicts', label: 'How it works' },
  { href: '#cli', label: 'CLI' },
  { href: '#action', label: 'GitHub Action' },
  { href: '#dataset', label: 'Dataset' },
  { href: '#contribute', label: 'Contribute' },
  { href: '#faq', label: 'FAQ' },
];

function CopyCommand({ command }: Readonly<{ command: string }>) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      onClick={copy}
      className="group flex items-center gap-3 rounded-xl border border-white/15 bg-navy-800 px-5 py-3 font-mono text-sm text-slate-200 transition duration-300 hover:scale-[1.03] hover:border-orange-400/60 active:scale-[0.98]"
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

function SectionHeading({
  eyebrow,
  title,
  sub,
}: Readonly<{ eyebrow: string; title: string; sub?: string }>) {
  return (
    <Reveal className="mx-auto mb-12 max-w-2xl text-center">
      <p className="mb-2 font-mono text-sm font-medium uppercase tracking-widest text-orange-400">
        {eyebrow}
      </p>
      <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">{title}</h2>
      {sub && <p className="mt-4 text-lg text-slate-400">{sub}</p>}
    </Reveal>
  );
}

const FEATURES = [
  {
    icon: Boxes,
    title: 'npm + PyPI in one CLI',
    body: 'New in v0.2.0 — scan package-lock.json or requirements.txt with the same command. PyPI\u2019s "Development Status :: 7 - Inactive" classifier is treated with the same weight as npm\u2019s deprecated flag.',
  },
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
    body: 'graveyard-check scan --json emits the full structured result — every dependency tagged with its ecosystem — for scripting, dashboards, or combining npm and PyPI reports in CI.',
  },
  {
    icon: Anchor,
    title: 'Shell-guard exit codes',
    body: 'graveyard-check check <pkg> exits 1 when a package is at-risk or likely abandoned — usable on its own as a pre-install gate or script guard.',
  },
  {
    icon: Scale,
    title: 'MIT-licensed, no server',
    body: 'The CLI talks straight to the npm registry, PyPI, and the GitHub API from your machine. No account, no telemetry, no backend.',
  },
  {
    icon: BookOpenCheck,
    title: 'Never guesses',
    body: 'Missing repository? Old Python package that predates GitHub? The verdict is "insufficient-data", stated explicitly — never silently skipped or scored as maintained.',
  },
];

const ECOSYSTEMS = [
  {
    name: 'npm',
    input: 'package-lock.json v2/v3',
    status: 'Supported',
    live: true,
    detail: 'Direct and transitive dependencies, dev-dependency awareness, npm deprecation flags.',
  },
  {
    name: 'PyPI',
    input: 'requirements.txt',
    status: 'New in v0.2.0',
    live: true,
    detail:
      'Pins, ranges, extras, environment markers, and recursive -r includes. Inactive classifier detected as an explicit deprecation signal.',
  },
  {
    name: 'Go modules',
    input: 'go.mod',
    status: 'Planned',
    live: false,
    detail: 'On the roadmap. The successor-record schema already reserves the ecosystem.',
  },
  {
    name: 'Rust crates',
    input: 'Cargo.lock',
    status: 'Planned',
    live: false,
    detail: 'On the roadmap. The successor-record schema already reserves the ecosystem.',
  },
];

function badgeClasses(eco: (typeof ECOSYSTEMS)[number]): string {
  if (!eco.live) {
    return 'bg-white/5 text-slate-500';
  }
  return eco.status.startsWith('New')
    ? 'bg-orange-400/15 text-orange-300'
    : 'bg-green-500/15 text-green-400';
}

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
    body: 'npm deprecation flag or PyPI Inactive classifier, archived repository, or 24+ months with no commits and no releases.',
  },
  {
    label: 'insufficient-data',
    color: 'border-slate-500/40 text-slate-400',
    dot: 'bg-slate-400',
    body: 'The repository is missing or unreachable. Graveyard Check never guesses — it says so.',
  },
];

const SEED_PACKAGES_NPM = [
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

const SEED_PACKAGES_PYPI = [
  'nose',
  'pycrypto',
  'oauth2client',
  'flask-script',
  'south',
  'flask-oauthlib',
  'distutils',
  'mock',
];

const FAQS = [
  {
    q: "Doesn't Dependabot already do this?",
    a: 'No. Dependabot and Renovate only act when new versions exist — a dead package is invisible to them. Health scorecards like Snyk Advisor show risk but never answer "what should I use instead?". Graveyard Check covers exactly that gap.',
  },
  {
    q: 'Does it support Python?',
    a: 'Yes, since v0.2.0. Scans parse requirements.txt (pins, ranges, extras, environment markers, recursive -r includes) and check dependencies against PyPI. poetry.lock and Pipfile.lock are detected but not parsed yet — you get a clear error instead of a misparse. Use --ecosystem pypi when a project also has a package-lock.json.',
  },
  {
    q: 'What about false positives?',
    a: 'The detector is conservative on purpose. Stable, finished libraries with quiet repos land at "at-risk" at most. Only explicit maintainer declarations — npm\u2019s deprecated flag or PyPI\u2019s "Development Status :: 7 - Inactive" classifier — immediately mean likely-abandoned. When data is missing, the verdict is "insufficient-data", not a guess.',
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
    <div id="top" className="min-h-screen bg-navy-950 font-sans text-slate-300 antialiased">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-navy-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <a href="#top" className="flex items-center gap-2 text-white">
            <LifeBuoy className="h-6 w-6 text-orange-400" />
            <span className="text-lg font-bold tracking-tight">Graveyard Check</span>
          </a>
          <nav className="hidden items-center gap-6 text-sm text-slate-400 md:flex">
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href} className="nav-link transition hover:text-white">
                {link.label}
              </a>
            ))}
          </nav>
          <a
            href={GITHUB_URL}
            className="flex items-center gap-2 rounded-lg border border-white/15 px-3 py-1.5 text-sm text-slate-200 transition duration-300 hover:scale-105 hover:border-orange-400/60 hover:text-white"
          >
            <GithubIcon className="h-4 w-4" />
            GitHub
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="hero-glow pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(600px 300px at 50% 0%, rgba(249,115,22,0.12), transparent 70%)',
          }}
        />
        <div className="mx-auto max-w-6xl px-4 pb-20 pt-24 text-center">
          <Reveal>
            <p className="mx-auto mb-6 w-fit rounded-full border border-orange-400/30 bg-orange-400/10 px-4 py-1.5 font-mono text-xs text-orange-300">
              v0.2.0 · open source · MIT licensed · npm + PyPI
            </p>
          </Reveal>
          <Reveal delay={100}>
            <h1 className="mx-auto max-w-3xl text-4xl font-extrabold tracking-tight text-white sm:text-6xl">
              Find maintained successors for{' '}
              <span className="text-gradient-orange">abandoned dependencies</span>
            </h1>
          </Reveal>
          <Reveal delay={200}>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-400">
              Dependabot tells you when there&apos;s a new version. Nothing tells you when there
              will <em className="text-slate-200">never</em> be a new version. Graveyard Check reads
              your dependency files — JavaScript or Python — flags dependencies that are effectively
              dead, with evidence, and recommends the verified community successor.
            </p>
          </Reveal>
          <Reveal delay={300}>
            <div className="mt-10 flex flex-col items-center justify-center gap-4">
              <CopyCommand command="npm i graveyard-check" />
              <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
                <CopyCommand command="graveyard-check scan" />
                <a
                  href={GITHUB_URL}
                  className="flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-sm font-semibold text-navy-950 transition duration-300 hover:scale-[1.03] hover:bg-orange-400 active:scale-[0.98]"
                >
                  Star on GitHub <ArrowRight className="h-4 w-4" />
                </a>
              </div>
            </div>
          </Reveal>

          <Reveal delay={450} className="mx-auto mt-16 max-w-3xl text-left">
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
              {'\n'}
              <span className="terminal-cursor text-orange-400">▋</span>
            </Terminal>
          </Reveal>
        </div>
      </section>

      {/* Try it in the browser */}
      <section id="try" className="py-24">
        <div className="mx-auto max-w-6xl px-4">
          <SectionHeading
            eyebrow="Try it now"
            title="Check any package — right here, no install"
            sub="Type an npm or PyPI package name. The verdict, evidence, and verified successors come straight from the live registries and the real dataset."
          />
          <Reveal>
            <Checker />
          </Reveal>
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
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((feature, i) => (
              <Reveal key={feature.title} delay={(i % 4) * 80}>
                <div className="card-lift h-full rounded-2xl border border-white/10 bg-navy-900 p-6 hover:border-orange-400/40">
                  <feature.icon className="mb-4 h-6 w-6 text-orange-400" />
                  <h3 className="mb-2 font-semibold text-white">{feature.title}</h3>
                  <p className="text-sm leading-relaxed text-slate-400">{feature.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Ecosystems */}
      <section id="ecosystems" className="py-24">
        <div className="mx-auto max-w-6xl px-4">
          <SectionHeading
            eyebrow="Ecosystems"
            title="Two ecosystems today. More on the roadmap."
            sub="v0.2.0 adds full PyPI support alongside npm — same detector, same evidence bar, same successor dataset."
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {ECOSYSTEMS.map((eco, i) => (
              <Reveal key={eco.name} delay={i * 80}>
                <div
                  className={`card-lift h-full rounded-2xl border bg-navy-900 p-5 ${
                    eco.live ? 'border-green-500/30' : 'border-white/10'
                  }`}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <span className="font-mono text-lg font-semibold text-white">{eco.name}</span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 font-mono text-[11px] ${badgeClasses(eco)}`}
                    >
                      {eco.status}
                    </span>
                  </div>
                  <p className="mb-2 font-mono text-xs text-slate-500">{eco.input}</p>
                  <p className="text-sm leading-relaxed text-slate-400">{eco.detail}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={200} className="mx-auto mt-10 max-w-3xl">
            <Terminal title="graveyard-check scan --ecosystem pypi">
              <span className="text-white">2 of 24 dependencies look abandoned or at risk:</span>
              {'\n\n  '}
              <span className="font-semibold text-red-400">oauth2client</span>
              {'       Package marked inactive on PyPI: Development Status :: 7 - Inactive'}
              {'\n    '}
              <span className="text-cyan-400">
                -&gt; successor: google-auth (official successor, minor-changes)
              </span>
              {'\n  '}
              <span className="font-semibold text-red-400">pycrypto</span>
              {'           No commits in 4.4 years, No release in 11+ years'}
              {'\n    '}
              <span className="text-cyan-400">
                -&gt; successors: pycryptodome (community fork, drop-in), cryptography
              </span>
              {'\n\n'}
              {'Scanned 24 dependencies: '}
              <span className="text-green-400">21 maintained</span>
              {', '}
              <span className="text-yellow-400">1 at risk</span>
              {', '}
              <span className="text-red-400">2 likely abandoned</span>
            </Terminal>
          </Reveal>
          <Reveal delay={280}>
            <p className="mx-auto mt-6 max-w-2xl text-center text-sm text-slate-500">
              Projects with both a <code className="text-orange-300">package-lock.json</code> and a{' '}
              <code className="text-orange-300">requirements.txt</code> scan npm by default — run
              again with <code className="text-orange-300">--ecosystem pypi</code> for Python.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Verdicts */}
      <section id="verdicts" className="border-t border-white/5 bg-navy-900/40 py-24">
        <div className="mx-auto max-w-6xl px-4">
          <SectionHeading
            eyebrow="How it works"
            title="Four verdicts, always with evidence"
            sub="Signals come from the npm registry, PyPI, and GitHub: deprecation flags, inactive classifiers, archived repos, commit and release recency, README deprecation notices."
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {VERDICTS.map((verdict, i) => (
              <Reveal key={verdict.label} delay={i * 80}>
                <div
                  className={`card-lift h-full rounded-2xl border bg-navy-900 p-5 ${verdict.color.split(' ')[0]}`}
                >
                  <div className="mb-3 flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${verdict.dot}`} />
                    <span
                      className={`font-mono text-sm font-semibold ${verdict.color.split(' ')[1]}`}
                    >
                      {verdict.label}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-slate-400">{verdict.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal>
            <p className="mx-auto mt-8 max-w-2xl text-center text-sm text-slate-500">
              npm&apos;s native <code className="text-orange-300">deprecated</code> flag and
              PyPI&apos;s{' '}
              <code className="text-orange-300">Development Status :: 7 - Inactive</code> classifier
              are maintainer-confirmed truth and immediately mean likely-abandoned — both carry
              equal weight. Everything else is weighed conservatively; a stale README note alone can
              bump one tier at most.
            </p>
          </Reveal>
        </div>
      </section>

      {/* CLI */}
      <section id="cli" className="py-24">
        <div className="mx-auto max-w-6xl px-4">
          <SectionHeading
            eyebrow="CLI"
            title="Install once, scan anywhere"
            sub="Install globally, then scan a whole project or ask about a single package from anywhere."
          />
          <Reveal className="mb-10 flex justify-center">
            <CopyCommand command="npm i graveyard-check" />
          </Reveal>
          <div className="grid gap-8 lg:grid-cols-2">
            <Reveal>
              <h3 className="mb-3 font-mono text-lg font-semibold text-white">
                graveyard-check scan
              </h3>
              <p className="mb-4 text-sm text-slate-400">
                Parses <code className="text-orange-300">package-lock.json</code> or{' '}
                <code className="text-orange-300">requirements.txt</code>, checks every dependency
                against its registry and GitHub, and prints flagged packages with successor
                recommendations.
              </p>
              <CodeBlock title="flags">
                {'--json               structured output for CI/scripting\n'}
                {'--ecosystem <eco>    npm | pypi (auto-detects, prefers npm)\n'}
                {'--direct-only        skip transitive dependencies (faster)\n'}
                {'--severity <lvl>     at-risk | likely-abandoned\n'}
                {'--verbose            include insufficient-data count'}
              </CodeBlock>
            </Reveal>
            <Reveal delay={120}>
              <h3 className="mb-3 font-mono text-lg font-semibold text-white">
                graveyard-check check &lt;package&gt;
              </h3>
              <p className="mb-4 text-sm text-slate-400">
                Single-package lookup with full detail. Exits 1 when the package is at-risk or
                likely abandoned. Names collide across registries (npm&apos;s{' '}
                <code className="text-orange-300">requests</code> is not Python&apos;s), so pass{' '}
                <code className="text-orange-300">--ecosystem pypi</code> for Python packages —
                Graveyard Check never guesses.
              </p>
              <Terminal title="graveyard-check check requests --ecosystem pypi">
                <span className="font-semibold text-white">requests 2.32.4</span>
                {'\nStatus: '}
                <span className="font-semibold text-green-400">maintained</span>
                {'\n  No abandonment signals detected.'}
                {'\n\n'}
                <span className="text-slate-500">$ graveyard-check check request</span>
                {'\n'}
                <span className="font-semibold text-white">request 2.88.2</span>
                {'\nStatus: '}
                <span className="font-semibold text-red-400">likely-abandoned</span>
                {'\n  - Package deprecated on npm: request has been deprecated'}
                {'\n  '}
                <span className="text-cyan-400">
                  -&gt; got api-compatible-alternative minor-changes
                </span>
              </Terminal>
            </Reveal>
          </div>
          <Reveal>
            <div className="mt-10 rounded-2xl border border-orange-400/20 bg-orange-400/5 p-5 text-sm text-slate-300">
              <strong className="text-orange-300">Tip:</strong> set{' '}
              <code className="text-orange-300">GITHUB_TOKEN</code> before scanning. Unauthenticated
              GitHub API requests are capped at 60/hour; a fine-grained token with read-only public
              repository access raises that to 5,000/hour.
            </div>
          </Reveal>
        </div>
      </section>

      {/* GitHub Action */}
      <section id="action" className="border-t border-white/5 bg-navy-900/40 py-24">
        <div className="mx-auto max-w-6xl px-4">
          <SectionHeading
            eyebrow="GitHub Action"
            title="A weekly lookout, not a hourly alarm"
            sub="Abandonment status doesn't change hour to hour. Run Graveyard Check on a schedule, get a markdown summary in the job, and fail the build at your threshold."
          />
          <Reveal className="mx-auto max-w-3xl">
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
              The graveyard-check repository runs this same action on its own dependencies every
              week. Dogfooding included.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Dataset */}
      <section id="dataset" className="py-24">
        <div className="mx-auto max-w-6xl px-4">
          <SectionHeading
            eyebrow="The successor dataset"
            title="Nobody owned the successor graph. Now everybody does."
            sub="Which fork of a dead library is the real continuation? Today that answer lives in scattered Reddit threads. Graveyard Check versions it as reviewable YAML records."
          />
          <div className="grid gap-8 lg:grid-cols-2">
            <Reveal>
              <CodeBlock title="data/successors/oauth2client.yaml">
                {'deadPackage: oauth2client\n'}
                {'ecosystem: pypi\n'}
                {'deprecatedSince: null\n'}
                {'successors:\n'}
                {'  - name: google-auth\n'}
                {'    repoUrl: https://github.com/googleapis/...\n'}
                {'    type: official-successor\n'}
                {'    migrationEffort: minor-changes\n'}
                {'    evidence:\n'}
                {'      - "oauth2client publishes \\"Development\n'}
                {'        Status :: 7 - Inactive\\" on PyPI"\n'}
                {"      - oauth2client's own README recommends\n"}
                {'        google-auth with a migration guide\n'}
                {'    lastVerified: 2026-07-14'}
              </CodeBlock>
            </Reveal>
            <Reveal delay={120} className="flex flex-col justify-center">
              <h3 className="mb-3 text-xl font-semibold text-white">
                Seeded with the famous cases
              </h3>
              <p className="mb-6 text-sm leading-relaxed text-slate-400">
                The dataset ships with researched, source-linked records for the packages everyone
                has been burned by — including both 2022 npm sabotage incidents and the classic
                Python graveyard — and every record is validated against a strict schema in CI.
              </p>
              <p className="mb-2 font-mono text-xs uppercase tracking-widest text-slate-500">npm</p>
              <div className="mb-5 flex flex-wrap gap-2">
                {SEED_PACKAGES_NPM.map((pkg, i) => (
                  <span
                    key={pkg}
                    style={{ animationDelay: `${i * 50}ms` }}
                    className="pill-pop rounded-full border border-white/15 bg-navy-800 px-3 py-1 font-mono text-xs text-slate-300 transition hover:border-orange-400/50 hover:text-white"
                  >
                    {pkg}
                  </span>
                ))}
              </div>
              <p className="mb-2 font-mono text-xs uppercase tracking-widest text-slate-500">
                PyPI · new in v0.2.0
              </p>
              <div className="flex flex-wrap gap-2">
                {SEED_PACKAGES_PYPI.map((pkg, i) => (
                  <span
                    key={pkg}
                    style={{ animationDelay: `${i * 50}ms` }}
                    className="pill-pop rounded-full border border-orange-400/25 bg-navy-800 px-3 py-1 font-mono text-xs text-orange-200/90 transition hover:border-orange-400/60 hover:text-white"
                  >
                    {pkg}
                  </span>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Contribute */}
      <section id="contribute" className="border-t border-white/5 bg-navy-900/40 py-24">
        <div className="mx-auto max-w-6xl px-4">
          <SectionHeading
            eyebrow="Contribute"
            title="Know the successor of a dead package?"
            sub="Adding a record is the highest-value, lowest-friction contribution. No TypeScript required — npm and PyPI records both welcome."
          />
          <div className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: GithubIcon, step: '1. Fork', body: 'Fork the repository on GitHub.' },
              {
                icon: BookOpenCheck,
                step: '2. Copy the example',
                body: 'Duplicate a worked example from SCHEMA.md — there\u2019s one for npm and one for PyPI.',
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
            ].map((item, i) => (
              <Reveal key={item.step} delay={i * 80}>
                <div className="card-lift h-full rounded-2xl border border-white/10 bg-navy-900 p-5 hover:border-orange-400/40">
                  <item.icon className="mb-3 h-5 w-5 text-orange-400" />
                  <h3 className="mb-1 font-semibold text-white">{item.step}</h3>
                  <p className="text-sm text-slate-400">{item.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal>
            <blockquote className="mx-auto mt-10 max-w-2xl border-l-2 border-orange-400/60 pl-4 text-sm italic text-slate-400">
              &ldquo;PRs with weak or unverifiable evidence will be asked for more evidence, not
              merged as-is. The entire value of this dataset is that people can trust it.&rdquo;{' '}
              <span className="mt-1 block not-italic text-slate-500">— CONTRIBUTING.md</span>
            </blockquote>
          </Reveal>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-24">
        <div className="mx-auto max-w-3xl px-4">
          <SectionHeading eyebrow="FAQ" title="Questions people actually ask" />
          <div className="space-y-4">
            {FAQS.map((faq, i) => (
              <Reveal key={faq.q} delay={i * 60}>
                <details className="group rounded-xl border border-white/10 bg-navy-900 p-5 transition hover:border-white/20 open:border-orange-400/40">
                  <summary className="cursor-pointer font-medium text-white marker:text-orange-400">
                    {faq.q}
                  </summary>
                  <p className="faq-body mt-3 text-sm leading-relaxed text-slate-400">{faq.a}</p>
                </details>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-white/5 bg-navy-900/40 py-24 text-center">
        <div className="mx-auto max-w-2xl px-4">
          <Reveal>
            <LifeBuoy className="mx-auto mb-6 h-12 w-12 text-orange-400" />
            <h2 className="text-3xl font-bold text-white">
              Your auth library was abandoned in 2022.
            </h2>
            <p className="mt-3 text-lg text-slate-400">
              JavaScript or Python — find out in the next 30 seconds.
            </p>
          </Reveal>
          <Reveal delay={150}>
            <div className="mt-8 flex flex-col items-center justify-center gap-3">
              <CopyCommand command="npm i graveyard-check" />
              <div className="flex flex-col items-center gap-3 sm:flex-row">
                <CopyCommand command="graveyard-check scan" />
                <CopyCommand command="graveyard-check scan --ecosystem pypi" />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-sm text-slate-500 sm:flex-row">
          <div className="flex items-center gap-2">
            <LifeBuoy className="h-4 w-4 text-orange-400" />
            <span>Graveyard Check v0.2.0 — MIT licensed open source</span>
          </div>
          <div className="flex items-center gap-6">
            <a href={GITHUB_URL} className="nav-link transition hover:text-white">
              GitHub
            </a>
            <a
              href={`${GITHUB_URL}/blob/main/CONTRIBUTING.md`}
              className="nav-link transition hover:text-white"
            >
              Contributing
            </a>
            <a
              href={`${GITHUB_URL}/blob/main/data/successors/SCHEMA.md`}
              className="nav-link transition hover:text-white"
            >
              Dataset schema
            </a>
            <a
              href={`${GITHUB_URL}/blob/main/docs/github-action.md`}
              className="nav-link transition hover:text-white"
            >
              Action docs
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
