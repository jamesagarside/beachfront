# Explicit per-repo Registry, populated by Linking — not topic discovery

## Status

accepted

## Context

An Instance needs to know which repos to aggregate. A GitHub topic scan
(`--topic sandcastle`) is zero-maintenance and self-registering, but it is awkward
across multiple orgs, conflates "labelled" with "actually onboarded," and gives no
natural onboarding moment. We want explicit, auditable peering that also works for
org repos not under the owner's own name.

## Decision

Discovery is an **explicit Registry**: a `repos/` **directory with one file per
peered repo** (e.g. `repos/<owner>/<repo>.json`). One file per repo keeps
concurrent onboarding PRs conflict-free and makes the tracked set easy to read.

The Registry is populated only by **Linking**, never hand-edited, via three
producers that all converge on a PR to the Instance:

1. **UI (pull):** the static SPA uses the Viewer's own token to add the file and
   open the PR.
2. **Beachfront command (pull):** a local command does the same via `gh`.
3. **Sandcastle onboarding (push):** initialising a repo opens the PR on the
   configured Instance via `gh`.

Aggregation reads each Registry repo **as the Viewer's own token**; a linked repo
the Viewer cannot access simply does not render for them. The Registry is therefore
a list of *candidates*, and GitHub repo access remains the gate (see ADR-0001).

## Consequences

- **Documented assumption:** whoever runs onboarding already has `gh`/token access
  to both the repo being linked *and* the target Instance repo (to open the PR).
  Beachfront does not provision or broker that access — it uses the operator's
  existing credentials.
- A repo can be linked before or independently of being Sandcastle-onboarded; the
  Registry entry and the actual Sandcastle setup are separate steps.
- Per-repo files mean the "tracked set" is greppable and diffable, at the cost of
  many small files instead of one.
