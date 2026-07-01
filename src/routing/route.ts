import type { RepoRef } from "../config.ts";

/**
 * The Beachfront view map (ADR-0009): a two-view SPA behind a small routing
 * seam. The Shoreline is home; a per-repo route opens one Managed repo's
 * mission deck. Hash routing — not path routing — because Beachfront is a static
 * SPA served under a sub-path (ADR-0001/0005), where a deep-link or reload on a
 * real path 404s without server rewrites; a `#/…` fragment is always served by
 * the single `index.html` with no server config. The seam keeps that choice
 * localised so `react-router` (path routing) can replace it later if the hosting
 * model changes.
 */
export type Route =
  | { kind: "shoreline" }
  | { kind: "repo"; owner: string; repo: string };

export const SHORELINE_HASH = "#/";

/** The Shoreline route — the home, and the fallback for anything unresolved. */
export const SHORELINE: Route = { kind: "shoreline" };

/** A repo's deep-link hash, using the canonical Registry key verbatim. */
export function repoHash({ owner, repo }: RepoRef): string {
  return `#/repo/${owner}/${repo}`;
}

/** The hash for any route — the inverse of {@link parseHash}. */
export function hashFor(route: Route): string {
  return route.kind === "repo" ? repoHash(route) : SHORELINE_HASH;
}

/**
 * Parses a `window.location.hash` into a {@link Route}. `#/` (and empty) is the
 * Shoreline; `#/repo/<owner>/<repo>` opens that repo. Anything else — an unknown
 * shape, a missing segment — falls back to the Shoreline rather than a blank
 * pane, per the ADR's "honest states, never blank" rule. The deeper gate (is the
 * repo in the Registry, can the token read it) lives in the view, not here.
 */
export function parseHash(hash: string): Route {
  // Tolerate a leading "#", an optional "/", then match the repo shape.
  const path = hash.replace(/^#/, "").replace(/^\//, "");
  if (path === "") return SHORELINE;

  const match = /^repo\/([^/]+)\/([^/]+)\/?$/.exec(path);
  if (match) {
    // Malformed percent-encoding throws; a bad shared link falls back to the
    // Shoreline like any other unresolved shape.
    try {
      const owner = decodeURIComponent(match[1]);
      const repo = decodeURIComponent(match[2]);
      if (owner && repo) return { kind: "repo", owner, repo };
    } catch {
      return SHORELINE;
    }
  }

  return SHORELINE;
}

/** True when two routes resolve to the same view — for active-nav highlighting. */
export function sameRoute(a: Route, b: Route): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "repo" && b.kind === "repo") {
    return a.owner === b.owner && a.repo === b.repo;
  }
  return true;
}
