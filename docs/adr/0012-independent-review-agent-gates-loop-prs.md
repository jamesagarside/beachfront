# An independent review agent gates loop PRs for auto-merge

## Status

accepted

## Context

ADR-0007 made auto-merge mechanical-only: green checks + a Markdown-only path allowlist +
the App-author identity. It deliberately kept **all `src/` (feature) PRs human-gated**,
because "green checks" proves the tests pass, not that a feature is correct, and "an AI
judging its own work is exactly the failure mode the PR gate exists to catch."

That decision is sound, but it has a cost the dogfooding Instance now feels: the Sandcastle
loop drains `ready-for-agent` issues into `src/` PRs, so **none** of the loop's output is
auto-merge eligible. Every feature PR waits on a human, and the human merge becomes the
pace limiter — exactly the bottleneck ADR-0007 set out to relieve, just relocated from
"merging trivial docs" to "merging every feature."

ADR-0007 anticipated this seam: "An independent reviewer agent **may** add an approval, but
it is never *what makes the merge safe*." This ADR consciously promotes that reviewer from
*additive* to *load-bearing* for the loop's PRs — and records the tradeoff so "why did this
merge?" stays auditable.

## Decision

Add an **independent review-agent gate** for the loop's `sandcastle/auto-*` PRs
(`.github/workflows/auto-review.yml`, shipped in the template like `sandcastle.yml`). On
such a PR it:

1. **Gates mechanically first** (cheap, before spending a model): the PR author is the
   Beachfront App, and the diff touches **no governance path** (`docs/adr/**`, `CONTEXT.md`,
   `docs/brand.md`, `docs/agents/**`) **and no security-sensitive path** — authn/secrets
   (`src/auth/**`, `*secret*`, `*credential*`, `*oauth*`, `*.pem`/`*.key`), supply chain
   (`package.json`/lockfiles — a compromised dep passes tests fine), or privilege surfaces
   (`.github/**`, `.sandcastle/**`, `.env*`, `beachfront.config.*`). Any of these → leave
   for a human, no review.
2. **Reviews independently**: a *separate* Claude invocation — a different model from the
   author's, with a review-specific prompt and **read-only** tools — reads the linked
   issue's acceptance criteria and the diff, and judges correctness, security, scope, and
   whether the work actually satisfies the issue. It emits a single fail-closed verdict. The
   prompt carries a **security override**: any change with security relevance (authn/authz,
   secrets, crypto, input validation, permissions, supply chain, CI) is a `FAIL` regardless
   of correctness, and "unsure if it's security-relevant" is treated as security-relevant.
   This is the semantic backstop to the mechanical security denylist in step 1.
3. **Acts deterministically on the verdict**: only an explicit `PASS` enables
   **GitHub-native auto-merge** (`gh pr merge --auto`); anything else (including a parse
   failure or a missing linked issue) applies `needs-human` and comments the review. The
   agent never merges directly — the workflow does, gated on the parsed verdict.

Crucially, **the mechanical CI gates remain load-bearing**: enabling native auto-merge does
not merge anything until the required `typecheck`/`test`/`build`/`gate` checks are green
(branch protection, #43). The review agent can only *promote* a PR into the same checked,
status-gated merge path that a human approval would; it cannot bypass a red check.

Because branch protection is **strict** (a PR must be up to date with `main` to merge) and
GitHub auto-merge does not auto-update a behind branch, a companion workflow
(`auto-update.yml`) is a **required** part of this mechanism: on every push to `main` it
updates behind auto-merge PRs (using the App token, so CI re-fires) so the approved queue
actually drains instead of stalling `BEHIND`. See `docs/agents/autonomous-loop.md`.

This **amends ADR-0007** for `sandcastle/auto-*` PRs only. ADR-0007's Markdown-only
mechanical path (`automerge.yml`) is unchanged and still governs human and non-loop PRs.

## Safeguards (what keeps this from rubber-stamping)

- **Different model than the author**, separate invocation, review-only prompt — so it is
  not an author grading its own paper. (Configurable via `REVIEW_MODEL`.)
- **Mechanical CI still required** — the AI verdict adds a gate, it never removes one.
- **Governance paths excluded** — ADRs, CONTEXT, brand, agent contracts never auto-merge,
  regardless of verdict.
- **Security never auto-merges** — two layers: a mechanical denylist (auth/secrets/keys,
  supply chain, CI/harness/config paths) and a semantic security override in the review
  prompt (fail-closed when unsure). Correct-but-security-relevant work still goes to a human.
- **Fail-closed** — no clear `PASS`, no linked issue, or any error → human-gated.
- **Auditable** — the verdict and reasoning are posted to the PR, so "why did this merge?"
  answers with the review, not a silent bot action.

## Alternatives considered

- **Widen the mechanical allowlist to `src/`** (no reviewer). Rejected outright — this is
  precisely what ADR-0007 forbids: green checks cannot vet feature correctness.
- **Auto-apply `automerge-safe` to all App PRs.** Rejected — merges every feature PR with
  *zero* review; strictly worse than a reviewer gate.
- **Keep it fully human, review faster.** Viable and lowest-risk, but it does not remove the
  human from the common case, which is the stated goal.

## Consequences

- The loop can now run end-to-end on mechanically-safe, reviewer-approved feature work
  without a human in the common path — the pace win the Instance wanted.
- Safety now rests partly on AI judgement, a deliberate and recorded departure from
  ADR-0007. Worst case is a subtly-wrong-but-green PR the reviewer missed merging; bounded
  by: it is the Instance's own repo, the human still sees every merge in history, and
  governance/config/workflow paths stay hand-gated.
- This is **opt-in by file**: an onboarded repo that does not want it simply omits
  `auto-review.yml`; the ADR-0007 mechanical path still works without it.
- Revisit if the reviewer ever approves a regression that ships — tighten the prompt, swap
  the model, or fall back to human-gated `src/`.
