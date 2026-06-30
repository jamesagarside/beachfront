# The Beachfront plugin (MCP server)

Beachfront's primary surface is a **Claude plugin** — an MCP server you run locally
(ADR-0010). It needs **no credentials**: model access comes from your local Claude
subscription, GitHub access from your local [`gh`](https://cli.github.com). It is
text-driven first — every tool works in any MCP host including the terminal — and
progressively enhanced with **MCP App UI resources** (the Shoreline estate and the
per-repo Kanban) that rich hosts like Claude Desktop render inline.

## What it does

The server registers two tools, each carrying its UI resource and a text fallback:

| Tool | What it returns |
| --- | --- |
| `beachfront_estate` | Aggregates the estate across every linked repo — open issues by triage role and running-agent counts — as a calm single pane of glass. Rich hosts get the **Shoreline App** (`ui://beachfront/estate`): the tide-line summary, the cross-repo Attention queue, and the repo shore grid; selecting a repo opens its deck. |
| `beachfront_repo_deck` | Zooms to one repo's mission deck — its open issues as a **Kanban App** by triage role with a pinned run/metrics strip — with a calm text fallback. |

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
- `src/mcp/estateHtml.ts` — the Shoreline MCP App renderer: a pure function from
  the estate view-model to a self-contained `text/html` document (#87).
- `src/mcp/estateTool.ts` — the SDK-free tool handler (Shoreline resource + text).
- `src/mcp/repoDeckTool.ts` / `deckHtml.ts` — the per-repo deck tool and its
  Kanban App renderer (#88).
- `scripts/beachfront-mcp.mts` — the entry that wires real `fs`/`gh`/stdio and the
  MCP SDK around that handler.
