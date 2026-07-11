# Successor record schema

Each file in this directory maps one abandoned ("dead") package to its
recommended replacements. One package per file; name the file after the dead
package (e.g. `request.yaml`, or `scope__name.yaml` for scoped packages).

Records are validated on load. A malformed file fails the build with an error
naming the file, so please check your record against the shape below before
submitting a PR.

## Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `deadPackage` | string | yes | Exact registry name of the abandoned package. |
| `ecosystem` | `npm` \| `pypi` \| `go` \| `crates` | yes | Which package registry the record applies to. |
| `deprecatedSince` | date (`YYYY-MM-DD`) or `null` | yes | When the package was officially deprecated. Use `null` if there was no formal deprecation. |
| `successors` | list (min 1) | yes | Recommended replacements, best option first. |
| `notes` | string or `null` | yes | Free-form context: migration guides, caveats, links. Use `null` if none. |

### Successor entries

Each item in `successors` has:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | Registry name of the replacement package. |
| `repoUrl` | URL | yes | Its source repository. |
| `type` | see below | yes | How the replacement relates to the dead package. |
| `migrationEffort` | see below | yes | Rough cost of switching. |
| `evidence` | list of strings (min 1) | yes | Concrete, checkable reasons this is a good successor. |
| `lastVerified` | date (`YYYY-MM-DD`) | yes | When a human last confirmed this entry is accurate. |

**`type` values**

- `official-successor` — endorsed or published by the original maintainer/org.
- `community-fork` — a fork that became the de-facto maintained continuation.
- `api-compatible-alternative` — different project with a similar API; often near drop-in.
- `different-approach` — solves the same problem but requires rethinking integration.

**`migrationEffort` values**

- `drop-in` — swap the dependency with minimal or no code changes.
- `minor-changes` — localized edits (imports, config, a few API calls).
- `rewrite-required` — substantial refactor; same problem space, different shape.

## Fully commented example

```yaml
# The exact npm name of the abandoned package.
deadPackage: request

# One of: npm, pypi, go, crates
ecosystem: npm

# ISO date the package was formally deprecated, or null if it just went quiet.
deprecatedSince: 2020-02-11

successors:
  # Best recommendation first — the CLI shows them in this order.
  - name: got
    repoUrl: https://github.com/sindresorhus/got
    # got is a separate project with a similar API, not a fork of request.
    type: api-compatible-alternative
    # Most call sites need small edits (promise-based API, option renames).
    migrationEffort: minor-changes
    evidence:
      # Keep evidence factual and verifiable — reviewers will check these.
      - Recommended in request's own deprecation issue (request/request#3143)
      - Actively maintained with regular releases
    # Date YOU verified the above is still true, not the date you wrote it.
    lastVerified: 2026-07-01

  - name: axios
    repoUrl: https://github.com/axios/axios
    type: api-compatible-alternative
    migrationEffort: minor-changes
    evidence:
      - Most widely adopted HTTP client on npm
      - Active maintainer team and release cadence
    lastVerified: 2026-07-01

# Anything a migrating user should know that doesn't fit above. null if none.
notes: >-
  request was formally deprecated in February 2020. See
  https://github.com/request/request/issues/3142 for the maintainer's
  rationale and the full list of recommended alternatives.
```
