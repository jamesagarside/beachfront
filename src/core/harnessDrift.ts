/**
 * Harness-drift computation (#115): the one pure answer both surfaces stand on
 * for "is this Managed repo running the current loop harness?". Onboarding stamps
 * each repo with `.sandcastle/.beachfront-version` — its first line is the
 * Tool-repo short git SHA the harness was installed from (its "vintage"). This
 * module compares that installed vintage against the vintage the running
 * Beachfront was built from and folds it into a calm three-state indicator.
 *
 * Vintages are short SHAs, not ordinals, so we can't honestly say "N behind":
 * we only know a stamped repo either matches the current vintage (`current`) or
 * doesn't (`behind`). A repo with no stamp — an older onboard, before the stamp
 * convention — is `unknown`, never assumed stale. A `behind` repo carries the
 * exact fix a Viewer runs; the others carry none. Kept a pure function of its
 * three inputs (repo, installed, current) so both surfaces share one answer and
 * tests can pass any vintage without a build or a git call.
 */
import type { RepoRef } from "../config.ts";

/** The fix a Viewer runs to bring a behind repo up to the current harness. */
export function updateCommand({ owner, repo }: RepoRef): string {
  return `scripts/beachfront-update.sh ${owner}/${repo}`;
}

/** One repo's harness vintage relative to the running Beachfront's. */
export interface HarnessDrift {
  /**
   * `current` — installed vintage matches the Tool-repo's;
   * `behind` — a stamped vintage that differs (drifted from current);
   * `unknown` — no stamp (older onboard) or the build knows no current vintage.
   */
  state: "current" | "behind" | "unknown";
  /** The repo's stamped vintage, trimmed, or null when it carries no stamp. */
  installed: string | null;
  /** The vintage the running Beachfront was built from, or null when unknown. */
  current: string | null;
  /** The `beachfront-update.sh` fix, set only when the repo is `behind`. */
  fix: string | null;
}

/** Normalises a raw stamp (a file line) to a vintage, or null when absent. */
function normalise(raw: string | null): string | null {
  if (raw === null) return null;
  const trimmed = raw.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * Computes a repo's harness drift from its stamped vintage (`installed`, the
 * first line of `.sandcastle/.beachfront-version`, or null when unstamped) and
 * the vintage the running Beachfront was built from (`current`).
 */
export function computeHarnessDrift(
  repo: RepoRef,
  installed: string | null,
  current: string | null,
): HarnessDrift {
  const stamp = normalise(installed);
  const build = normalise(current);

  // No stamp, or a build that can't name its own vintage: we can't judge drift
  // honestly, so read unknown and never push the fix at it.
  if (stamp === null || build === null) {
    return { state: "unknown", installed: stamp, current: build, fix: null };
  }

  if (stamp === build) {
    return { state: "current", installed: stamp, current: build, fix: null };
  }

  return {
    state: "behind",
    installed: stamp,
    current: build,
    fix: updateCommand(repo),
  };
}
