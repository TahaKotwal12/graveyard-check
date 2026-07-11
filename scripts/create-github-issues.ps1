# Creates labels and starter issues for graveyard-check (run once).
$ErrorActionPreference = 'Stop'

$envFile = Join-Path (Join-Path $PSScriptRoot '..') '.env'
if (-not (Test-Path $envFile)) { throw '.env not found — set GITHUB_TOKEN' }
$tokenLine = Get-Content $envFile | Where-Object { $_ -match '^\s*GITHUB_TOKEN\s*=' } | Select-Object -First 1
if (-not $tokenLine) { throw 'GITHUB_TOKEN not found in .env' }
$token = ($tokenLine -split '=', 2)[1].Trim().Trim('"').Trim("'")

$owner = 'TahaKotwal12'
$repo = 'graveyard-check'
$base = "https://api.github.com/repos/$owner/$repo"
$headers = @{
  Authorization = "Bearer $token"
  Accept        = 'application/vnd.github+json'
  'X-GitHub-Api-Version' = '2022-11-28'
  'User-Agent'  = 'graveyard-check-setup'
}

function Ensure-Label($name, $color, $description) {
  $body = @{ name = $name; color = $color; description = $description } | ConvertTo-Json
  try {
    Invoke-RestMethod -Uri "$base/labels" -Method Post -Headers $headers -Body $body -ContentType 'application/json' | Out-Null
    Write-Host "Created label: $name"
  } catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 422) {
      Write-Host "Label exists: $name"
    } else { throw }
  }
}

function New-Issue($title, $labels, $body) {
  $payload = @{
    title  = $title
    labels = $labels
    body   = $body
  } | ConvertTo-Json -Depth 5
  $issue = Invoke-RestMethod -Uri "$base/issues" -Method Post -Headers $headers -Body $payload -ContentType 'application/json'
  Write-Host "Created issue #$($issue.number): $($issue.title)"
  return $issue
}

Ensure-Label 'good first issue' '0e8a16' 'Small, well-scoped — great for newcomers'
Ensure-Label 'dataset' '5319e7' 'Successor YAML records in data/successors/'
Ensure-Label 'enhancement' '1d76db' 'New features and improvements'
Ensure-Label 'documentation' 'fbca04' 'README, website, and docs'
Ensure-Label 'help wanted' 'e99695' 'Needs research or community input'
Ensure-Label 'research' 'c5def5' 'Evidence gathering before a record or PR'

$issues = @(
  @{
    title = '[dataset] Research backlog: suggest abandoned npm packages'
    labels = @('dataset', 'help wanted', 'research')
    body = @'
Help build the successor dataset backlog. Comment on this issue with abandoned packages you have seen in real projects.

**Format for each suggestion:**
```
Package: example-pkg
Why abandoned: ...
Proposed successor: ...
Evidence link: ...
```

Maintainers will turn confirmed entries into labeled `dataset` issues.

**Already covered:** request, request-promise, node-sass, moment, istanbul, gulp-util, colors, faker, tslint

See [CONTRIBUTING.md](https://github.com/TahaKotwal12/graveyard-check/blob/main/CONTRIBUTING.md) and [SCHEMA.md](https://github.com/TahaKotwal12/graveyard-check/blob/main/data/successors/SCHEMA.md).
'@
  }
  @{
    title = '[dataset] Add successor record: create-react-app'
    labels = @('dataset', 'good first issue')
    body = @'
CRA was officially deprecated. Add `data/successors/create-react-app.yaml` mapping to maintained alternatives (e.g. Vite, Next.js, Remix) with maintainer/community evidence.

**Acceptance criteria**
- Follow [`data/successors/SCHEMA.md`](data/successors/SCHEMA.md)
- At least 2 successors with verifiable evidence links
- `pnpm vitest run test/dataset.test.ts` passes

**References to research**
- CRA deprecation announcement
- Official migration guides from successor projects
'@
  }
  @{
    title = '[dataset] Add successor record: jade'
    labels = @('dataset', 'good first issue')
    body = @'
`jade` was renamed to `pug` years ago; many old lockfiles still pull `jade`.

Add `data/successors/jade.yaml` with evidence that `pug` is the official continuation.

See existing records like `request.yaml` for tone and evidence bar.
'@
  }
  @{
    title = '[dataset] Add successor record: mysql'
    labels = @('dataset', 'good first issue')
    body = @'
The original `mysql` package is unmaintained; `mysql2` is the de-facto replacement in the Node ecosystem.

Add a record with migration effort notes (API differences) and release activity evidence.
'@
  }
  @{
    title = '[dataset] Add successor record: inflight'
    labels = @('dataset', 'help wanted')
    body = @'
`inflight` is a classic transitive ghost dependency (often via old `glob`). Document the successor story — typically remove/replace upstream or migrate to maintained alternatives.

This is a good issue for someone who understands npm dependency trees.
'@
  }
  @{
    title = '[dataset] Refresh existing successor records (quarterly verification)'
    labels = @('dataset', 'good first issue')
    body = @'
Each successor record has a `lastVerified` date. Pick any file in `data/successors/`, re-check every evidence claim and release activity, update dates if still accurate.

**Good first issue** — no new packages, just keeping the dataset trustworthy.

Run `pnpm vitest run test/dataset.test.ts` after edits.
'@
  }
  @{
    title = '[enhancement] Add --json flag to graveyard-check check'
    labels = @('enhancement', 'good first issue')
    body = @'
`scan` already supports `--json`. Add the same for `check` so CI scripts can gate on a single package without parsing terminal output.

**Acceptance criteria**
- `graveyard-check check request --json` prints structured JSON to stdout
- Exit code behavior unchanged (still exits 1 for at-risk/likely-abandoned)
- Test added in `test/`
'@
  }
  @{
    title = '[docs] Add "packages we are looking for" table to CONTRIBUTING.md'
    labels = @('documentation', 'good first issue')
    body = @'
Add a table to CONTRIBUTING.md listing high-priority packages that need successor records, with links to open dataset issues.

**Suggested entries:** create-react-app, jade, mysql, inflight, vue@2, grunt, bower, har-validator, hawk

Link each row to the corresponding GitHub issue where one exists.
'@
  }
  @{
    title = '[enhancement] Support pnpm-lock.yaml parsing'
    labels = @('enhancement', 'help wanted')
    body = @'
README says pnpm/yarn are planned. Implement lockfile parsing for `pnpm-lock.yaml` so pnpm projects do not need the `npm install --package-lock-only` workaround.

**Scope**
- Parse direct dependencies (transitive can be a follow-up)
- Clear error if lockfile format is unsupported
- Tests with fixture lockfiles
'@
  }
  @{
    title = '[docs] Publish GitHub Action v1 tag and document release process'
    labels = @('documentation', 'help wanted')
    body = @'
Action docs reference `TahaKotwal12/graveyard-check@v1` but the tag may not exist yet.

**Tasks**
- Create and push a `v1` tag pointing at a stable release
- Document the tagging/release process in CONTRIBUTING.md
- Verify the composite action works when referenced by tag
'@
  }
)

foreach ($item in $issues) {
  New-Issue $item.title $item.labels $item.body | Out-Null
}

Write-Host 'Done.'
