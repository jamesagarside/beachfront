/**
 * Instance configuration. `VITE_BEACHFRONT_REPO` (build-time, `owner/repo`)
 * names the Instance repo itself — the target of link PRs. The Pages deploy
 * workflow sets it to the building repo; the Tool-repo default only covers
 * local dev, so an Instance built outside that workflow must set it or link
 * PRs would aim at the public upstream.
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
