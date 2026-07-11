# Starter issues for community contributions

Run after your GitHub token has **Issues: Read and write** on this repo:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/create-github-issues.ps1
```

Or create labels manually in GitHub → Issues → Labels, then run the script.

## Labels

| Label | Description |
| --- | --- |
| `good first issue` | Small, well-scoped — great for newcomers |
| `dataset` | Successor YAML records in `data/successors/` |
| `enhancement` | New features and improvements |
| `documentation` | README, website, and docs |
| `help wanted` | Needs research or community input |
| `research` | Evidence gathering before a record or PR |

## Issues created by the script

1. `[dataset] Research backlog: suggest abandoned npm packages` — pin this one
2. `[dataset] Add successor record: create-react-app`
3. `[dataset] Add successor record: jade`
4. `[dataset] Add successor record: mysql`
5. `[dataset] Add successor record: inflight`
6. `[dataset] Refresh existing successor records (quarterly verification)`
7. `[enhancement] Add --json flag to graveyard-check check`
8. `[docs] Add "packages we are looking for" table to CONTRIBUTING.md`
9. `[enhancement] Support pnpm-lock.yaml parsing`
10. `[docs] Publish GitHub Action v1 tag and document release process`
