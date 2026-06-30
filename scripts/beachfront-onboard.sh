#!/usr/bin/env bash
#
# beachfront-onboard.sh — make a target GitHub repo a Beachfront-Managed repo.
#
# A GUIDED, flexible installer for the autonomous headless Sandcastle setup (ADR-0006).
# It interviews you for the choices that matter, shows a plan, and only then touches the
# repo. Every prompt has a sensible default and an env-var override, so the same script
# runs fully unattended in CI (pass --yes, or BEACHFRONT_ASSUME_YES=1).
#
# What it can install (each optional unless noted):
#   • Canonical triage labels (always — the loop selects on `ready-for-agent`)
#   • The CLAUDE_CODE_OAUTH_TOKEN secret (always — the agent needs model access)
#   • The Beachfront App PR-opener secrets (so loop PRs trigger CI — ADR-0007)
#   • Repo settings + branch protection the loop depends on
#   • The headless loop: `.sandcastle/` + sandcastle.yml (always)
#   • Gated Markdown auto-merge (automerge.yml, ADR-0007)
#   • AI review gate (auto-review.yml, ADR-0012) — lets feature PRs auto-merge after an
#     independent agent review, WITH a security block; adds the `needs-human` label
#   • Branch auto-update (auto-update.yml, ADR-0012) — keeps approved PRs current so the
#     auto-merge queue actually drains
#
# Non-interactive overrides (each: true/false; unset = ask, or use the default):
#   BEACHFRONT_ASSUME_YES=1            accept all defaults, never prompt
#   BEACHFRONT_AUTO_MERGE_MD=          Markdown gated auto-merge        (default: yes)
#   BEACHFRONT_AUTO_REVIEW=            AI review gate + security block  (default: yes)
#   BEACHFRONT_AUTO_UPDATE=            branch auto-update               (default: follows auto-merge)
#   BEACHFRONT_REQUIRED_CHECKS=        comma-separated CI check names to require on merge
#   BEACHFRONT_REVIEW_MODEL=           model for the review agent (default: workflow's own)
#   CLAUDE_CODE_OAUTH_TOKEN / BEACHFRONT_APP_ID / BEACHFRONT_APP_PRIVATE_KEY[_FILE]
#
# Usage:   scripts/beachfront-onboard.sh <owner/repo> [--yes]
# Auth:    your existing `gh` login; you need admin on <owner/repo>.
# Linking the repo into a Beachfront Instance's Registry is a separate step: `beachfront link`.

set -euo pipefail

# ---- args -------------------------------------------------------------------
REPO=""
for arg in "$@"; do
  case "$arg" in
    --yes|-y) BEACHFRONT_ASSUME_YES=1 ;;
    -*) echo "✗ Unknown flag: $arg"; exit 1 ;;
    *) [ -z "$REPO" ] && REPO="$arg" ;;
  esac
done
[ -n "$REPO" ] || { echo "Usage: scripts/beachfront-onboard.sh <owner/repo> [--yes]"; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# ---- guided-mode helpers ----------------------------------------------------
INTERACTIVE=1
{ [ -t 0 ] && [ -t 1 ]; } || INTERACTIVE=0
[ -n "${BEACHFRONT_ASSUME_YES:-}" ] && INTERACTIVE=0

if [ -t 1 ]; then B=$'\033[1m'; D=$'\033[2m'; G=$'\033[32m'; Y=$'\033[33m'; R=$'\033[0m'; else B=""; D=""; G=""; Y=""; R=""; fi
say()  { printf '%s\n' "$*"; }
sect() { printf '\n%s▸ %s%s\n' "$B" "$*" "$R"; }
why()  { printf '%s  %s%s\n' "$D" "$*" "$R"; }
warn() { printf '%s  ⚠ %s%s\n' "$Y" "$*" "$R"; }

_bool() { case "$(printf '%s' "${1:-}" | tr '[:upper:]' '[:lower:]')" in true|1|yes|on|y) echo 1 ;; false|0|no|off|n) echo 0 ;; *) echo "" ;; esac; }

