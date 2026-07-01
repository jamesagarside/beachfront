import { afterEach, vi } from "vitest";
import { fetchViewer } from "./identity.ts";

function mockFetch(response: {
  ok?: boolean;
  status?: number;
  headers?: Record<string, string>;
  json?: () => unknown;
}) {
  return vi.fn().mockResolvedValue({
    ok: response.ok ?? true,
    status: response.status ?? 200,
    headers: new Headers(response.headers ?? {}),
    json: () => Promise.resolve(response.json ? response.json() : {}),
  } as unknown as Response);
}

describe("fetchViewer", () => {
  afterEach(() => vi.restoreAllMocks());

  it("sends the token as a Bearer credential", async () => {
    const fetchSpy = mockFetch({
      json: () => ({ login: "octocat", avatar_url: "a.png", name: "Octo" }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    await fetchViewer("github_pat_xyz");

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.github.com/user",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer github_pat_xyz",
        }),
      }),
    );
  });

  it("maps the API response to a Viewer", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch({
        json: () => ({ login: "octocat", avatar_url: "a.png", name: "Octo" }),
      }),
    );

    await expect(fetchViewer("t")).resolves.toEqual({
      login: "octocat",
      avatarUrl: "a.png",
      name: "Octo",
    });
  });

  it("throws a clear message when the token is rejected", async () => {
    vi.stubGlobal("fetch", mockFetch({ ok: false, status: 401 }));
    await expect(fetchViewer("bad")).rejects.toThrow(/rejected/i);
  });

  it("reports a spent rate limit as rate limiting, not a bad token", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch({
        ok: false,
        status: 403,
        headers: { "x-ratelimit-remaining": "0" },
      }),
    );
    await expect(fetchViewer("t")).rejects.toThrow(/rate-limiting/i);
  });

  it("keeps a 403 with quota remaining on the token-rejected path", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch({
        ok: false,
        status: 403,
        headers: { "x-ratelimit-remaining": "42" },
      }),
    );
    await expect(fetchViewer("t")).rejects.toThrow(/rejected/i);
  });
});
