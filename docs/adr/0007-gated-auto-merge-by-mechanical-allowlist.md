# Auto-merge is gated by mechanical criteria, never by AI judgement

## Status

accepted

## Context

The autonomous Sandcastle loop (ADR-0006) opens a PR per run and the human merge is the
gate. As the `ready-for-agent` backlog drains, that gate becomes the bottleneck, and a
human ends up merging PRs that are mechanically safe and uninteresting. We want to relieve
the human of the genuinely safe cases **without** ever letting a risky change through.

The tempting-but-wrong design is "let an AI decide if a PR is trivial." Triviality is a
judgement call, and an AI judging its own work is exactly the failure mode the PR gate
exists to catch. Safety must come from **mechanical, auditable facts** — checks and paths —
not from a model's opinion.

Grilling this policy surfaced three facts that shaped it:

- **The loop's own PRs are already human-gated by construction.** Sandcastle drains
  `ready-for-agent` issues, which are features; those PRs touch `src/`, which is never on
  the allowlist. So auto-merge's real population is *not* the feature loop — it is small,
  mechanical, docs-shaped changes.
- **"Green checks" is not a backstop for dependency changes.** A compromised dependency
  passes your tests fine — tests check your behaviour, not a dependency's intent. So dep
  bumps are deliberately *out* of the v1 allowlist, despite being the obvious candidate.
- **A bot PR opened with `GITHUB_TOKEN` does not trigger CI** (GitHub's anti-recursion
  rule), so required checks would never report and the PR would be blocked forever. The PR
  must be opened by a non-`GITHUB_TOKEN` identity (see ADR-0006 amendment below).

## Decision

Auto-merge a PR **only** when *all* of the following mechanical conditions hold; otherwise
it stays human-gated:

1. **All required checks are green** — the #42 CI contexts (`typecheck`/`test`/`build`),
   required via branch protection (#43). `main` is **status-checks-only**: no required
   review, no self-approval (GitHub will not count an author's approval of their own PR
   anyway, so a single-identity self-approve loop is impossible by design).
2. **Every changed path is allowlisted.** Allowlist v1 is **Markdown only, minus the
   governance denylist**:
   - allowed: `**/*.md`
   - **denied even though `.md`** (human-governed): `docs/brand.md`, `docs/adr/**`,
     `CONTEXT.md`, `docs/agents/**`
   - everything non-`.md` (notably all of `src/**`, `**/*.css`, `beachfront.config.*`,
     `.github/workflows/**`) is outside the allowlist and stays human-gated.
3. **Author/label gate:** the PR author is the **Beachfront Sandcastle App** (the App
   installation identity that opens loop PRs — *not* `GITHUB_TOKEN`/`github-actions[bot]`),
   **or** a human applied an explicit `automerge-safe` label. The label is the one path
   that lets a human deliberately opt a `src/` PR into auto-merge after looking at it.

Mechanism: **GitHub-native auto-merge** (`gh pr merge --auto`), enabled by a gate workflow
(shipped in the template and installed per Managed repo by onboarding, like `sandcastle.yml`)
that diffs the PR's changed paths against the allowlist and checks conditions 1 and 3. If
all hold it enables auto-merge, which GitHub completes once required checks pass; if any path
falls outside the allowlist it does nothing and the PR waits for a human.

An independent reviewer agent **may** add an approval, but it is never *what makes the merge
safe* — green checks + the allowlist are. The reviewer is additive, not load-bearing.

### ADR-0006 amendment

ADR-0006 says the loop uses `GITHUB_TOKEN` with "no PAT." That holds for the agent's reads
and commits, but **the PR-open step now uses a separate identity** so CI fires on the PR.
Following the ADR-0001 pattern (App preferred, PAT fallback, chosen by the owner's access):
a **GitHub App installation token** mints inside the Action from the App's private key (the
Cloudflare Worker of ADR-0001 is *not* in this server-to-server path); a **fine-grained PAT**
in repo Secrets is the fallback for owners who won't run an App. Onboarding therefore
provisions this credential in addition to the Claude secret.

## Consequences

- Safe, repetitive docs PRs merge without a human; everything with code, brand, security,
  config, or workflow content still waits. The human's attention goes only where judgement
  is actually needed.
- Safety is auditable: "why did this merge?" always answers in terms of checks + paths, never
  "an AI thought it looked fine."
- v1 is deliberately tiny — narrative Markdown only. Widening it (e.g. to dependency bumps)
  is allowed *only with evidence and a new mechanical guard* (dependency pinning / audit /
  provenance as a required check), never to unblock a one-off.
- Depends on #42 (CI) and #43 (required checks + status-checks-only protection); meaningless
  without both. Also depends on the App/PAT PR-opener, without which no bot PR is ever
  checkable.
- A path-glob allowlist can't see *semantic* risk inside an allowed path. Confining v1 to
  non-governance Markdown keeps that residual risk close to zero (worst case: a sloppy README
  edit merges) rather than betting green checks can vet a dependency they can't.
