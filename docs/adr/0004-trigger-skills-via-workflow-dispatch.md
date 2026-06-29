# Trigger Skills via workflow_dispatch; results return through Aggregation

## Status

accepted

## Context

Beachfront should let a Viewer invoke a Skill (e.g. `triage`, `diagnose`) against a
Managed repo or issue, and see the result — while staying read-mostly, storage-free,
and backend-free (browser → GitHub API with the Viewer's token).

## Decision

- **Trigger:** a dedicated workflow the init step installs in each Managed repo
  (e.g. `.github/workflows/beachfront-skill.yml`) exposed via **`workflow_dispatch`**
  with typed inputs — `skill` (open-ended name), `issue`, and a `correlation_id`.
  The browser calls it directly with the Viewer's token (CORS-supported).
- **Open-ended skills:** the workflow takes the skill name as an input, so new
  Matt-Pocock skills are invokable with no Beachfront change.
- **Result surfacing:** the Skill run leaves a PR / issue comment in the Managed
  repo; Beachfront shows it through normal Aggregation, with a link to the Actions
  run. No result store, no webhooks back to Beachfront.
- **Correlation:** because `workflow_dispatch` returns `204` with no run id,
  Beachfront passes a `correlation_id` input that the workflow stamps into the
  branch name / PR title, then finds the run by polling the Actions list
  (workflow + `event=workflow_dispatch` + recent) and matches the PR by that id.

## Consequences

- Triggering needs `actions:write` (and writes need `issues:write`) on the Viewer's
  token — a read-only PAT yields a read-only pane; a read-write token unlocks
  editing and triggering. Token scope is the capability gate (extends ADR-0001).
- Run state is derived live from the Actions API, not persisted — refresh-based,
  acceptable for a read-mostly pane.
