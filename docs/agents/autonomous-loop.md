# Autonomous loop: required workflows

The headless Sandcastle loop (ADR-0006) is not one workflow but a **set** that must ship
together. An onboarded repo needs all of these; dropping one breaks the loop or strands its
PRs. Agents editing the template must treat the set as a unit.

| Workflow | Role |
| --- | --- |
| `sandcastle.yml` | Runs the agent loop; opens a `sandcastle/auto-*` PR per run (App-token identity, ADR-0007). |
| `ci.yml` | Required status checks (`typecheck`/`test`/`build`) on every PR. |
| `automerge.yml` | Mechanical auto-merge for Markdown-only PRs (ADR-0007). |
| `auto-review.yml` | Independent review-agent gate; enables auto-merge on a PASS, blocks security/governance paths (ADR-0012). |
| `auto-update.yml` | Keeps behind auto-merge PRs current so they can actually merge (see below). |

## Requirement: PRs must be up to date to merge

Branch protection on `main` is **strict** — a PR must be up to date with `main` before it
merges. GitHub-native auto-merge does **not** auto-update a behind branch, so the moment one
PR merges, every other open auto-merge PR goes `BEHIND` and stalls. `auto-update.yml` is the
required piece that resolves this: on every push to `main` it updates behind auto-merge PRs,
re-running CI so they merge on green.

Two consequences agents must respect:

- **The branch update must use the GitHub App token, not `GITHUB_TOKEN`.** A
  `GITHUB_TOKEN`-pushed update does not re-trigger CI (the anti-recursion rule of ADR-0007),
  so the PR would wait forever on checks. The App credential (ADR-0007) is therefore a hard
  requirement for auto-merge to work, not just for opening PRs.
- **Do not weaken `strict` to dodge this.** Turning off "require up to date" would let PRs
  merge without testing against current `main` (semantic-conflict risk). `auto-update.yml`
  keeps the protection and the pace.

A PR that can't be updated because it conflicts (`DIRTY`) is left for a human / the
regenerate path (ADR-0006) — never hand-resolved by the loop.
