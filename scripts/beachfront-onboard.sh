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
#   4. A PR adding .sandcastle/ + .github/workflows/sandcastle.yml (+ package.json
#      launcher wiring), copied from THIS Beachfront repo as the canonical template.
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

# 4. Install the template via a PR -------------------------------------------
echo "▸ Opening a PR to install the headless Sandcastle workflow"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
gh repo clone "$REPO" "$TMP/repo" -- --depth 1 >/dev/null 2>&1
DEFAULT_BRANCH="$(gh repo view "$REPO" --json defaultBranchRef --jq .defaultBranchRef.name)"
cd "$TMP/repo"
git switch -c beachfront/onboard >/dev/null 2>&1

mkdir -p .sandcastle .github/workflows
cp "$SRC_ROOT/.sandcastle/main.mts" \
   "$SRC_ROOT/.sandcastle/prompt.md" \
   "$SRC_ROOT/.sandcastle/Dockerfile" \
   "$SRC_ROOT/.sandcastle/.env.example" \
   "$SRC_ROOT/.sandcastle/.gitignore" .sandcastle/
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

# Warn (don't fail) if the Matt-Pocock agents contract is missing — Beachfront reads
# docs/agents/triage-labels.md to classify issues (ADR-0003). Run setup-matt-pocock-skills.
[ -f docs/agents/triage-labels.md ] || echo "  ⚠ docs/agents/ not found — run setup-matt-pocock-skills in $REPO for full classification"

git add .sandcastle .github/workflows/sandcastle.yml package.json
git -c user.name="beachfront" -c user.email="beachfront@users.noreply.github.com" \
    commit -q -m "Onboard to Beachfront: autonomous headless Sandcastle workflow"
git push -u origin beachfront/onboard >/dev/null 2>&1
gh pr create -R "$REPO" --base "$DEFAULT_BRANCH" --head beachfront/onboard \
  --title "Onboard to Beachfront (headless Sandcastle)" \
  --body "Adds the autonomous Sandcastle loop and \`.sandcastle/\` config. Merge to start draining \`ready-for-agent\` issues. The repo secret, triage labels, and Actions PR permission are already configured by the onboarder."

echo "✓ Done — review and merge the onboarding PR on $REPO."
