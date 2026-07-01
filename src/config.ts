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
