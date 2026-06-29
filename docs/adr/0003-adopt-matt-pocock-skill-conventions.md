# Adopt Matt Pocock's skill conventions as the state model and integration contract

## Status

accepted

## Context

Beachfront needs a uniform, machine-readable way to know each issue's lifecycle
state across many repos, so the cross-repo Attention queue and "keep agents fed"
pool work. We could invent a Beachfront label vocabulary, but the Managed repos
already run Matt Pocock's engineering skills (`triage`, `to-issues`, `diagnose`,
…), which define exactly this — and a per-repo config that maps it.

## Decision

Beachfront **adopts Matt Pocock's skill conventions wholesale** rather than
defining its own:

- **State model = the `triage` state machine.** Canonical categories `bug` /
  `enhancement`; canonical states `needs-triage`, `needs-info`, `ready-for-agent`,
  `ready-for-human`, `wontfix`. Beachfront classifies issues by these roles.
- **Integration contract = `docs/agents/`.** Beachfront reads each Managed repo's
  `docs/agents/triage-labels.md` (the role→label Mapping), `issue-tracker.md`
  (issue location + whether external PRs are a triage surface), and `domain.md`.
  It consumes this contract; it does not define labels or impose them.
- **The Attention queue mirrors `triage`'s "what needs attention"** buckets
  (unlabeled, `needs-triage`, `needs-info` with reporter activity), aggregated
  across all Managed repos, with a companion cross-repo `ready-for-agent` pool.

Onboarding a repo therefore includes running `setup-matt-pocock-skills` so the
`docs/agents/` contract exists for Beachfront to read.

## Consequences

- Beachfront imposes no labels and stays compatible with repos that remap them.
- Beachfront is **coupled to the shape of `docs/agents/`** and the canonical role
  names. If Matt's skills change that shape, Beachfront's reader must follow. This
  coupling is deliberate — Beachfront is explicitly a companion to that ecosystem.
- Repos that have not run the skills setup can still be linked, but render with
  reduced fidelity (no role classification) until the contract exists.
- "Invokable Skill" is open-ended: the trigger workflow takes a skill name, so new
  Matt-Pocock skills work without Beachfront changes (see ADR on triggering).
