# Harness changelog

Notable changes to the **harness** — the workflows and run config that onboarding copies
into a Managed repo (`sandcastle.yml`, the optional `automerge.yml` / `auto-review.yml` /
`auto-update.yml`, and `.sandcastle/`). This is the surface that tells you a repo's harness
has moved on and what changed, so you can decide whether to adopt it.

The onboarder and `scripts/beachfront-update.sh` stamp the installed vintage into
`.sandcastle/.beachfront-version` as the Tool repo's short git SHA. Entries here are keyed
to that same SHA: read the first line of a repo's `.sandcastle/.beachfront-version`, then
scan for its key below to see what a newer harness would bring. Run
`scripts/beachfront-update.sh owner/repo` to pull the current harness into an update PR.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Newest first.

---

## `7303042` — 2026-07-02

The first tracked harness vintage. Everything below is what a repo onboarded (or updated)
at this version runs.

### Added

- **Version stamp** — onboarding and updates write the harness vintage (this SHA) to
  `.sandcastle/.beachfront-version`, so a repo records which harness it is running.
- **`scripts/beachfront-update.sh`** — re-applies the current harness to an already-onboarded
  repo. Refreshes only the files the repo already has, flags locally customised files, and
  opens a PR for review; it never enables a feature the repo wasn't onboarded with.

### Harness at this vintage

- **Sandcastle loop** (`sandcastle.yml`) — runs on merge to the default branch, when an
  issue becomes `ready-for-agent`, and on a schedule backstop. Each run works one issue and
  opens a PR, using the Beachfront GitHub App so the PR triggers CI.
- **Gated auto-merge** (`automerge.yml`, optional) — merges docs-only / mechanical loop PRs
  once required checks pass; anything outside the mechanical allowlist stays for a human.
- **Independent AI review gate** (`auto-review.yml`, optional) — reviews each feature PR and
  either enables auto-merge or routes it to a human with `needs-human`; always blocks
  security-, governance-, and config-touching changes, and fail-closes when the review can't
  run.
- **Branch auto-update** (`auto-update.yml`, optional) — keeps approved PRs current so the
  auto-merge queue keeps draining.
- **Run config** (`.sandcastle/`) — the loop prompt and entrypoint the workflows run.

---

## Releasing harness changes

For maintainers changing the onboarded workflows or run config:

1. **Make the change** on the Tool repo and merge it, so the harness files
   (`sandcastle.yml`, the optional workflows, `.sandcastle/`) reflect what you want repos to
   run.
2. **Find the new key** — `git rev-parse --short HEAD` on the Tool repo. This is the SHA
   `scripts/beachfront-update.sh` will stamp into `.sandcastle/.beachfront-version`.
3. **Add a changelog entry** at the top of this file keyed to that SHA, dated, describing the
   change under the usual headings (Added / Changed / Fixed / Removed). Describe it from the
   Instance owner's point of view — what a repo gains or must reconcile after updating.
4. **(Optional) Cut a GitHub Release** on the Tool repo tagged at the same commit, with notes
   matching the entry, so the change stream is watchable and subscribable.

Then Instance owners run `scripts/beachfront-update.sh owner/repo` to adopt it. Keep entries
keyed to the SHA the stamp records so a repo's `.sandcastle/.beachfront-version` maps
directly to an entry here.
