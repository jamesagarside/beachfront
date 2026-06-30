import { afterEach, describe, expect, it, vi } from "vitest";
import { buildAuthorizeUrl, exchangeCode, parseCallback } from "./oauthLogin.ts";

const config = { workerUrl: "https://worker.example/", clientId: "Iv1.abc" };

describe("buildAuthorizeUrl", () => {
  it("targets GitHub's authorize endpoint with client id, redirect, state and scope", () => {
    const url = new URL(buildAuthorizeUrl(config, "https://app.example/", "st-1"));
    expect(url.origin + url.pathname).toBe(
      "https://github.com/login/oauth/authorize",
    );
    expect(url.searchParams.get("client_id")).toBe("Iv1.abc");
    expect(url.searchParams.get("redirect_uri")).toBe("https://app.example/");
    expect(url.searchParams.get("state")).toBe("st-1");
    expect(url.searchParams.get("scope")).toBe("repo");
  });
});

describe("parseCallback", () => {
  it("extracts code and state from the query string", () => {
    expect(parseCallback("?code=abc&state=xyz")).toEqual({
      code: "abc",
      state: "xyz",
    });
  });

  it("returns null when there is no code", () => {
    expect(parseCallback("?state=xyz")).toBeNull();
    expect(parseCallback("")).toBeNull();
  });
});

describe("exchangeCode", () => {
  afterEach(() => vi.restoreAllMocks());

  it("POSTs the code to the Worker and returns the access token", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => ({ access_token: "gho_tok", scope: "repo" }),
    });

    const token = await exchangeCode(
      config.workerUrl,
      "the-code",
      "https://app.example/",
      { fetch: fetchMock },
    );

    expect(token).toBe("gho_tok");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://worker.example/");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toMatchObject({
      code: "the-code",
      redirect_uri: "https://app.example/",
    });
  });

  it("throws with the Worker's error description on failure", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: () => ({
        error: "bad_verification_code",
        error_description: "Code expired.",
      }),
    });

    await expect(
      exchangeCode(config.workerUrl, "x", "https://app.example/", {
        fetch: fetchMock,
      }),
    ).rejects.toThrow(/code expired/i);
  });

  it("throws a friendly error when the Worker is unreachable", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));
    await expect(
      exchangeCode(config.workerUrl, "x", "https://app.example/", {
        fetch: fetchMock,
      }),
    ).rejects.toThrow(/could not reach/i);
  });
});
