## Summary

<!-- What does this PR do? One or two sentences. -->

## Type

- [ ] Successor dataset record (`data/successors/*.yaml`)
- [ ] Bug fix
- [ ] Feature / enhancement
- [ ] Documentation / website

## Dataset checklist

<!-- Fill in for successor record PRs; delete section otherwise. -->

- [ ] Follows [`data/successors/SCHEMA.md`](data/successors/SCHEMA.md)
- [ ] Every evidence claim has a verifiable link
- [ ] `lastVerified` date is set and accurate
- [ ] Not adding a package that is merely quiet (stable ≠ abandoned)
- [ ] `pnpm vitest run test/dataset.test.ts` passes locally

## Code checklist

<!-- Fill in for code PRs; delete section otherwise. -->

- [ ] `pnpm test` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm typecheck` passes
- [ ] `pnpm build` passes

## Evidence / links

<!-- Maintainer will check these for dataset PRs. -->
