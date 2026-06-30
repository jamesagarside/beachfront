import { describe, expect, it, vi } from "vitest";
import { type OAuthEnv, handleRequest } from "./oauthWorker";

const ENV: OAuthEnv = {
  GITHUB_CLIENT_ID: "client-123",
  GITHUB_CLIENT_SECRET: "secret-abc",
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

function post(body: unknown): Request {
  return new Request("https://worker.example/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("oauth worker token exchange", () => {
  it("answers CORS preflight without calling GitHub", async () => {
    const fetch = fakeFetch({});
    const res = await handleRequest(
      new Request("https://worker.example/", { method: "OPTIONS" }),
      ENV,
      { fetch },
    );
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects non-POST methods", async () => {
    const fetch = fakeFetch({});
    const res = await handleRequest(
      new Request("https://worker.example/", { method: "GET" }),
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
    const res = await handleRequest(post({ code: "abc" }), {}, { fetch });
    expect(res.status).toBe(500);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("exchanges the code for a token using the client secret", async () => {
    const fetch = fakeFetch({
      access_token: "gho_token",
      token_type: "bearer",
      scope: "repo",
    });
    const res = await handleRequest(
      post({ code: "the-code", redirect_uri: "https://app.example/cb" }),
      ENV,
      { fetch },
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.access_token).toBe("gho_token");
    expect(json.scope).toBe("repo");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");

    // It posted to GitHub's token endpoint with the secret + code (and redirect).
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, opts] = fetch.mock.calls[0];
    expect(url).toBe("https://github.com/login/oauth/access_token");
    const sent = JSON.parse((opts as RequestInit).body as string);
    expect(sent).toMatchObject({
      client_id: "client-123",
      client_secret: "secret-abc",
      code: "the-code",
      redirect_uri: "https://app.example/cb",
    });
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
