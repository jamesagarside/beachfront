# Issue authoring runs on one backend: the OAuth Worker, extended

## Status

proposed

The runtime/credential choice (A vs B) stays open pending the token spike below. The product
sub-decisions were **grilled and locked with the owner (2026-06-30)**: C ships first; the
session is per-Instance opt-in and **disabled on the public demo**; issues are written via a
single "create all" confirm (no copy-paste), the `to-issues` quiz-then-publish shape.

## Context

Beachfront should let a Viewer author work in one place: pick a Managed repo, think a
feature through with Claude (drilling deeper, grill-with-docs style), and turn that into
issues an agent then picks up. Creating issues is a Viewer-authored write like editing
issues or linking repos, so the question is not *whether* it is allowed but *where the
session runs* and *which credential it uses* — without sprawling the architecture.

Four facts shaped the decision:

- **Beachfront's only backend is the stateless OAuth Worker (#24, ADR-0001).** It holds
  the GitHub `client_secret`, does the `code → token` exchange, and persists nothing. A
  second backend is a cost — another thing to deploy, secure, and explain per Instance.
- **The Anthropic API has no CORS and needs a secret-holding shim** — exactly like
  GitHub's OAuth token endpoint (ADR-0001). A browser cannot call it directly with a
  hidden key, so an *interactive* Claude session needs a server shim of the same shape as
  the OAuth one.
- **The existing `CLAUDE_CODE_OAUTH_TOKEN` lives in Actions secrets, readable only inside
  GitHub Actions** — not by the browser and not by a Worker. So "reuse the token we
  already have" is only literal *inside Actions*.
- **The Viewer's GitHub token already writes directly, browser → GitHub** (issues,
  `workflow_dispatch`; ADR-0001 notes the CORS-supported trigger path). So authoring
  writes and handing work to an agent need *no* backend at all.

Three runtimes were considered. A latency spike (issue #61) measured option A: warm
per-turn ~2–3 s, session cold-start ~10–15 s, with the cost concentrated in keeping an
Actions job alive (6-hour ceiling, idle minutes) plus a relay.

- **A — terminal runs inside Actions.** Browser terminal as frontend; the Claude Code
  session runs in a Sandcastle/Actions job, reusing `CLAUDE_CODE_OAUTH_TOKEN` and the
  repo's own write access. *Proven* to work, but a separate substrate that does not fold
  into the one backend and needs keep-alive.
- **B — extend the one Worker.** Add a session route to the OAuth Worker; the Worker holds
  the Claude credential.
- **C — no terminal; assign to an agent.** Author the issue and assign it to GitHub's
  Copilot coding agent via the Viewer's PAT (#71). Lowest-infrastructure; the live
  conversation becomes optional.

## Decision

**Keep exactly one backend — the OAuth Worker (#24) — and rank the options by how well
they preserve that.**

1. **Agent handoff (C) ships first and adds no backend.** From a repo's issue, the Viewer
   assigns it to the Copilot coding agent (or the repo's Sandcastle) using their *own*
   token, reusing the Viewer-token write path (ADR-0001; consistent with #17/#15). This is
   the core loop — author a good issue → an agent does it → watch the PR — and it is the
   primary recommendation. Tracked as #71.

2. **The interactive terminal, if built, is option B: a stateless-per-turn route on the
   same Worker.** The browser holds the transcript; the Worker relays each turn to
   Anthropic and persists nothing, preserving #24's no-persistence property. It is
   **optional per Instance**, exactly like OAuth login (ADR-0001): no Worker → no terminal,
   but PAT mode and C still work. It ships **disabled on the public demo** — that Instance is
   a read-only example over baked, credential-less public data, so authoring into it is
   meaningless and a public Claude relay is abuse-prone. A stateful variant (Durable Objects)
   is allowed *only* if a per-turn model proves insufficient, at the cost of the
   no-persistence property.

3. **Actions-hosted (A) is the fallback, not the default.** It is retained because it is
   the proven way to reuse the subscription token and gives the full agent environment, but
   it is a second substrate that does not fold into the one backend, so it is not the
   primary path.

4. **The session feeds the existing model; it does not replace it.** When a conversation is
   present it is the *upstream feeder* of `ready-for-agent` work that the trigger/observe
   machinery already consumes (ADR-0004/0006, #19/#20). The session is scoped to one
   Managed repo and grounded in that repo's domain context (its `CONTEXT.md` / agents
   contract, ADR-0003), fetched with the Viewer's token.

5. **Issues are written via a single "create all" confirm, never copy-paste.** Claude
   proposes the issue(s) inline in the session; the Viewer glances and confirms — "create
   all", editing one first if they wish — and Beachfront writes them on the selected repo
   with the Viewer's own token. This is the `to-issues` quiz-then-publish shape (the Matt
   Pocock skill): no per-field forms and no copy-paste, but exactly one checkpoint so issues
   never land on the tracker unseen — consistent with the human-gate-on-real-actions pattern
   (ADR-0006/0007). Read-only tokens get the "open on GitHub" pivot (as #17).

**Open question — must resolve before B is built (follow-up spike):** can a Worker call the
Anthropic API with the subscription `CLAUDE_CODE_OAUTH_TOKEN`, or does B require a separate
`ANTHROPIC_API_KEY`? If that token only authenticates the Claude Code CLI (as in A), B
carries API-key spend and A's token-reuse edge grows; if it works against the raw API, B
reuses the same token inside the one Worker and the single-backend story is complete with no
new cost. This ADR stays `proposed` until that fact is settled; the spike cannot run from a
developer machine because the token lives in Actions secrets.

## Consequences

- One backend to deploy and secure (the Worker), one credential-model story. No backend
  sprawl, and Instances that run nothing but PAT mode still get C.
- C delivers the core author → agent → PR loop with zero new infrastructure and is
  independent of the terminal, so it can ship first and stand alone.
- The terminal stays optional and stateless; the cohesive home for it is a second route on
  the Worker, which is precisely the "merge them into one backend runner" intent.
- Stateless-per-turn means the browser resends the transcript each turn, so token cost grows
  with conversation length — acceptable for short authoring sessions, and the reason a
  stateful variant is held in reserve rather than adopted now.
- The subscription-token question is a genuine fork; recording it keeps the decision honest.
  Until it is settled B's cost is uncertain and A remains the guaranteed token-reuse path.
- Reuses the Viewer-token write path (#17/#15) and the existing trigger/observe model
  (#19/#20, ADR-0004/0006); issue authoring is just the upstream feeder, not a new
  orchestration surface.
