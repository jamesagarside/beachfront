/**
 * OAuth token-exchange Worker (ADR-0001).
 *
 * GitHub's OAuth `code → token` exchange needs the `client_secret` and the token
 * endpoint does not support CORS, so a pure-static "Login with GitHub" is
 * impossible — it needs a tiny server-side shim. This is that shim: a stateless
 * Cloudflare Worker that the browser POSTs an auth `code` to, which exchanges it
 * for an access token using the secret it alone holds, and hands the token back.
 *
 * It is deliberately storage-free: no token or secret is ever persisted. The
 * Worker only forwards the exchange and returns the result, so it adds no data
 * model beyond ADR-0001's browser → API with Viewer identity.
 *
 * Deploy/setup: see docs/oauth-worker.md.
 */

/** Worker environment — the registered OAuth app's credentials, set as Secrets. */
export interface OAuthEnv {
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
}

/** Injectable side effects, so the exchange is testable without a network. */
export interface ExchangeDeps {
  fetch: typeof globalThis.fetch;
}

/** Shape of GitHub's token-endpoint JSON (success or error variant). */
interface GitHubTokenResponse {
  access_token?: string;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

const TOKEN_URL = "https://github.com/login/oauth/access_token";

// Permissive CORS: the response carries only a token destined for the Viewer's
// own browser, and no credentials/cookies are involved.
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

/**
 * Handle one request to the Worker: a CORS preflight, or a POST carrying the
 * auth `code` (and optional `redirect_uri`) to exchange for an access token.
 */
export async function handleRequest(
  request: Request,
  env: OAuthEnv,
  deps: ExchangeDeps = { fetch: (...args) => globalThis.fetch(...args) },
): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (request.method !== "POST") {
    return json(
      { error: "method_not_allowed", error_description: "Use POST." },
      405,
    );
  }
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
    return json(
      {
        error: "server_misconfigured",
        error_description:
          "GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET are not set on the Worker.",
      },
      500,
    );
  }

  let body: { code?: string; redirect_uri?: string };
  try {
    body = await request.json();
  } catch {
    return json(
      { error: "invalid_request", error_description: "Body must be JSON." },
      400,
    );
  }

  const code = body?.code;
  if (!code) {
    return json(
      { error: "invalid_request", error_description: "Missing 'code'." },
      400,
    );
  }

  const upstream = await deps.fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      ...(body.redirect_uri ? { redirect_uri: body.redirect_uri } : {}),
    }),
  });

  let result: GitHubTokenResponse;
  try {
    result = (await upstream.json()) as GitHubTokenResponse;
  } catch {
    return json(
      {
        error: "upstream_error",
        error_description: "GitHub returned a non-JSON response.",
      },
      502,
    );
  }

  if (!upstream.ok || result.error || !result.access_token) {
    return json(
      {
        error: result.error ?? "exchange_failed",
        error_description:
          result.error_description ?? "GitHub did not return an access token.",
      },
      400,
    );
  }

  // Hand the token straight back — nothing is stored on the Worker.
  return json(
    {
      access_token: result.access_token,
      token_type: result.token_type,
      scope: result.scope,
    },
    200,
  );
}

export default {
  fetch(request: Request, env: OAuthEnv): Promise<Response> {
    return handleRequest(request, env);
  },
};
