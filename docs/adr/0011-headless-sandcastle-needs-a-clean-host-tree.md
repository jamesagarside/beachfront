# Headless Sandcastle in CI requires a pristine host working tree

## Status

accepted

## Context

Sandcastle is built to run **locally** (`npm run sandcastle` on a laptop). Beachfront's
reason to exist (ADR-0006) is to run it **headless as a GitHub Workflow agent** in every
Managed repo. That non-standard CI execution model is where this failure lived — not in
Sandcastle itself.

The loop uses the `merge-to-head` branch strategy: the agent works on a temporary worker
branch inside the Docker sandbox, and when the run completes Sandcastle merges that branch
back onto the checked-out branch with a **host-side `git merge`**. `git merge` aborts if
any tracked file in the host working tree is dirty (`Your local changes to the following
files would be overwritten by merge`). So `merge-to-head` carries an unstated precondition:
**the host working tree must be clean when the loop finishes.**

The workflow violated that precondition. Its `npm install --no-audit` step (run on the
host to provide `tsx` + the Sandcastle CLI that *launch* the loop) rewrites
`package-lock.json` whenever the committed lockfile has drifted from `package.json`. Such a
drift was introduced when the Beachfront CLI added a `bin` field to `package.json` (#16)
without regenerating the lockfile. Crucially, `npm ci` does **not** reject a stale root
`bin`, so the `typecheck`/`test`/`build` gates (which use `npm ci`) stayed green while the
lockfile silently diverged. Every headless run then:

1. `npm install` re-added `bin` to `package-lock.json` → host tree dirty;
2. the agent ran and committed in its sandbox worker branch;
3. the final `git merge <worker-branch>` aborted on the dirty lockfile → `SyncError`,
   exit 1.

This explains the observed symptoms exactly: it failed **only in CI**, **only at the merge
step**, and **identically regardless of which issues were in the `ready-for-agent` pool**,
because the conflict was on `package-lock.json` (driven by `npm install`), not on any
issue's content. It began after ~17 successful runs because that is when the lockfile
drifted — the branch strategy itself was never the regression. ADR-0006 foresaw exactly
this: "may require a CI-specific branch strategy so work is pushed as a PR rather than lost
in the runner."

The decisive evidence was not in the Actions summary — Sandcastle tails the real worker log
to `.sandcastle/logs/**` inside the runner, which was never uploaded.

## Decision

Keep the proven `merge-to-head` strategy and **enforce its precondition in Beachfront's
harness**, rather than swap to an unproven strategy. Three changes, all in the files this
repo distributes as the onboarding template (ADR-0005), so every Managed repo inherits them
via template-sync:

1. **The workflow guarantees a pristine host tree before the loop.** Immediately after the
   host `npm install`, `git checkout -- .` discards any tracked-file churn it produced.
   The host install only needs to *launch* Sandcastle; the agent does its own install
   inside the sandbox, so discarding host churn is safe. Untracked/ignored files
   (`node_modules`, `.sandcastle/.env`) are untouched. This makes the harness robust to
   lockfile drift in **any** onboarded repo, not just this one.

2. **The lockfile is kept in sync**, and a `tests/lockfile-consistency.test.ts` regression
   guard fails at PR time if `package-lock.json`'s root package stops mirroring
   `package.json` (`bin`/`dependencies`/`devDependencies`) — catching the class of drift
   that `npm ci` waves through.

3. **Worker logs are surfaced on failure.** The workflow prints `.sandcastle/logs/**`
   inline and uploads them as an artifact when the loop fails, so a broken run is
   diagnosable without reproducing it locally.

`.sandcastle/main.mts` is updated to document the clean-host-tree invariant and to drop a
stale, misleading `copyToWorktree` bootstrap note.

## Alternatives considered

- **Switch to the `head` branch strategy** (Sandcastle's own default for a bind-mounted
  Docker sandbox), which commits directly onto the runner's checkout and has no host-side
  merge at all. Tempting and arguably cleaner, but rejected here: the regression was
  lockfile drift, not the strategy, and `merge-to-head` ran successfully for 17 prior runs.
  Flipping the runtime branch strategy blind — without an end-to-end CI verification —
  trades a proven, now-understood configuration for an unproven one. Revisit if a future
  need (e.g. parallel worker isolation) makes `head` worth validating.
- **Use `npm ci` on the host** (like the CI gate does), which never rewrites the lockfile.
  Rejected because `npm ci` *fails* on a genuinely out-of-sync lockfile, which defeats the
  template's "works in any onboarded repo" goal (ADR-0005); `npm install` + `git checkout`
  keeps that resilience while still yielding a clean tree.

## Consequences

- The headless loop is robust to lockfile drift in any Managed repo, so onboarded repos
  inherit the fix without per-repo intervention.
- A failed run is now self-describing (inline log + artifact), shrinking the next
  diagnosis from "reproduce the whole loop" to "read the log step".
- `git checkout -- .` is deliberately blunt: it discards *all* host tracked-file churn
  before the loop. That is correct for this harness (the host checkout is a throwaway
  launch environment), but any future need to carry host-side tracked changes into the
  loop would have to revisit it.
- This unblocks the parked web-shell cluster (#62–#66), which was serialised onto one file
  as a workaround for this same merge failure; with the merge fixed, that cluster can
  re-enable per the plan on #63.