# ask "question" DEFAULT(Y|N) ENVVAR  -> exit 0 = yes, 1 = no
ask() {
  local q="$1" def="${2:-Y}" envvar="${3:-}" ov ans
  if [ -n "$envvar" ]; then ov="$(_bool "${!envvar:-}")"; [ "$ov" = 1 ] && return 0; [ "$ov" = 0 ] && return 1; fi
  if [ "$INTERACTIVE" = 0 ]; then [ "$def" = Y ] && return 0 || return 1; fi
  local hint='[Y/n]'; [ "$def" = N ] && hint='[y/N]'
  printf '  %s %s ' "$q" "$hint"; read -r ans || ans=""
  ans="${ans:-$def}"; case "$ans" in [Yy]*) return 0 ;; *) return 1 ;; esac
}

# ask_value "label" DEFAULT ENVVAR  -> echoes the chosen value
ask_value() {
  local label="$1" def="${2:-}" envvar="${3:-}" val
  if [ -n "$envvar" ] && [ -n "${!envvar:-}" ]; then printf '%s' "${!envvar}"; return; fi
  if [ "$INTERACTIVE" = 0 ]; then printf '%s' "$def"; return; fi
  printf '  %s%s ' "$label" "${def:+ [$def]}" >&2; read -r val || val=""
  printf '%s' "${val:-$def}"
}

command -v gh  >/dev/null || { echo "✗ gh CLI is required"; exit 1; }
command -v jq  >/dev/null || { echo "✗ jq is required"; exit 1; }
command -v npx >/dev/null || { echo "✗ npx (Node.js) is required"; exit 1; }
gh repo view "$REPO" >/dev/null 2>&1 || { echo "✗ Cannot access $REPO with your gh login"; exit 1; }

say ""
say "${B}Beachfront onboarding — $REPO${R}"
why "Makes this repo a Beachfront-Managed repo: an autonomous Sandcastle loop that drains"
why "its \`ready-for-agent\` issues and opens a PR per run (ADR-0006). Guided below; nothing"
why "is changed on the repo until you confirm the plan."
[ "$INTERACTIVE" = 0 ] && say "${D}  (non-interactive: accepting defaults / env overrides)${R}"

# ============================================================================
# INTERVIEW — collect every choice first; no side effects on the repo yet.
# ============================================================================

# -- Claude token (required) --------------------------------------------------
sect "Claude credential (required)"
why "The agent uses your Claude subscription for model access. Mint one with \`claude setup-token\`."
TOKEN="${CLAUDE_CODE_OAUTH_TOKEN:-}"
if [ -z "$TOKEN" ] && [ -f "$SRC_ROOT/.sandcastle/.env" ]; then
  TOKEN="$(grep -E '^CLAUDE_CODE_OAUTH_TOKEN=' "$SRC_ROOT/.sandcastle/.env" | head -1 | cut -d= -f2-)"
fi
if [ -n "$TOKEN" ]; then
  say "  · found a token (env or .sandcastle/.env)"
elif [ "$INTERACTIVE" = 1 ]; then
  printf '  Paste a Claude OAuth token: '; read -rs TOKEN || TOKEN=""; echo
fi
[ -n "$TOKEN" ] || { echo "✗ No Claude token provided (set CLAUDE_CODE_OAUTH_TOKEN or run interactively)"; exit 1; }

# -- Beachfront App PR-opener secrets (optional but recommended) --------------
sect "Beachfront App PR-opener (recommended)"
why "A PR opened with GITHUB_TOKEN does NOT trigger CI (GitHub anti-recursion), so the loop"
why "opens its PR with a GitHub App token (ADR-0007). Without it, loop PRs won't run CI and"
why "auto-merge has nothing to gate on."
APP_ID="${BEACHFRONT_APP_ID:-}"; APP_KEY="${BEACHFRONT_APP_PRIVATE_KEY:-}"; APP_KEY_FILE="${BEACHFRONT_APP_PRIVATE_KEY_FILE:-}"
if [ -f "$SRC_ROOT/.sandcastle/.env" ]; then
  [ -z "$APP_ID" ] && APP_ID="$(grep -E '^BEACHFRONT_APP_ID=' "$SRC_ROOT/.sandcastle/.env" | head -1 | cut -d= -f2-)"
  [ -z "$APP_KEY" ] && [ -z "$APP_KEY_FILE" ] && \
    APP_KEY_FILE="$(grep -E '^BEACHFRONT_APP_PRIVATE_KEY_FILE=' "$SRC_ROOT/.sandcastle/.env" | head -1 | cut -d= -f2-)"
