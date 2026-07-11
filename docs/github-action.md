# Graveyard Check GitHub Action

Runs `graveyard-check scan --json` against your repository, posts a markdown summary
of flagged dependencies to the job summary, and fails the build when
dependencies meet a severity threshold.

## Inputs

| Input | Default | Description |
| --- | --- | --- |
| `fail-on` | `likely-abandoned` | Severity that fails the build. `likely-abandoned` fails only on likely-abandoned dependencies; `at-risk` also fails on at-risk ones. |
| `github-token` | the workflow's automatic token | Used for GitHub API requests so the scan doesn't hit unauthenticated rate limits. |

## Recommended usage: weekly schedule

Abandonment status doesn't change hour to hour, so running on every push wastes
CI minutes and API quota. Run it weekly (plus a manual trigger for on-demand
checks):

```yaml
# .github/workflows/dependency-health.yml
name: Dependency health

on:
  schedule:
    - cron: '0 6 * * 1' # Mondays 06:00 UTC
  workflow_dispatch:

jobs:
  graveyard-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - uses: TahaKotwal12/graveyard-check@v1
        with:
          fail-on: likely-abandoned
```

If you do want it on pull requests as well (e.g. to catch newly added
dependencies), scope it to lockfile changes so it only runs when dependencies
actually changed:

```yaml
on:
  pull_request:
    paths:
      - 'package-lock.json'
```

## Failing on at-risk dependencies too

```yaml
      - uses: TahaKotwal12/graveyard-check@v1
        with:
          fail-on: at-risk
```

## Notes

- Graveyard Check currently reads `package-lock.json` (npm lockfile v2/v3). If your
  repo uses pnpm or yarn, generate one for the scan without touching
  `node_modules`: `npm install --package-lock-only --ignore-scripts`.
- The job summary table lists each flagged dependency with its evidence and
  the top suggested successor from the [successor dataset](../data/successors/SCHEMA.md).
- The scan makes unauthenticated npm registry requests and authenticated
  GitHub API requests using `github-token`. No other permissions are needed.
