# Distribution: template repo + upstream sync, not npm/package

## Status

proposed

## Context

The public Tool repo must be both the reusable tool and James's own (separate,
private) Instance, which "consumes from" the Tool repo. Options for "consume":
publish an npm package / reusable Action the Instance depends on, or distribute the
whole app as a template the Instance is a copy of.

## Decision (proposed)

Distribute Beachfront as a **GitHub template repository**. A new Instance is created
via "Use this template" (James's is a private copy). Personal data lives only in the
Instance's `beachfront.config.*`, `repos/` Registry, and secrets — never in shared
code (per the config-driven rule). Instances **consume upstream updates by syncing
from the Tool repo** (an upstream remote / periodic sync workflow), since the app is
a static site, not a library others import.

## Consequences

- Zero packaging/publishing overhead; one codebase, one deploy story.
- Updates are a merge/sync the Instance owner performs, not a version bump — fine
  for a smallish tool, but template drift is a known cost to manage.
- Revisit and promote to `accepted` (or switch to a published Action/package) if
  multiple Instances and frequent updates make sync painful.
