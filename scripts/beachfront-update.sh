#!/usr/bin/env bash
#
# beachfront-update.sh — refresh the Beachfront harness in an already-onboarded repo.
#
# Onboarding copies a SNAPSHOT of the loop's workflows + run config into a Managed repo
# (see beachfront-onboard.sh / ADR-0006). That snapshot doesn't self-update. When the
# Tool repo's harness improves, run this to pull the current versions into an update PR.
#
# It is deliberately conservative:
#   • Only refreshes harness files the repo ALREADY has — it never enables a feature
#     (auto-review, auto-merge, auto-update) the repo wasn't onboarded with.
#   • Never re-runs the interview, re-applies settings, or touches branch protection.
#   • Flags any file the repo has locally customised (diverged from what was installed),
#     so a review isn't silently clobbered.
#   • Records the new vintage in .sandcastle/.beachfront-version.
#   • Opens a PR with the diff and stops — nothing merges without your review.
#
# If the repo is already on the current harness, it changes nothing and says so.
#
# Usage:   scripts/beachfront-update.sh <owner/repo> [--yes]
# Auth:    your existing `gh` login; you need write access on <owner/repo>.

set -euo pipefail

# ---- args -------------------------------------------------------------------
REPO=""; ASSUME_YES="${BEACHFRONT_ASSUME_YES:-}"
for arg in "$@"; do
  case "$arg" in
    --yes|-y) ASSUME_YES=1 ;;
    -*) echo "✗ Unknown flag: $arg"; exit 1 ;;
    *) [ -z "$REPO" ] && REPO="$arg" ;;
  esac
