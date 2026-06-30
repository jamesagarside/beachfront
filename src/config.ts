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

/**
 * "Login with GitHub" configuration (ADR-0001, #25). The browser cannot do
 * GitHub's `code → token` exchange itself, so this path needs both a deployed
 * token-exchange Worker (see docs/oauth-worker.md) and the registered OAuth
 * app's Client ID. Both are read from build-time env; with either missing the
 * app offers only PAT mode.
 */
export interface OAuthConfig {
  /** Deployed token-exchange Worker URL. */
  workerUrl: string;
  /** The registered GitHub OAuth app's Client ID. */
  clientId: string;
}

export function oauthConfig(): OAuthConfig | null {
  const workerUrl = (
    import.meta.env.VITE_BEACHFRONT_OAUTH_WORKER_URL as string | undefined
  )?.trim();
  const clientId = (
    import.meta.env.VITE_BEACHFRONT_OAUTH_CLIENT_ID as string | undefined
  )?.trim();
  if (!workerUrl || !clientId) return null;
  return { workerUrl, clientId };
}
