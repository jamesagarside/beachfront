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

## Quick start

You need the [`gh`](https://cli.github.com) CLI (logged in, admin on the repos you'll
onboard), **Node.js**, **`jq`**, and a **Claude** token (`claude setup-token`).

```sh
# 1. Stand up your own Instance: on this repo, "Use this template" → create a PRIVATE repo.
#    Clone it and run the rest from inside it.

# 2. Create the Beachfront GitHub App once (Settings → Developer settings → GitHub Apps):
#    Contents + Pull requests + Issues = Read/write, no webhook. Note the App ID, download
#    the private key, and Install the App on each repo you'll onboard.

# 3. Drop your credentials in .sandcastle/.env (gitignored):
cp .sandcastle/.env.example .sandcastle/.env      # then fill in the token, App ID, and key path

# 4. Onboard a repo, then link it into your Estate:
scripts/beachfront-onboard.sh owner/repo          # guided: configures the repo + opens its onboarding PR
npm run beachfront -- link owner/repo             # adds it to your Instance's Registry so it appears
```

Merge the two PRs (onboarding + link) and the repo starts draining `ready-for-agent`
issues. **[→ docs/getting-started.md](docs/getting-started.md)** explains every step, the
onboarding choices, and troubleshooting.

### Keeping an onboarded repo current

The onboarder installs a snapshot of the loop's workflows into each repo. When Beachfront
improves that harness, pull the changes into an already-onboarded repo with:

```sh
scripts/beachfront-update.sh owner/repo           # opens a PR that re-applies the current harness
```

It only refreshes files the repo already has, stamps the installed version, and leaves the
diff for you to review before merging.

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
