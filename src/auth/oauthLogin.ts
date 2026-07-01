/**
 * Browser side of the "Login with GitHub" flow (ADR-0001, #25).
 *
 * The dance: send the Viewer to GitHub's authorize page; GitHub redirects back
 * with a one-time `code`; the browser POSTs that code to the token-exchange
 * Worker (which alone holds the client secret — see src/auth/oauthWorker.ts and
 * docs/oauth-worker.md), and gets an access token back. The token is then stored
 * and used exactly as a pasted PAT is.
 *
 * These helpers are pure/side-effect-injected so the flow is testable without a
 * real browser navigation or network; the imperative wiring lives in
 * useOAuthLogin.
 */
import type { OAuthConfig } from "../config.ts";

const AUTHORIZE_URL = "https://github.com/login/oauth/authorize";

/**
 * Scope requested at login. Beachfront is read-mostly, but a read-write token
 * unlocks editing and triggering (ADR-0001/0004); `repo` is the classic scope
 * granting both. Viewers wanting strictly read-only access can use PAT mode.
 */
const DEFAULT_SCOPE = "repo";

/** sessionStorage key holding the CSRF `state` between redirect and callback. */
export const STATE_KEY = "beachfront.oauth.state";

/** Build the GitHub authorize URL the Viewer is redirected to. */
export function buildAuthorizeUrl(
  config: OAuthConfig,
  redirectUri: string,
  state: string,
  scope: string = DEFAULT_SCOPE,
): string {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("scope", scope);
  return url.toString();
}

/**
 * Read the `code`/`state` GitHub appends to the callback URL. Returns null when
 * there is no `code` (i.e. this is an ordinary page load, not a callback).
 */
export function parseCallback(
  search: string,
): { code: string; state: string } | null {
  const params = new URLSearchParams(search);
  const code = params.get("code");
  if (!code) return null;
  return { code, state: params.get("state") ?? "" };
}

interface ExchangeDeps {
  fetch: typeof globalThis.fetch;
}

interface WorkerTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

/**
 * Exchange an authorization `code` for an access token via the Worker, returning
 * the token. Throws an Error carrying the Worker's description on any failure.
 */
export async function exchangeCode(
  workerUrl: string,
  code: string,
  redirectUri: string,
  deps: ExchangeDeps = { fetch: (...args) => globalThis.fetch(...args) },
): Promise<string> {
  let res: Response;
  try {
    res = await deps.fetch(workerUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, redirect_uri: redirectUri }),
    });
  } catch {
    throw new Error("Could not reach the login service. Please try again.");
  }

  let body: WorkerTokenResponse;
  try {
    body = (await res.json()) as WorkerTokenResponse;
  } catch {
    throw new Error("The login service returned an unexpected response.");
  }

  if (!res.ok || body.error || !body.access_token) {
    throw new Error(
      body.error_description ?? body.error ?? "GitHub login failed.",
    );
  }
  return body.access_token;
}