fi
HAVE_APP=0
if [ -n "$APP_ID" ] && { [ -n "$APP_KEY" ] || [ -n "$APP_KEY_FILE" ]; }; then HAVE_APP=1; say "  · found App credentials"; else warn "no App credentials found — loop PRs will fall back to GITHUB_TOKEN (no CI)"; fi

# -- Feature toggles ----------------------------------------------------------
sect "Choose the merge automation"
why "The loop always runs and opens PRs. These decide how much merges by itself."

DO_AUTOMERGE_MD=0
if ask "Gated Markdown auto-merge? (docs-only App PRs merge on green — ADR-0007)" Y BEACHFRONT_AUTO_MERGE_MD; then DO_AUTOMERGE_MD=1; fi

DO_AUTO_REVIEW=0
say ""
why "AI review gate (ADR-0012): an INDEPENDENT review agent reviews each feature PR against"
why "its issue and either enables auto-merge (on a clear pass) or routes it to a human. It"
why "ALWAYS blocks security-relevant changes. This makes AI judgement partly load-bearing —"
why "deliberate, recorded, and fail-closed. Decline to keep every feature PR human-gated."
if ask "Enable the AI review gate?" Y BEACHFRONT_AUTO_REVIEW; then DO_AUTO_REVIEW=1; fi

