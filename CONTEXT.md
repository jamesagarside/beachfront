# Beachfront

A single place where an AI developer sees the status of **all** their projects and
their agents at once. As the number of agent-managed repos grows, the hardest part
is managing the backlog across them — keeping agents fed and surfacing the issues
that need triage or human attention so no agent sits idle. Beachfront's job is to
make that one view: every Sandcastle-enabled repo's issues, attention queue, and
running agents, gathered in one pane.

It is **read-mostly**: reads dominate, but a small set of Viewer-authored writes
are supported — editing issues, linking repos, and triggering agent runs — each
performed as the Viewer's own token (or by pivoting out to GitHub). It does **not**
orchestrate agents; orchestration lives in each repo's Sandcastle.

**Primary surface.** Beachfront is delivered first as the **Beachfront plugin** — a
Claude plugin (MCP server) whose tools (text-driven, in any MCP host) and MCP App UI
(interactive, in Claude Desktop) let an AI developer see and act on the estate from
inside their Claude session. A **web companion** (static SPA) renders the same read-only
view from anywhere. The interactive layer runs against the developer's local Claude
(model auth) and `gh` (GitHub access); Beachfront stores no credentials. See
[ADR-0010](docs/adr/0010-mcp-plugin-first.md).

## Language

**Beachfront**:
The tool itself — the read-mostly pane of glass over Sandcastle-enabled repos.
_Avoid_: dashboard, control centre, orchestrator

**Beachfront plugin**:
The primary delivery of Beachfront — a Claude plugin (MCP server) exposing the estate,
Triage, issue authoring, and Agent status as **tools** (text-driven, any MCP host) and
**MCP App UI** (interactive panels, in Claude Desktop). Runs against the developer's local
Claude and `gh`; stores no credentials. The web companion is the secondary surface.
_Avoid_: the app, the extension, the bot

**Estate**:
All of a Viewer's Sandcastle-enabled (Managed) repos seen together — the whole shore.
What the Shoreline view aggregates.
_Avoid_: fleet, portfolio

**Sandcastle**:
`@ai-hero/sandcastle` — the library + CLI that runs a coding agent in a sandbox
and turns its work into commits. Runs inside each managed repo. Beachfront never
re-implements it.
_Avoid_: the agent, the runner

**Tool repo**:
The public `jamesagarside/beachfront` repository — the shared, reusable Beachfront
codebase that others stand up their own Instance from. Holds only public/example data.
_Avoid_: upstream, the template

**Instance**:
One owner's deployment of Beachfront, created from the Tool repo. The only place
an owner's config and secrets live. May be public (demo) or private (dogfooding).
_Avoid_: deployment, fork, site

**Viewer**:
The person looking at an Instance. Their GitHub identity (via their own token)
decides which repos' state they can see — GitHub repo access is the gate.
_Avoid_: user, visitor

**Managed repo**:
A repo that has been made Sandcastle-enabled and given the Beachfront trust
relationship, so its state can be aggregated and (later) its runs triggered.
_Avoid_: target repo, child repo

**Registry**:
A directory of one file per peered repo in an Instance, the source of truth for
what that Instance aggregates. One file per repo keeps onboarding PRs
conflict-free and makes the tracked set easy to read. Maintained only by tooling
(Linking), never hand-edited.
_Avoid_: discovery, list, index

**Link** (verb: to link / peer):
To associate a Managed repo with an Instance by adding its Registry file. Three
producers, all converging on a PR to the Instance: from Beachfront's UI (the SPA
using the Viewer's token), from a Beachfront command, or from a repo's Sandcastle
onboarding (via `gh`). Enables peering org repos not under the owner's own name.
_Avoid_: connect, register, subscribe

**Aggregation**:
Reading the state (issues, Agent runs, etc.) of every Registry repo the Viewer's
token can access, into the single view the pane of glass renders.
_Avoid_: sync, collection

**Skill**:
A named, invokable capability from Matt Pocock's engineering skill set (e.g.
`triage`, `diagnose`, `to-issues`, and others — the set is open-ended). Beachfront
can trigger any advertised Skill against a repo or issue; it does not hardcode a
fixed list.
_Avoid_: command, action, task

**Triage role**:
A canonical issue state from the `triage` skill's state machine — categories
`bug` / `enhancement`, and states `needs-triage`, `needs-info`, `ready-for-agent`,
`ready-for-human`, `wontfix`. Beachfront classifies every issue by role. Roles are
canonical; the actual label strings per repo come from the Mapping.
_Avoid_: status, label, state (when you mean the canonical role)

**Mapping** (role → label):
The per-repo translation from canonical Triage roles to that repo's actual label
strings, written by `setup-matt-pocock-skills` to `docs/agents/triage-labels.md`.
Beachfront reads it so it never imposes its own labels.
_Avoid_: label config

**Agents contract**:
The `docs/agents/` files a repo's Matt-Pocock-skills setup produces
(`issue-tracker.md`, `triage-labels.md`, `domain.md`) — the read interface
Beachfront relies on to interpret a Managed repo. Beachfront consumes this
contract; it does not define it.
_Avoid_: integration config, manifest

**Agent run**:
A single execution of Sandcastle in a Managed repo, observed by Beachfront as a
GitHub Actions workflow run with a status (queued / running / succeeded / failed)
and a resulting branch, PR, or comment. The "agents" a Viewer watches per repo.
_Avoid_: sandbox agent, job, build

**Attention queue**:
The cross-repo, role-driven surfacing of issues that need a human: untriaged
(unlabeled), `needs-triage`, and `needs-info` with reporter activity — the same
buckets the `triage` skill shows, but spanning every Managed repo. Its companion
is the cross-repo `ready-for-agent` pool that keeps agents fed. The primary value
Beachfront delivers.
_Avoid_: backlog, inbox, todo

**Trust relationship**:
Reduced to two facts: a repo is in the Registry, and every read/trigger happens
as the Viewer's own token. No long-lived cross-repo credential is stored for
private aggregation. (The only stored credential is the demo-baking PAT in the
public Instance's Actions secrets, for public repos.)
_Avoid_: connection, peering-key
