# Contributing to Graveyard Check

The most valuable contribution you can make is a **successor record**: a small
YAML file mapping a dead package to its verified replacement. No TypeScript
knowledge needed. The whole dataset lives in [`data/successors/`](data/successors/).

## Submitting a successor record

1. **Fork** this repository.
2. **Copy the commented example** from [`data/successors/SCHEMA.md`](data/successors/SCHEMA.md)
   into a new file named after the dead package, e.g. `data/successors/left-pad.yaml`.
3. **Fill it in with real, checkable evidence.** Good evidence:
   - a maintainer's own deprecation notice or endorsement (link the issue/README)
   - a migration guide published by either project
   - concrete activity numbers with dates ("14 releases in the 12 months to 2026-07-11")
4. **Validate locally** (optional but saves a round-trip):

   ```bash
   pnpm install
   pnpm vitest run test/dataset.test.ts
   ```

   A malformed record fails with an error naming your file and the exact field.
5. **Open a PR.** CI runs the same validation automatically.

### The evidence bar

Every claim in a record must be verifiable by a reviewer following your links,
and every date-sensitive claim needs a `lastVerified` date. **PRs with weak or
unverifiable evidence will be asked for more evidence, not merged as-is.**
That's not gatekeeping for its own sake — the entire value of this dataset is
that people can trust it. Vague-but-honest ("actively maintained, exact release
cadence not confirmed") beats precise-but-guessed every time; a number you
didn't verify is worse than no number.

A few specific rules:

- `deprecatedSince` must be a date you can source (announcement post, npm flag
  date). If you can't source it, use `null`.
- Successor `evidence` needs at least one item that is an endorsement or
  adoption fact, not just "it's newer".
- Don't add records for packages that are merely quiet. Stable and finished is
  not abandoned — the abandonment detector handles staleness; the dataset is
  for packages with a known successor story.

## Code contributions

```bash
pnpm install
pnpm test        # vitest
pnpm lint        # eslint
pnpm typecheck   # tsc --noEmit
pnpm build       # tsup -> dist/cli.js
```

All four must pass in CI. For anything larger than a bug fix, open an issue
first so we can agree on the approach before you invest time.
