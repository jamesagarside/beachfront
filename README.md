# Beachfront

A single place to see **all** your AI-agent projects at once — every
[Sandcastle](https://github.com/mattpocock/sandcastle)-enabled repo's issues, attention
queue, and running agents, gathered in one pane. As your agent-managed repos grow, the
hard part is keeping the agents fed and surfacing what needs a human; Beachfront makes
that one view.

It is **read-mostly** and does **not** orchestrate agents — orchestration lives in each
repo's Sandcastle. Beachfront aggregates the Estate and supports a few Viewer-authored
writes (editing issues, linking repos, triggering runs), each as your own token.

## Two surfaces

- **The Beachfront plugin** (primary) — a Claude plugin / MCP server whose tools work in
  any MCP host (terminal included) and whose MCP App UI renders inline in Claude Desktop.
  Runs against your local Claude and `gh`; stores no credentials. See [`docs/plugin.md`](docs/plugin.md).
- **The web companion** — a static read-only SPA that renders the same Estate from anywhere.

## How the autonomous loop works

Onboarding a repo installs a headless **Sandcastle loop** (a GitHub Actions workflow) that
drains its `ready-for-agent` issues and opens a PR per run. An optional **independent AI
review gate** lets clean feature PRs auto-merge while always routing security-, governance-,
and config-touching changes to a human, and a **branch auto-update** keeps the queue
flowing. The mechanical CI checks always gate the actual merge.

| Piece | Decision |
| --- | --- |
| Headless loop per Managed repo | [ADR-0006](docs/adr/0006-onboarding-installs-autonomous-headless-workflow.md) |
| Gated mechanical auto-merge | [ADR-0007](docs/adr/0007-gated-auto-merge-by-mechanical-allowlist.md) |
| Independent AI review gate + security block | [ADR-0012](docs/adr/0012-independent-review-agent-gates-loop-prs.md) |

## Get started

**[→ docs/getting-started.md](docs/getting-started.md)** walks you from nothing to your
first onboarded, iterating repo: stand up your Instance, set up the GitHub App once, then:

```sh
scripts/beachfront-onboard.sh owner/repo    # guided: configure the repo + open its onboarding PR
npm run beachfront -- link owner/repo       # add it to your Instance's Registry so it appears
```

## Develop

```sh
npm install
npm run dev         # web companion (Vite)
npm run mcp         # the Beachfront plugin over stdio
npm test            # vitest
npm run typecheck
```

## Docs

- [`CONTEXT.md`](CONTEXT.md) — glossary and design overview (start here for the vocabulary)
- [`docs/getting-started.md`](docs/getting-started.md) — onboard your first repo
- [`docs/plugin.md`](docs/plugin.md) — the Beachfront plugin (MCP server)
- [`docs/agents/`](docs/agents/) — the contract Beachfront reads from a Managed repo, and the loop's required workflows
- [`docs/registry-schema.md`](docs/registry-schema.md) · [`docs/oauth-worker.md`](docs/oauth-worker.md) · [`docs/brand.md`](docs/brand.md)
- [`docs/adr/`](docs/adr/) — the decisions behind each piece

> Status: actively dogfooded. Beachfront builds itself via its own Sandcastle loop.
