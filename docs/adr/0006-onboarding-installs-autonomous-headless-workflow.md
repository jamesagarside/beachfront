# Onboarding installs an autonomous, headless Sandcastle workflow

## Status

accepted

## Context

Beachfront's reason to exist is "a view of all automated agents running across our
repos." That view is only meaningful if agents are *actually running on their own*.
Sandcastle, however, has no built-in CI or scheduler — it runs wherever it's invoked,
which by default is a developer's laptop (`npm run sandcastle`). A manual, local-only
loop produces no continuous activity to observe and isn't a conducive workflow.

## Decision

**Beachfront onboarding installs an autonomous, headless Sandcastle workflow** into
each Managed repo: a `.github/workflows/sandcastle.yml` that runs the loop on GitHub
Actions, triggered automatically — on a **schedule** and when an issue is **labelled
`ready-for-agent`** — plus manual `workflow_dispatch`. It uses the repo's built-in
`GITHUB_TOKEN` for GitHub access (no PAT) and a Claude credential from **repo Secrets**.

Autonomous runs **open a pull request** for review rather than pushing to `main` — the
human merge stays the gate. The Agent runs this produces are exactly what Beachfront's
Agent-run view surfaces (Agent run = Actions workflow run, per ADR-0004).

When a run opens its PR it moves the issue `ready-for-agent` → **`in-progress`** (an
operational marker outside Matt's triage vocabulary), so the loop never re-picks an
issue whose PR is already open. The PR's `Closes #N` returns it to a closed state on
merge; an abandoned (closed-unmerged) PR should restore `ready-for-agent`.

This is distinct from the on-demand `beachfront-skill.yml` of ADR-0004: that is a
Viewer triggering *one named Skill* on *one issue*; this is the *standing loop* that
drains the `ready-for-agent` backlog continuously.

## Consequences

- Onboarding must set one repo Secret (the Claude credential) per Managed repo; the
  GitHub side needs no PAT.
- Autonomous spend is real — guarded by single-run **concurrency**, a **conservative
  schedule**, and the **PR review gate**. The schedule ships disabled until a manual
  dispatch run is verified in that repo.
- The Sandcastle Docker sandbox must run on a GitHub-hosted runner; this needs
  verifying per setup and may require a CI-specific branch strategy so work is pushed
  as a PR rather than lost in the runner.
- Without this engine the pane of glass is empty — so it is core, not optional.