REVIEW_MODEL=""
if [ "$DO_AUTO_REVIEW" = 1 ]; then
  REVIEW_MODEL="$(ask_value "Review model (blank = the workflow's default):" "" BEACHFRONT_REVIEW_MODEL)"
fi

# Auto-update only matters when something can auto-merge. Default follows that.
AM_DEFAULT=N
if [ "$DO_AUTOMERGE_MD" = 1 ] || [ "$DO_AUTO_REVIEW" = 1 ]; then AM_DEFAULT=Y; fi
DO_AUTO_UPDATE=0
say ""
why "Branch auto-update (ADR-0012): when strict branch protection is on, GitHub won't"
why "auto-update a behind PR, so an approved PR stalls the moment another merges. This keeps"
why "the queue draining. Recommended whenever any auto-merge is on."
if ask "Enable branch auto-update?" "$AM_DEFAULT" BEACHFRONT_AUTO_UPDATE; then DO_AUTO_UPDATE=1; fi

# -- Required status checks ---------------------------------------------------
sect "Required status checks"
why "Auto-merge only ever merges once REQUIRED checks pass. Give the names of this repo's CI"
why "checks (comma-separated, e.g. 'build,test'). Leave blank to protect the branch as"
why "PRs-only and add checks later — but note auto-merge would then merge with nothing to gate."
REQUIRED_CHECKS="$(ask_value "Required check names:" "" BEACHFRONT_REQUIRED_CHECKS)"
if [ "$DO_AUTO_REVIEW" = 1 ] && [ -z "$REQUIRED_CHECKS" ]; then
  warn "AI auto-merge with NO required checks means a passing review merges code that CI never ran."
  if [ "$INTERACTIVE" = 1 ] && ! ask "Continue anyway?" N; then echo "Aborted — re-run with required checks."; exit 1; fi
fi

# ============================================================================
# PLAN — show exactly what will happen, then confirm.
# ============================================================================
NEED_NATIVE_AM=N
if [ "$DO_AUTOMERGE_MD" = 1 ] || [ "$DO_AUTO_REVIEW" = 1 ]; then NEED_NATIVE_AM=Y; fi
yn() { if [ "$1" = 1 ]; then printf '%syes%s' "$G" "$R"; else printf '%sno%s' "$D" "$R"; fi; }
sect "Plan for $REPO"
say  "  Triage labels + needs-human ......... ${G}yes${R}"
say  "  Claude secret ....................... ${G}yes${R}"
say  "  App PR-opener secrets ............... $(yn "$HAVE_APP")"
say  "  Native auto-merge capability ........ $([ "$NEED_NATIVE_AM" = Y ] && printf '%syes%s' "$G" "$R" || printf '%sno%s' "$D" "$R")"
say  "  Markdown gated auto-merge ........... $(yn "$DO_AUTOMERGE_MD")"
say  "  AI review gate (auto-review) ........ $(yn "$DO_AUTO_REVIEW")${REVIEW_MODEL:+  (model: $REVIEW_MODEL)}"
say  "  Branch auto-update .................. $(yn "$DO_AUTO_UPDATE")"
say  "  Required checks ..................... ${REQUIRED_CHECKS:-${D}none (PRs-only)${R}}"
say  "  Onboarding PR (.sandcastle + workflows) on the default branch"
say ""
if ! ask "Proceed and apply this to $REPO?" Y; then echo "Aborted — nothing changed."; exit 0; fi

# ============================================================================
# EXECUTE
# ============================================================================
sect "Ensuring canonical triage labels"
declare -A LABELS=(
  [needs-triage]="FF8C61|Maintainer needs to evaluate"
  [needs-info]="A9D6E5|Waiting on reporter for more information"
  [ready-for-agent]="1B998B|Fully specified, ready for an AFK agent"
  [in-progress]="6F42C1|An agent is working this; a PR is open"
  [ready-for-human]="FFB84D|Needs human implementation"
  [needs-human]="B60205|Auto-review declined or unsure; needs a human merge decision (ADR-0012)"
  [wontfix]="8A8580|Will not be actioned"
  [bug]="D73A4A|Something is broken"
  [enhancement]="0B4F6C|New feature or improvement"
)
for name in "${!LABELS[@]}"; do
  IFS='|' read -r color desc <<<"${LABELS[$name]}"
  gh label create "$name" -R "$REPO" --color "$color" --description "$desc" --force >/dev/null
done

sect "Setting the CLAUDE_CODE_OAUTH_TOKEN repo secret"
printf '%s' "$TOKEN" | gh secret set CLAUDE_CODE_OAUTH_TOKEN --repo "$REPO"   # stdin: never in argv

if [ "$HAVE_APP" = 1 ]; then
  sect "Setting the Beachfront App PR-opener secrets"
  printf '%s' "$APP_ID" | gh secret set BEACHFRONT_APP_ID --repo "$REPO"
  if [ -n "$APP_KEY_FILE" ]; then gh secret set BEACHFRONT_APP_PRIVATE_KEY --repo "$REPO" < "$APP_KEY_FILE"
  else printf '%s' "$APP_KEY" | gh secret set BEACHFRONT_APP_PRIVATE_KEY --repo "$REPO"; fi
fi

if [ -n "$REVIEW_MODEL" ]; then
  sect "Setting the review model variable"
  gh variable set BEACHFRONT_REVIEW_MODEL --repo "$REPO" --body "$REVIEW_MODEL" >/dev/null
fi

sect "Allowing GitHub Actions to create PRs"
gh api -X PUT "repos/$REPO/actions/permissions/workflow" \
  -F default_workflow_permissions=write -F can_approve_pull_request_reviews=true >/dev/null

if [ "$NEED_NATIVE_AM" = Y ]; then
  sect "Enabling native auto-merge"
  gh api -X PATCH "repos/$REPO" -F allow_auto_merge=true >/dev/null
fi
if [ "$DO_AUTO_UPDATE" = 1 ]; then
  sect "Enabling branch auto-update capability"
  gh api -X PATCH "repos/$REPO" -F allow_update_branch=true >/dev/null
fi

DEFAULT_BRANCH="$(gh repo view "$REPO" --json defaultBranchRef --jq .defaultBranchRef.name)"
sect "Protecting the $DEFAULT_BRANCH branch (PRs only, no required reviewer)"
CHECKS_JSON="null"
if [ -n "$REQUIRED_CHECKS" ]; then
  CHECKS_JSON="$(jq -cn --arg c "$REQUIRED_CHECKS" \
    '{strict: true, contexts: ($c | split(",") | map(gsub("^ +| +$"; "")) | map(select(length > 0)))}')"
fi
if jq -cn --argjson checks "$CHECKS_JSON" '{
     required_status_checks: $checks, enforce_admins: true,
     required_pull_request_reviews: { required_approving_review_count: 0 }, restrictions: null
   }' | gh api --method PUT "repos/$REPO/branches/$DEFAULT_BRANCH/protection" --input - >/dev/null 2>&1; then
  say "  · branch protection applied${REQUIRED_CHECKS:+ (required checks: $REQUIRED_CHECKS)}"
