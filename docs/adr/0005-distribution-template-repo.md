# Distribution: template repo + upstream sync, not npm/package

## Status

accepted

## Context

The public Tool repo must be both the reusable tool and James's own (separate,
private) Instance, which "consumes from" the Tool repo. Options for "consume":
publish an npm package / reusable Action the Instance depends on, or distribute the
whole app as a template the Instance is a copy of.

A decisive constraint rules out the obvious alternative: a **fork of a public repo
cannot be made private**, and James's dogfooding Instance must be private (ADR-0001).
"Use this template" *can* generate a private repo from a public template. So template
is the only mechanism that yields a private Instance — but it comes with a catch (see
sync, below).

## Decision

Distribute Beachfront as a **GitHub template repository**. A new Instance is created
via "Use this template" (James's is a private copy). Personal data lives only in the
Instance's `beachfront.config.*`, `repos/` Registry, and secrets — never in shared
code (per the config-driven rule), since the app is a static site, not a library
others import.

**Sync mechanism.** A template-generated repo has *unrelated* git history to the Tool
repo, so a plain `git merge upstream/main` fails (`refusing to merge unrelated
histories`). Instances therefore consume upstream updates via a **template-sync Action
that opens a PR** with the upstream changes (e.g. `actions-template-sync`), *not* a raw
git-remote merge. It runs on manual `workflow_dispatch` first; a schedule can follow.
Conflicts stay rare because the config-driven seam confines per-Instance divergence to
`beachfront.config.*`, `repos/`, and secrets — everything else is shared and merges clean.

## Consequences

- Zero packaging/publishing overhead; one codebase, one deploy story.
- Updates arrive as a sync PR the Instance owner reviews and merges, not a version bump
  — fine for a smallish tool, but template drift is a known cost to manage.
- The sync Action is itself something onboarding must install into an Instance.
- Revisit (or switch to a published Action/package) if multiple Instances and frequent
  updates make sync painful.
