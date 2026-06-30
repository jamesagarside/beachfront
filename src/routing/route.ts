/**
 * The routing seam (ADR-0009). Beachfront is a static SPA served under a
 * sub-path, where path routing 404s on deep-link/reload — so navigation is
 * **hash routing**, served by the single `index.html` with no server config.
 *
 * This module is the seam's pure core: parse a `location.hash` into a typed
 * {@link Route}, and build the hashes the nav links point at. Keeping it free of
 * React/DOM means `react-router` can replace the seam later as a localised
 * change without touching the views.
 *
 * Routes: `#/` (the Shoreline home) and `#/repo/<owner>/<repo>` using the
 * canonical Registry key verbatim. Anything unrecognised falls back to the
 * Shoreline rather than a blank pane.
 */
export type Route =
  | { name: "shoreline" }
  | { name: "repo"; owner: string; repo: string };

/** The hash for the Shoreline home. */
export const SHORELINE_HASH = "#/";

/** Builds the hash for a repo's per-repo view from its canonical key. */
export function repoHash(owner: string, repo: string): string {
  return `#/repo/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
}

function decode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/**
 * Parses a `location.hash` (with or without the leading `#`) into a Route. An
 * unknown shape resolves to the Shoreline, so a stale or hand-typed deep-link
 * never strands the Viewer on a blank view.
 */
export function parseRoute(hash: string): Route {
  const segments = hash
    .replace(/^#/, "")
    .split("/")
    .filter((segment) => segment.length > 0)
    .map(decode);

  if (segments[0] === "repo" && segments.length === 3) {
    return { name: "repo", owner: segments[1], repo: segments[2] };
  }
  return { name: "shoreline" };
}
