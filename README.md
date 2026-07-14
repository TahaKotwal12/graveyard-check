# Graveyard Check

[![CI](https://github.com/TahaKotwal12/graveyard-check/actions/workflows/ci.yml/badge.svg)](https://github.com/TahaKotwal12/graveyard-check/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Find maintained successors for abandoned dependencies.

Dependabot tells you when there's a new version. Nothing tells you when there will _never_ be a new version. Graveyard Check reads your dependency files, flags dependencies that are effectively dead — using evidence, not vibes — and recommends the verified community successor to migrate to.

## Supported ecosystems

| Ecosystem   | Input                     | Status           |
| ----------- | ------------------------- | ---------------- |
| npm         | `package-lock.json` v2/v3 | ✅ Supported     |
| PyPI        | `requirements.txt`        | ✅ New in v0.2.0 |
| Go modules  | `go.mod`                  | Planned          |
| Rust crates | `Cargo.lock`              | Planned          |

`poetry.lock` and `Pipfile.lock` are detected but not parsed yet. pnpm and Yarn
lockfiles are also planned.

## Usage

```bash
npx graveyard-check scan
```

```
2 of 142 dependencies look abandoned or at risk:

  request            Package deprecated on npm: request has been deprecated, see https://github.com/request/request/issues/3142
    -> successors: got (api compatible alternative, minor-changes), axios (api compatible alternative, minor-changes)
  some-lib           No commits in 2.4 years, No release in 2.4 years

Scanned 142 dependencies: 139 maintained, 1 at risk, 2 likely abandoned
```

Check a single package without a project:

```bash
npx graveyard-check check request
```

Package names can exist in more than one registry, so `check` defaults to npm
and never guesses. Select PyPI explicitly:

```bash
npx graveyard-check check requests --ecosystem pypi
```

```
request 2.88.2
Status: likely-abandoned
  - Package deprecated on npm: request has been deprecated, see https://github.com/request/request/issues/3142

Recommended successors:
  got             api-compatible-alternative   minor-changes
    - Listed in request's maintainer-curated alternatives list (request/request#3143)
    - 19 stable npm releases in the 12 months to 2026-07-11; latest 15.1.0 published 2026-07-02
```

`check` exits 1 when the package is at-risk or likely-abandoned, so it works as a CI gate or shell guard on its own.

### Flags

| Flag                      | Command | Description                                                |
| ------------------------- | ------- | ---------------------------------------------------------- |
| `--json`                  | `scan`  | Output the raw scan result as JSON for CI/scripting        |
| `--ecosystem <npm\|pypi>` | `scan`  | Select an ecosystem; otherwise auto-detect, preferring npm |
| `--direct-only`           | `scan`  | Skip transitive dependencies (much faster)                 |
| `--severity <level>`      | `scan`  | Only show `at-risk` or `likely-abandoned` findings         |
| `--verbose`               | `scan`  | Include the count of packages with insufficient data       |
| `--ecosystem <npm\|pypi>` | `check` | Registry containing the package (default: `npm`)           |

When a project contains both `package-lock.json` and `requirements.txt`, npm is
scanned by default. Run a second scan with `--ecosystem pypi` for Python:

```bash
npx graveyard-check scan
npx graveyard-check scan --ecosystem pypi
```

JSON output includes `ecosystem` on every dependency so reports from the two
scans can be combined safely in CI. Terminal output stays intentionally compact.

### GitHub token (recommended)

Graveyard Check queries the GitHub API for repository activity. Unauthenticated requests are limited to 60/hour, which a real scan will exhaust. Set a token (a fine-grained token with read-only public repository access is enough):

```bash
export GITHUB_TOKEN=ghp_...   # or $env:GITHUB_TOKEN = "ghp_..." in PowerShell
```

### GitHub Action

Run Graveyard Check weekly in CI and fail the build on abandoned dependencies — see [docs/github-action.md](docs/github-action.md).

## How verdicts work

Graveyard Check is conservative by design: a false "abandoned" claim is worse than a missed one.

- npm's native `deprecated` flag is maintainer-confirmed truth and immediately marks a package **likely-abandoned**.
- PyPI's `Development Status :: 7 - Inactive` classifier carries the same weight: it is also an explicit maintainer declaration.
- An archived GitHub repository, or 24+ months without commits _and_ releases, also means **likely-abandoned**.
- 12–24 months of staleness means **at-risk**.
- If the repository can't be found, the verdict is **insufficient-data** — never a guess.

Every verdict ships with its evidence ("No release in 3.1 years"), never a bare label.

## The successor dataset

Recommendations come from a public, reviewable dataset of YAML records in [`data/successors/`](data/successors/) — each mapping a dead package to verified successors with evidence and a last-verified date. It's seeded with famous cases (request, node-sass, moment, tslint, the colors/faker incidents, and more).

**This is the easiest and most valuable way to contribute.** Know the de-facto successor of a dead package? Add a record: see [CONTRIBUTING.md](CONTRIBUTING.md) and the [record schema](data/successors/SCHEMA.md).

## Other JavaScript package managers

For pnpm/Yarn projects, generate an npm lockfile just for the scan:

```bash
npm install --package-lock-only --ignore-scripts
```

## License

[MIT](LICENSE)
