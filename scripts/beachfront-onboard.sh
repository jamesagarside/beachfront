#!/usr/bin/env bash
#
# beachfront-onboard.sh — make a target GitHub repo a Beachfront-Managed repo.
#
# Installs the autonomous, headless Sandcastle setup (docs/adr/0006) into the target
# repo via a pull request, and configures everything that workflow needs to run:
#
#   1. Canonical triage labels (Matt Pocock vocabulary)
#   2. The CLAUDE_CODE_OAUTH_TOKEN repo secret
#   3. The repo settings the headless loop depends on:
#        - Actions may create pull requests
#        - Actions default workflow permissions = write
#   4. A PR that runs the OFFICIAL `sandcastle init` (@latest) for the base config
#      (so Sandcastle's Dockerfile/run harness stay current), then overlays only the
#      Beachfront-specific bits (tuned prompt, CI run config, headless workflow) plus
#      the package.json launcher wiring.
#
# Linking the repo into a Beachfront Instance's Registry is a separate step (see #23).
#
# Usage:
#   scripts/beachfront-onboard.sh <owner/repo>
#
# Auth:  uses your existing `gh` login; you need admin on <owner/repo> to set the
#        secret and Actions permissions (documented assumption — see ADR-0002).
# Token: read from $CLAUDE_CODE_OAUTH_TOKEN, else from ./.sandcastle/.env, else you
#        are prompted. Mint one with `claude setup-token`.

set -euo pipefail

REPO="${1:?Usage: scripts/beachfront-onboard.sh <owner/repo>}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

command -v gh >/dev/null || { echo "✗ gh CLI is required"; exit 1; }
gh repo view "$REPO" >/dev/null 2>&1 || { echo "✗ Cannot access $REPO with your gh login"; exit 1; }
echo "▸ Onboarding $REPO as a Beachfront-Managed repo"

# 1. Canonical triage labels (idempotent) ------------------------------------
echo "▸ Ensuring canonical triage labels"
declare -A LABELS=(
  [needs-triage]="FF8C61|Maintainer needs to evaluate"
  [needs-info]="A9D6E5|Waiting on reporter for more information"
  [ready-for-agent]="1B998B|Fully specified, ready for an AFK agent"
  [ready-for-human]="FFB84D|Needs human implementation"
  [wontfix]="8A8580|Will not be actioned"
  [bug]="D73A4A|Something is broken"
  [enhancement]="0B4F6C|New feature or improvement"
)
for name in "${!LABELS[@]}"; do
  IFS='|' read -r color desc <<<"${LABELS[$name]}"
  gh label create "$name" -R "$REPO" --color "$color" --description "$desc" --force >/dev/null
done

# 2. Claude secret -----------------------------------------------------------
echo "▸ Setting the CLAUDE_CODE_OAUTH_TOKEN repo secret"
TOKEN="${CLAUDE_CODE_OAUTH_TOKEN:-}"
if [ -z "$TOKEN" ] && [ -f "$SRC_ROOT/.sandcastle/.env" ]; then
  TOKEN="$(grep -E '^CLAUDE_CODE_OAUTH_TOKEN=' "$SRC_ROOT/.sandcastle/.env" | head -1 | cut -d= -f2-)"
fi
if [ -z "$TOKEN" ]; then
  printf '  Paste a Claude OAuth token (from `claude setup-token`): '
  read -rs TOKEN; echo
fi
[ -n "$TOKEN" ] || { echo "✗ No token provided"; exit 1; }
# Piped via stdin so the value never appears in process args.
printf '%s' "$TOKEN" | gh secret set CLAUDE_CODE_OAUTH_TOKEN --repo "$REPO"

# 3. Repo settings the headless loop needs -----------------------------------
echo "▸ Allowing GitHub Actions to create PRs (and granting write workflow perms)"
gh api -X PUT "repos/$REPO/actions/permissions/workflow" \
  -F default_workflow_permissions=write \
  -F can_approve_pull_request_reviews=true >/dev/null

