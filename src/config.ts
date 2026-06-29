/**
 * Instance configuration. For this slice Beachfront aggregates a single
 * configured repo (the cross-repo Registry arrives in a later slice, #4). The
 * repo is read from the `VITE_BEACHFRONT_REPO` build-time env (`owner/repo`),
 * defaulting to the Tool repo so the app shows real data with no setup.
 */
export interface RepoRef {
  owner: string;
  repo: string;
}

const DEFAULT_REPO = "jamesagarside/beachfront";

export function parseRepoRef(slug: string): RepoRef {
  const [owner, repo] = slug.trim().split("/");
  if (!owner || !repo) {
    throw new Error(
      `Invalid repo "${slug}". Expected "owner/repo" (e.g. jamesagarside/beachfront).`,
    );
  }
  return { owner, repo };
}

export function configuredRepo(): RepoRef {
  const raw =
    (import.meta.env.VITE_BEACHFRONT_REPO as string | undefined) ?? DEFAULT_REPO;
  return parseRepoRef(raw);
}
