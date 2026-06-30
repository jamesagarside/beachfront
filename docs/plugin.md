# The Beachfront plugin (MCP server)

Beachfront's primary surface is a **Claude plugin** — an MCP server you run locally
(ADR-0010). It needs **no credentials**: model access comes from your local Claude
subscription, GitHub access from your local [`gh`](https://cli.github.com). This is
the walking skeleton — one tool, text-driven, works in any MCP host including the
terminal. The UI resources (Shoreline estate, per-repo Kanban) build on top later.

## What it does

The server registers these tools:

| Tool | What it does |
| --- | --- |
| `beachfront_estate` | Aggregates the estate across every linked repo — open issues by triage role and running-agent counts — as a calm single pane of glass. |
| `beachfront_repo_deck` | Zooms to one repo's mission deck — its open issues as a Kanban board by triage role, with a pinned Agent-run/metrics strip. |
| `beachfront_create_issues` | Authors issues for a chosen repo. The conversation drafts a `to-issues`-shape breakdown; called without `confirm` the tool previews and writes nothing, called with `confirm` it creates them all via `gh issue create` — exactly one checkpoint, no copy-paste. |
| `beachfront_set_triage_role` | Moves an issue to a canonical triage state role by writing the repo's mapped label (ADR-0003, #6) via `gh issue edit` — the same state-column reconcile the web view does. |

It reads the **Registry** (`repos/<owner>/<repo>.json`, ADR-0002) from the working
directory to know which repos to aggregate, then reads each repo through `gh`:

- open issues — `gh issue list`
- triage Mapping — `gh api …/contents/docs/agents/triage-labels.md` (ADR-0003)
- Agent runs — `gh run list`

A repo it can't read is **skipped** (not a failure); a repo with no triage contract
degrades to "untriaged" rather than guessing. Both behaviours come straight from the
shared core (#85), so the plugin and the web SPA can't drift.

## Running it

Prerequisites: Node, and `gh` logged in (`gh auth login`).

```sh
# Directly, over stdio:
npm run mcp

# Or register it with any MCP host via the bundled config:
#   .mcp.json            — project-level MCP server config
#   .claude-plugin/plugin.json — Claude plugin manifest
```

In Claude Code / Desktop the bundled manifest runs `npx -y tsx scripts/beachfront-mcp.mts`.
Once connected, call the tool or just ask — e.g. *"show me the estate."*

## Layout

- `src/mcp/ghDataSource.ts` — the `EstateDataSource` backed by local `gh` (the
  sibling to the web surface's `webDataSource`); shelling out is injected so it's
  unit-tested without a real `gh`.
- `src/mcp/estateView.ts` — the serialisable estate view-model + calm text
  rendering, built purely from the shared core's view builders.
- `src/mcp/estateTool.ts` — the SDK-free tool handler (structured + text content).
- `src/mcp/authorIssues.ts` — the SDK-free draft → confirm → create handler (#89).
- `src/mcp/triageRole.ts` — the SDK-free state-role reconcile via `gh` (#89).
- `scripts/beachfront-mcp.mts` — the entry that wires real `fs`/`gh`/stdio and the
  MCP SDK around those handlers.
