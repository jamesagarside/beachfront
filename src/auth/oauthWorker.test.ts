import { describe, expect, it, vi } from "vitest";
import { type OAuthEnv, handleRequest } from "./oauthWorker";

const ORIGIN = "https://app.example";
const ENV: OAuthEnv = {
  GITHUB_CLIENT_ID: "client-123",
  GITHUB_CLIENT_SECRET: "secret-abc",
  ALLOWED_ORIGINS: ORIGIN,
  REDIRECT_URI: "https://app.example/callback",
};

/** A fetch double that records calls and returns a canned GitHub response. */
function fakeFetch(
  payload: unknown,
  init: { ok?: boolean; status?: number } = {},
) {
  const fetch = vi.fn(async () =>
    new Response(JSON.stringify(payload), {
      status: init.status ?? (init.ok === false ? 400 : 200),
      headers: { "Content-Type": "application/json" },
    }),
  );
  return fetch as unknown as typeof globalThis.fetch & ReturnType<typeof vi.fn>;
}

function post(body: unknown, origin: string | null = ORIGIN): Request {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (origin) headers.Origin = origin;
  return new Request("https://worker.example/", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

function options(origin: string | null): Request {
  const headers: Record<string, string> = {};
  if (origin) headers.Origin = origin;
  return new Request("https://worker.example/", { method: "OPTIONS", headers });
}

describe("oauth worker token exchange", () => {
  it("grants CORS to an allowlisted origin on preflight, without calling GitHub", async () => {
    const fetch = fakeFetch({});
    const res = await handleRequest(options(ORIGIN), ENV, { fetch });
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
    expect(res.headers.get("Vary")).toBe("Origin");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("gives a non-allowlisted origin no CORS grant on preflight", async () => {
    const fetch = fakeFetch({});
    const res = await handleRequest(options("https://evil.example"), ENV, {
      fetch,
    });
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("never reflects a wildcard origin", async () => {
    const fetch = fakeFetch({ access_token: "gho_token" });
    const res = await handleRequest(post({ code: "abc" }), ENV, { fetch });
    expect(res.headers.get("Access-Control-Allow-Origin")).not.toBe("*");
  });

  it("refuses to exchange for a non-allowlisted origin", async () => {
    const fetch = fakeFetch({ access_token: "gho_token" });
    const res = await handleRequest(
      post({ code: "abc" }, "https://evil.example"),
      ENV,
      { fetch },
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("forbidden_origin");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("refuses to exchange when the request carries no Origin", async () => {
    const fetch = fakeFetch({ access_token: "gho_token" });
    const res = await handleRequest(post({ code: "abc" }, null), ENV, { fetch });
    expect(res.status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects non-POST methods", async () => {
    const fetch = fakeFetch({});
    const res = await handleRequest(
      new Request("https://worker.example/", {
        method: "GET",
        headers: { Origin: ORIGIN },
      }),
      ENV,
      { fetch },
    );
    expect(res.status).toBe(405);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns 400 when no code is supplied", async () => {
    const fetch = fakeFetch({});
    const res = await handleRequest(post({}), ENV, { fetch });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_request");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns 500 when the client secret is not configured", async () => {
    const fetch = fakeFetch({});
    const res = await handleRequest(
      post({ code: "abc" }),
      { ALLOWED_ORIGINS: ORIGIN, REDIRECT_URI: "https://app.example/callback" },
      { fetch },
    );
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("server_misconfigured");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns 500 when no origin allowlist is configured", async () => {
    const fetch = fakeFetch({});
    const res = await handleRequest(
      post({ code: "abc" }),
      {
        GITHUB_CLIENT_ID: "client-123",
        GITHUB_CLIENT_SECRET: "secret-abc",
        REDIRECT_URI: "https://app.example/callback",
      },
      { fetch },
    );
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("server_misconfigured");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("exchanges the code for a token, pinning redirect_uri to the configured value", async () => {
    const fetch = fakeFetch({
      access_token: "gho_token",
      token_type: "bearer",
      scope: "repo",
    });
    const res = await handleRequest(
      // Caller supplies a hostile redirect_uri — it must be ignored.
      post({ code: "the-code", redirect_uri: "https://evil.example/steal" }),
      ENV,
      { fetch },
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.access_token).toBe("gho_token");
    expect(json.scope).toBe("repo");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, opts] = fetch.mock.calls[0];
    expect(url).toBe("https://github.com/login/oauth/access_token");
    const sent = JSON.parse((opts as RequestInit).body as string);
    expect(sent).toMatchObject({
      client_id: "client-123",
      client_secret: "secret-abc",
      code: "the-code",
      redirect_uri: "https://app.example/callback",
    });
    // The caller-supplied redirect_uri is never forwarded.
    expect(sent.redirect_uri).not.toBe("https://evil.example/steal");
  });

  it("omits redirect_uri when none is configured", async () => {
    const fetch = fakeFetch({ access_token: "gho_token" });
    const res = await handleRequest(
      post({ code: "the-code", redirect_uri: "https://evil.example/steal" }),
      { ...ENV, REDIRECT_URI: undefined },
      { fetch },
    );
    expect(res.status).toBe(200);
    const sent = JSON.parse(
      (fetch.mock.calls[0][1] as RequestInit).body as string,
    );
    expect(sent.redirect_uri).toBeUndefined();
  });

  it("accepts multiple allowlisted origins", async () => {
    const fetch = fakeFetch({ access_token: "gho_token" });
    const env: OAuthEnv = {
      ...ENV,
      ALLOWED_ORIGINS: "https://a.example, https://b.example",
    };
    const res = await handleRequest(
      post({ code: "abc" }, "https://b.example"),
      env,
      { fetch },
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://b.example",
    );
  });

  it("surfaces a GitHub exchange error without a token", async () => {
    const fetch = fakeFetch(
      {
        error: "bad_verification_code",
        error_description: "The code passed is incorrect or expired.",
      },
      { status: 200 },
    );
    const res = await handleRequest(post({ code: "stale" }), ENV, { fetch });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("bad_verification_code");
    expect(json.access_token).toBeUndefined();
  });
});
