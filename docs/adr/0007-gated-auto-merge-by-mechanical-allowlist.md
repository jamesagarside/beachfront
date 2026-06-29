# Auto-merge is gated by mechanical criteria, never by AI judgement

## Status

proposed

## Context

The autonomous Sandcastle loop (ADR-0006) opens a PR per run and the human merge is the
gate. As the `ready-for-agent` backlog drains, that gate becomes the bottleneck: a human
must merge every bot PR, including ones that are mechanically safe (a dependency bump that
passes tests, a doc typo, a test-only change). We want to relieve the human of the safe
cases **without** ever letting a risky change through.

The tempting-but-wrong design is "let an AI decide if a PR is trivial." Triviality is a
judgement call, and an AI judging its own work is exactly the failure mode the PR gate
exists to catch. Safety must come from **mechanical, auditable facts** — checks and paths —
not from a model's opinion.

## Decision

Auto-merge a PR **only** when *all* of the following mechanical conditions hold; otherwise
it stays human-gated:

1. **All required checks are green** — the #42 CI contexts (`typecheck`/`test`/`build`),
   required via branch protection (#43). No green checks, no auto-merge.
2. **Every changed path matches a tight allowlist.** Allowlist v1:
   - dependency bumps: `package.json`, `package-lock.json`
   - docs: `**/*.md`
   - tests only: `src/test/**`, `**/*.test.*`
3. **Author/label gate:** the PR author is `sandcastle[bot]`, or the PR carries an explicit
   `automerge-safe` label a human applied.

Mechanism: **GitHub-native auto-merge** (`gh pr merge --auto`), enabled by a gate workflow
that diffs the PR's changed paths against the allowlist and checks conditions 1 and 3. If
all hold it enables auto-merge (which GitHub then completes once required checks pass); if
any path falls outside the allowlist, it does nothing and the PR waits for a human.

**Always excluded — these stay human-gated regardless of checks:**

- user-visible / brand surfaces: `**/*.css`, colours, `docs/brand.md` (brand is human-governed)
- security: `src/auth/**`
- per-Instance config: `beachfront.config.*`
- automation itself: `.github/workflows/**`

An independent reviewer agent **may** add an approval, but it is never *what makes the merge
safe* — green checks + the allowlist are. The reviewer is additive, not load-bearing.

## Consequences

- Safe, repetitive PRs merge without a human; risky ones still wait. The human's attention
  goes only where judgement is actually needed.
- Safety is auditable: "why did this merge?" always answers in terms of checks + paths, never
  "an AI thought it looked fine."
- The allowlist is deliberately narrow and will feel too strict at first. That is the correct
  bias — widen it only with evidence, never to unblock a one-off.
- Depends on #42 (CI) and #43 (required checks); meaningless without both.
- A path-glob allowlist can't see *semantic* risk inside an allowed path (e.g. a malicious
  dependency bump). The green-checks requirement is the backstop; if that proves insufficient,
  revisit (e.g. pin/audit dependencies) rather than loosening the gate.