else
  warn "could not set branch protection (needs admin on $REPO — set it in Settings → Branches)"
fi

sect "Scaffolding the latest official Sandcastle + Beachfront overlay"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
gh repo clone "$REPO" "$TMP/repo" -- --depth 1 >/dev/null 2>&1
cd "$TMP/repo"
git switch -c beachfront/onboard >/dev/null 2>&1

# Base config from the official package (@latest) so the Sandcastle mechanics stay current.
npx -y @ai-hero/sandcastle@latest init \
  --template simple-loop --agent claude-code --sandbox docker \
  --issue-tracker github-issues --create-label false \
  --build-image false --install-template-deps false

# Beachfront overlay: our prompt + run config + the selected workflows.
cp "$SRC_ROOT/.sandcastle/prompt.md" .sandcastle/prompt.md
cp "$SRC_ROOT/.sandcastle/main.mts"  .sandcastle/main.mts
mkdir -p .github/workflows
cp "$SRC_ROOT/.github/workflows/sandcastle.yml" .github/workflows/
INSTALLED="sandcastle.yml"
ADD_PATHS=(.sandcastle .github/workflows/sandcastle.yml package.json docs/agents)
if [ "$DO_AUTOMERGE_MD" = 1 ]; then cp "$SRC_ROOT/.github/workflows/automerge.yml" .github/workflows/; ADD_PATHS+=(.github/workflows/automerge.yml); INSTALLED="$INSTALLED, automerge.yml"; fi
if [ "$DO_AUTO_REVIEW" = 1 ]; then cp "$SRC_ROOT/.github/workflows/auto-review.yml" .github/workflows/; ADD_PATHS+=(.github/workflows/auto-review.yml); INSTALLED="$INSTALLED, auto-review.yml"; fi
if [ "$DO_AUTO_UPDATE" = 1 ]; then cp "$SRC_ROOT/.github/workflows/auto-update.yml" .github/workflows/; ADD_PATHS+=(.github/workflows/auto-update.yml); INSTALLED="$INSTALLED, auto-update.yml"; fi

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

# Ensure the agents contract Beachfront reads to classify issues (ADR-0003).
if [ ! -f docs/agents/triage-labels.md ]; then
  say "  · scaffolding default docs/agents/ contract"
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

git add "${ADD_PATHS[@]}"
git -c user.name="beachfront" -c user.email="beachfront@users.noreply.github.com" \
    commit -q -m "Onboard to Beachfront: autonomous headless Sandcastle workflow"
git push -u origin beachfront/onboard >/dev/null 2>&1
gh pr create -R "$REPO" --base "$DEFAULT_BRANCH" --head beachfront/onboard \
  --title "Onboard to Beachfront (headless Sandcastle)" \
  --body "Adds the autonomous Sandcastle loop (\`.sandcastle/\`) and these workflows: ${INSTALLED}.

Merge to start draining \`ready-for-agent\` issues. Secrets, triage labels, Actions PR permission, native auto-merge / branch-update, and branch protection are already configured by the onboarder."

# ---- summary + next steps ---------------------------------------------------
say ""
say "${G}✓ Onboarding PR opened on $REPO${R} — review and merge it to go live."
sect "Before it can run, confirm:"
[ "$HAVE_APP" = 1 ] || warn "App secrets were skipped — loop PRs won't trigger CI until the Beachfront App is configured."
say  "  · The Beachfront GitHub App is INSTALLED on $REPO (grants it access; secrets alone aren't enough)."
[ "$DO_AUTO_REVIEW" = 1 ] && [ -z "$REQUIRED_CHECKS" ] && warn "auto-review is on but no required checks — add this repo's CI checks in Settings → Branches."
sect "Then, to see it in your Beachfront:"
say  "  beachfront link $REPO        # adds it to your Instance's Registry"