# 4. Install latest official Sandcastle + Beachfront overlay via a PR ---------
echo "▸ Scaffolding the latest official Sandcastle + Beachfront overlay"
command -v npx >/dev/null || { echo "✗ npx (Node.js) is required"; exit 1; }
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
gh repo clone "$REPO" "$TMP/repo" -- --depth 1 >/dev/null 2>&1
DEFAULT_BRANCH="$(gh repo view "$REPO" --json defaultBranchRef --jq .defaultBranchRef.name)"
cd "$TMP/repo"
git switch -c beachfront/onboard >/dev/null 2>&1

# Base config straight from the official package (@latest), so the Sandcastle
# mechanics — Dockerfile, run harness, .env.example — are always current rather
# than vendored copies that drift.
npx -y @ai-hero/sandcastle@latest init \
  --template simple-loop --agent claude-code --sandbox docker \
  --issue-tracker github-issues --create-label false \
  --build-image false --install-template-deps false

# Beachfront overlay: behaviour that does NOT come from upstream — our prompt
# (ready-for-agent selection, blocked-by handling, CI mode), our run config
# (model + CI branch strategy), and the autonomous headless workflow.
cp "$SRC_ROOT/.sandcastle/prompt.md" .sandcastle/prompt.md
cp "$SRC_ROOT/.sandcastle/main.mts"  .sandcastle/main.mts
mkdir -p .github/workflows
cp "$SRC_ROOT/.github/workflows/sandcastle.yml" .github/workflows/

# Ensure the host launcher exists: the `sandcastle` script + its dev deps.
if [ -f package.json ]; then
  tmp="$(mktemp)"
  jq '.scripts.sandcastle = "tsx .sandcastle/main.mts"
      | .devDependencies["@ai-hero/sandcastle"] = (.devDependencies["@ai-hero/sandcastle"] // "^0.10.0")
      | .devDependencies.tsx = (.devDependencies.tsx // "^4.19.0")' package.json >"$tmp" && mv "$tmp" package.json
else
  cat > package.json <<'JSON'
{
  "name": "managed-repo",
  "private": true,
  "type": "module",
  "scripts": { "sandcastle": "tsx .sandcastle/main.mts" },
  "devDependencies": { "@ai-hero/sandcastle": "^0.10.0", "tsx": "^4.19.0" }
}
JSON
fi

# Ensure the agents contract Beachfront reads to classify issues (ADR-0003). If the
# repo has already run setup-matt-pocock-skills we leave its choices alone; otherwise
# we scaffold the common-case defaults (GitHub issues, default labels, single-context).
# Re-run setup-matt-pocock-skills later to customise.
if [ ! -f docs/agents/triage-labels.md ]; then
  echo "  · scaffolding default docs/agents/ contract"
  mkdir -p docs/agents
  cat > docs/agents/issue-tracker.md <<EOF
# Issue tracker

Issues live in **GitHub Issues** on \`$REPO\`, managed with the \`gh\` CLI.
External pull requests are **not** a triage surface.
EOF
  cat > docs/agents/triage-labels.md <<'EOF'
# Triage labels

Canonical triage roles map 1:1 to GitHub label strings (defaults — no remap).

| Role | Label |
| --- | --- |
| `bug` | `bug` |
| `enhancement` | `enhancement` |
| `needs-triage` | `needs-triage` |
| `needs-info` | `needs-info` |
| `ready-for-agent` | `ready-for-agent` |
| `ready-for-human` | `ready-for-human` |
| `wontfix` | `wontfix` |
EOF
  cat > docs/agents/domain.md <<'EOF'
# Domain docs

**Single-context** repo. Glossary at `CONTEXT.md` (if present); ADRs under `docs/adr/`.
EOF
fi

git add .sandcastle .github/workflows/sandcastle.yml package.json docs/agents
git -c user.name="beachfront" -c user.email="beachfront@users.noreply.github.com" \
    commit -q -m "Onboard to Beachfront: autonomous headless Sandcastle workflow"
git push -u origin beachfront/onboard >/dev/null 2>&1
gh pr create -R "$REPO" --base "$DEFAULT_BRANCH" --head beachfront/onboard \
  --title "Onboard to Beachfront (headless Sandcastle)" \
  --body "Adds the autonomous Sandcastle loop and \`.sandcastle/\` config. Merge to start draining \`ready-for-agent\` issues. The repo secret, triage labels, and Actions PR permission are already configured by the onboarder."

echo "✓ Done — review and merge the onboarding PR on $REPO."
