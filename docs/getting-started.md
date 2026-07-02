# Getting started: onboard your first repo

This walks you from nothing to a **Managed repo** — one running an autonomous
[Sandcastle](https://github.com/mattpocock/sandcastle) loop that drains its
`ready-for-agent` issues and opens a PR per run — visible in your Beachfront.

If a term is unfamiliar (Instance, Managed repo, Registry, Estate), see the glossary
in [`CONTEXT.md`](../CONTEXT.md).

> **The short version.** Stand up your Instance → set up the Beachfront GitHub App once
> → put your credentials in `.sandcastle/.env` → run `scripts/beachfront-onboard.sh
> owner/repo` → install the App on that repo → `beachfront link owner/repo`. Each step
> is explained below.

---

## 0. Prerequisites

- The [`gh`](https://cli.github.com) CLI, logged in (`gh auth login`), with **admin** on
  the repos you'll onboard.
- **Node.js** (the onboarder uses `npx`) and **`jq`**.
- A **Claude** subscription. Mint a token with `claude setup-token`.

---

## 1. Your Instance

Beachfront ships as a **Tool repo** (`jamesagarside/beachfront`) you stand your own
**Instance** up from — your private copy, where all your config and secrets live.

1. On the Tool repo, click **Use this template → Create a new repository**. Make it
   **private** (your Instance holds your Registry and is where you run onboarding).
2. Clone your Instance locally. You'll run the steps below from inside it.

*Already have an Instance? Skip to step 2.*

---

## 2. The Beachfront GitHub App (one-time)

The autonomous loop opens its PRs with a **GitHub App** rather than the built-in
`GITHUB_TOKEN`, because a `GITHUB_TOKEN`-opened PR does **not** trigger CI (GitHub's
anti-recursion rule) — and the auto-merge / auto-update workflows depend on CI running.
You create this App **once** and install it on each repo you onboard.

1. Go to **GitHub → Settings → Developer settings → GitHub Apps → New GitHub App**.
2. Name it (e.g. `beachfront-agent`). Homepage URL can be your Instance.
3. **Uncheck "Active" under Webhook** — no webhook is needed.
4. **Repository permissions:**
   - **Contents** — Read and write *(commit + update PR branches)*
   - **Pull requests** — Read and write *(open the loop's PRs)*
   - **Issues** — Read and write *(recommended)*
5. Create the App, then **Generate a private key** — download the `.pem`.
6. Note the **App ID** (top of the App's settings page).

You'll **install** the App on each target repo in step 4.

---

## 3. Your credentials (`.sandcastle/.env`)

The onboarder reads credentials from your environment or from `.sandcastle/.env` in your
Instance (gitignored — it never gets committed). Copy the example and fill it in:

```sh
cp .sandcastle/.env.example .sandcastle/.env
```

```sh
CLAUDE_CODE_OAUTH_TOKEN=...                       # from `claude setup-token`
BEACHFRONT_APP_ID=...                             # the App ID from step 2
BEACHFRONT_APP_PRIVATE_KEY_FILE=./beachfront-agent.private-key.pem   # the .pem from step 2
```

(You can also pass these as environment variables instead of the file.)

---

## 4. Onboard a repo

**First, install the App on the target repo:** open your App's page →
**Install App** → choose the account → select the repo. (Secrets alone aren't enough —
the App must be *installed* to act on the repo.)

Then run the **guided onboarder** from your Instance:

```sh
scripts/beachfront-onboard.sh owner/repo
```

It interviews you, shows a plan, and only touches the repo after you confirm. The choices:

| Choice | What it does | Pick "no" if… |
| --- | --- | --- |
| **Markdown auto-merge** | Docs-only loop PRs merge on green | you want to review every PR |
| **AI review gate** | An independent agent reviews each feature PR and either enables auto-merge or routes it to a human; **always blocks security-relevant changes** | you want all feature PRs human-gated |
| **Branch auto-update** | Keeps approved PRs current so the auto-merge queue drains | you aren't auto-merging |
| **Required checks** | The CI check names auto-merge waits for (e.g. `build,test`) | the repo has no CI yet |

Each prompt has an env override (`BEACHFRONT_AUTO_REVIEW=false`, etc.) and `--yes` runs
it unattended. See the header of `scripts/beachfront-onboard.sh` for the full list.

The onboarder sets the labels, secrets, repo settings, and branch protection, then opens
an **onboarding PR** that adds `.sandcastle/` and the workflows you chose. **Review and
merge that PR** to go live.

> **Required checks & auto-review.** Auto-merge only ever merges once *required* checks
> pass. If you enable the AI review gate, give the repo's CI check names so a passing
> review can't merge code CI never ran. No CI yet? Onboard PRs-only and add gating later.

---

## 5. Link it into your Beachfront

Onboarding makes the repo *run* Sandcastle; **linking** makes it *appear* in your Estate
by adding its file to your Instance's **Registry** (see the
[registry schema](registry-schema.md)):

```sh
npm run beachfront -- link owner/repo    # opens a PR to your Instance's Registry
# (or `beachfront link owner/repo` if you've put the CLI on your PATH)
```

Merge that PR. The repo now shows up wherever you view the Estate — the
[Beachfront plugin](plugin.md) (`npm run mcp`, or in Claude Desktop) or the web companion.

---

## 6. What happens next

- The loop runs on a **merge to `main`**, when an issue becomes **`ready-for-agent`**, and
  on a schedule backstop. Each run works **one** issue and opens a PR.
- With the **AI review gate** on: clean feature PRs auto-merge; security-, governance-, or
  config-touching PRs get the **`needs-human`** label for you to decide.
- **Feed the loop** by labelling well-specified issues `ready-for-agent`. Issues needing a
  person surface in the **Attention queue**.
- The loop is **merge-paced** — a merge triggers the next run. If everything in flight is
  `needs-human` (nothing merges), kick it with `gh workflow run sandcastle.yml`.

See [`docs/agents/autonomous-loop.md`](agents/autonomous-loop.md) for the required
workflow set and how they fit together.

---

## 7. Keeping the repo's harness current

Onboarding copies a **snapshot** of the loop's workflows (`sandcastle.yml`, and whichever
of `automerge.yml` / `auto-review.yml` / `auto-update.yml` you chose) plus the run config
into the target repo. That snapshot doesn't self-update — so when Beachfront improves the
harness, pull the changes in explicitly:

```sh
scripts/beachfront-update.sh owner/repo
```

It refreshes **only the harness files the repo already has** (it never turns on a feature
you didn't onboard with), records the installed version in `.sandcastle/.beachfront-version`,
and opens a PR with the diff for you to review before merging. If the repo is already on the
current harness it says so and changes nothing. Run it after pulling a new version of your
Instance; check `.sandcastle/.beachfront-version` to see what a repo is running.

To see *what* changed between vintages — and whether a repo is behind — read the
[harness changelog](harness-changelog.md). Its entries are keyed to the same SHA the stamp
records, so a repo's `.sandcastle/.beachfront-version` maps straight to an entry.

> Updating your **Instance** (the app, plugin, and onboarder itself) is a separate flow —
> your Instance consumes Tool-repo updates as a sync PR. See [`CONTEXT.md`](../CONTEXT.md)
> and the ADRs for the distribution model.

---

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| Loop PRs have **no CI** | The App isn't installed on the repo (step 4), or its secrets are missing. A `GITHUB_TOKEN`-opened PR can't trigger CI. |
| An approved PR sits **`BEHIND`** and won't merge | Branch protection wants it up to date; `auto-update.yml` refreshes it (needs the App). Enable branch auto-update. |
| A PR is **`DIRTY`** (conflicts) | Close it and re-label its issue `ready-for-agent` so the loop regenerates against current `main` — don't hand-resolve. |
| Reviews all land in **`needs-human`** | The Claude session limit is exhausted (the reviewer shares your subscription) — it fail-closes safely until reset. |
| Branch protection **didn't apply** | You need admin on the repo; set it in **Settings → Branches**. |

---

## Reference

- [`CONTEXT.md`](../CONTEXT.md) — glossary and design overview
- [`docs/adr/`](adr/) — the decisions behind each piece
- [`docs/plugin.md`](plugin.md) — the Beachfront plugin (MCP server)
- [`docs/registry-schema.md`](registry-schema.md) — the Registry file format
- [`scripts/beachfront-onboard.sh`](../scripts/beachfront-onboard.sh) — the guided onboarder (its header lists every flag)
- [`scripts/beachfront-update.sh`](../scripts/beachfront-update.sh) — re-apply the current harness to an already-onboarded repo
- [`docs/harness-changelog.md`](harness-changelog.md) — what changed in the onboarded workflows / run config, keyed to the stamped version