done
[ -n "$REPO" ] || { echo "Usage: scripts/beachfront-update.sh <owner/repo> [--yes]"; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

if [ -t 1 ]; then B=$'\033[1m'; D=$'\033[2m'; G=$'\033[32m'; Y=$'\033[33m'; R=$'\033[0m'; else B=""; D=""; G=""; Y=""; R=""; fi
say()  { printf '%s\n' "$*"; }
sect() { printf '\n%s▸ %s%s\n' "$B" "$*" "$R"; }
warn() { printf '%s  ⚠ %s%s\n' "$Y" "$*" "$R"; }

command -v gh  >/dev/null || { echo "✗ gh CLI is required"; exit 1; }
gh repo view "$REPO" >/dev/null 2>&1 || { echo "✗ Cannot access $REPO with your gh login"; exit 1; }

# Overlay files that are ALWAYS part of an onboarded repo.
CORE_FILES=(.sandcastle/prompt.md .sandcastle/main.mts .github/workflows/sandcastle.yml)
# Optional workflows: refreshed only if the target already has them.
OPTIONAL_FILES=(.github/workflows/automerge.yml .github/workflows/auto-review.yml .github/workflows/auto-update.yml)

NEW_STAMP="$(git -C "$SRC_ROOT" rev-parse --short HEAD 2>/dev/null || echo unknown)"

say ""
say "${B}Beachfront harness update — $REPO${R}"
say "${D}  current Tool-repo harness: $NEW_STAMP${R}"

# ---- clone + verify the repo is onboarded -----------------------------------
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
gh repo clone "$REPO" "$TMP/repo" -- --depth 1 >/dev/null 2>&1
cd "$TMP/repo"
DEFAULT_BRANCH="$(gh repo view "$REPO" --json defaultBranchRef --jq .defaultBranchRef.name)"

if [ ! -f .sandcastle/main.mts ] || [ ! -f .github/workflows/sandcastle.yml ]; then
  echo "✗ $REPO doesn't look onboarded (no .sandcastle/main.mts or sandcastle.yml)."
  echo "  Run scripts/beachfront-onboard.sh $REPO first."
  exit 1
fi

OLD_STAMP="unknown"
[ -f .sandcastle/.beachfront-version ] && OLD_STAMP="$(head -1 .sandcastle/.beachfront-version | tr -d '[:space:]')"
say "${D}  installed harness in $REPO: $OLD_STAMP${R}"

# ---- work out which files to refresh ----------------------------------------
TO_REFRESH=("${CORE_FILES[@]}")
for f in "${OPTIONAL_FILES[@]}"; do [ -f "$f" ] && TO_REFRESH+=("$f"); done

# Can we tell what was originally installed? (for local-edit detection)
BASE_OK=0
if [ "$OLD_STAMP" != "unknown" ] && git -C "$SRC_ROOT" cat-file -e "${OLD_STAMP}^{commit}" 2>/dev/null; then BASE_OK=1; fi

sect "Refreshing harness files present in $REPO"
CHANGED=(); CUSTOMISED=()
for f in "${TO_REFRESH[@]}"; do
  [ -f "$SRC_ROOT/$f" ] || { warn "Tool repo has no $f — skipping"; continue; }
  # Local-edit detection: did the repo diverge from what was installed at OLD_STAMP?
  if [ "$BASE_OK" = 1 ]; then
    if git -C "$SRC_ROOT" show "${OLD_STAMP}:${f}" > "$TMP/base" 2>/dev/null; then
      cmp -s "$TMP/base" "$f" || CUSTOMISED+=("$f")
    fi
  fi
  cp "$SRC_ROOT/$f" "$f"
  if ! git diff --quiet -- "$f"; then CHANGED+=("$f"); say "  · updated $f"; fi
done

printf '%s\n' "$NEW_STAMP" > .sandcastle/.beachfront-version

if [ "${#CHANGED[@]}" -eq 0 ]; then
  say ""
  say "${G}✓ $REPO is already on the current harness — nothing to do.${R}"
  exit 0
fi

if [ "${#CUSTOMISED[@]}" -gt 0 ]; then
  warn "These files were locally customised in $REPO and will be overwritten by this PR:"
  for f in "${CUSTOMISED[@]}"; do warn "    $f"; done
  warn "Reconcile your changes when reviewing the PR diff."
fi

# ---- confirm ----------------------------------------------------------------
say ""
say "  Will open a PR on $REPO updating ${#CHANGED[@]} file(s): $OLD_STAMP → $NEW_STAMP"
if [ -z "$ASSUME_YES" ] && [ -t 0 ] && [ -t 1 ]; then
  printf '  Proceed? [Y/n] '; read -r ans || ans=""; case "${ans:-Y}" in [Yy]*) ;; *) echo "Aborted — nothing changed."; exit 0 ;; esac
fi

# ---- commit, push, PR -------------------------------------------------------
BRANCH="beachfront/update-${NEW_STAMP}-$(date +%s)"
git switch -c "$BRANCH" >/dev/null 2>&1
git add "${CHANGED[@]}" .sandcastle/.beachfront-version
git -c user.name="beachfront" -c user.email="beachfront@users.noreply.github.com" \
    commit -q -m "Update Beachfront harness ($OLD_STAMP → $NEW_STAMP)"
git push -u origin "$BRANCH" >/dev/null 2>&1

BODY="Refreshes the Beachfront harness snapshot in this repo (\`$OLD_STAMP\` → \`$NEW_STAMP\`).

Updated files:
$(printf -- '- \`%s\`\n' "${CHANGED[@]}")

Review the diff before merging. Optional workflows the repo doesn't have were left untouched."
if [ "${#CUSTOMISED[@]}" -gt 0 ]; then
  BODY="${BODY}

⚠ **Locally customised files overwritten** — reconcile before merging:
$(printf -- '- \`%s\`\n' "${CUSTOMISED[@]}")"
fi

gh pr create -R "$REPO" --base "$DEFAULT_BRANCH" --head "$BRANCH" \
  --title "Update Beachfront harness ($OLD_STAMP → $NEW_STAMP)" \
  --body "$BODY"

say ""
say "${G}✓ Update PR opened on $REPO${R} — review and merge to adopt the current harness."
