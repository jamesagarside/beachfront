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
 * Security posture — this endpoint holds the app's `client_secret`, so it must
 * not be a public exchange oracle:
 *   - CORS is reflected only for an explicit allowlist of Instance origins
 *     (ALLOWED_ORIGINS), never `*`, and a request from any other origin gets no
 *     token exchange at all.
 *   - `redirect_uri` is pinned to the configured Instance callback (REDIRECT_URI);
 *     a caller-supplied value is ignored, closing the login-CSRF redirect vector.
 *
 * The `state` parameter that completes CSRF protection is the client's
 * responsibility (generate + store before redirect, verify on callback); see
 * docs/oauth-worker.md.
 *
 * Deploy/setup: see docs/oauth-worker.md.
 */

/** Worker environment — the registered OAuth app's credentials + Instance pins. */
export interface OAuthEnv {
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  /**
   * Comma/whitespace-separated allowlist of Instance origins permitted to use
   * this Worker (e.g. "https://my-instance.example"). No entry ⇒ no origin is
   * served; the Worker fails closed. Set as a plain Worker var.
   */
  ALLOWED_ORIGINS?: string;
  /**
   * The single `redirect_uri` sent to GitHub, pinned to the Instance callback.
   * Any caller-supplied `redirect_uri` is ignored. Omit only if your OAuth app
   * registers no callback URL.
   */
  REDIRECT_URI?: string;
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

/** Parse the configured allowlist into a set of exact-match origins. */
function allowedOrigins(env: OAuthEnv): string[] {
  return (env.ALLOWED_ORIGINS ?? "")
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * CORS headers for a given request origin. The `Access-Control-Allow-Origin`
 * header is set only when the origin is explicitly allowlisted — never `*` —
 * so a browser on any other origin cannot read the response.
 */
function corsHeaders(origin: string | null, allowed: string[]): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
  if (origin && allowed.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

function json(payload: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}

/**
 * Handle one request to the Worker: a CORS preflight, or a POST carrying the
 * auth `code` to exchange for an access token. The exchange is served only to
 * allowlisted Instance origins and always uses the pinned `redirect_uri`.
 */
export async function handleRequest(
  request: Request,
  env: OAuthEnv,
  deps: ExchangeDeps = { fetch: (...args) => globalThis.fetch(...args) },
): Promise<Response> {
  const origin = request.headers.get("Origin");
  const allowed = allowedOrigins(env);
  const cors = corsHeaders(origin, allowed);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }
  if (request.method !== "POST") {
    return json(
      { error: "method_not_allowed", error_description: "Use POST." },
      405,
      cors,
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
      cors,
    );
  }
  if (allowed.length === 0) {
    return json(
      {
        error: "server_misconfigured",
        error_description:
          "ALLOWED_ORIGINS is not set — no Instance origin is permitted to use this Worker.",
      },
      500,
      cors,
    );
  }

  // Fail closed: only an allowlisted origin may perform an exchange at all.
  if (!origin || !allowed.includes(origin)) {
    return json(
      {
        error: "forbidden_origin",
        error_description: "This origin is not permitted to use this Worker.",
      },
      403,
      cors,
    );
  }

  let body: { code?: string };
  try {
    body = await request.json();
  } catch {
    return json(
      { error: "invalid_request", error_description: "Body must be JSON." },
      400,
      cors,
    );
  }

  const code = body?.code;
  if (!code) {
    return json(
      { error: "invalid_request", error_description: "Missing 'code'." },
      400,
      cors,
    );
  }

  const upstream = await deps.fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      // Pinned to the Instance callback; any caller-supplied redirect is ignored.
      ...(env.REDIRECT_URI ? { redirect_uri: env.REDIRECT_URI } : {}),
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
      cors,
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
      cors,
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
    cors,
  );
}

export default {
  fetch(request: Request, env: OAuthEnv): Promise<Response> {
    return handleRequest(request, env);
  },
};
