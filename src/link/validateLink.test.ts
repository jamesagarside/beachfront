import { afterEach, describe, expect, it, vi } from "vitest";
import {
  findExistingLink,
  LinkValidationError,
  validateLink,
} from "./validateLink.ts";
import type { RegistryRepo } from "../registry/registry.ts";

function mockFetch(status: number) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve({}),
  } as unknown as Response);
}

const linked: RegistryRepo[] = [{ owner: "acme", repo: "widgets" }];

describe("findExistingLink", () => {
  it("matches owner/repo case-insensitively", () => {
    expect(
      findExistingLink({ owner: "ACME", repo: "Widgets" }, linked),
    ).toEqual({ owner: "acme", repo: "widgets" });
  });

  it("returns undefined for an unlinked repo", () => {
    expect(
      findExistingLink({ owner: "acme", repo: "gadgets" }, linked),
    ).toBeUndefined();
  });
});

describe("validateLink", () => {
  afterEach(() => vi.restoreAllMocks());

  it("rejects a malformed slug without calling the API", async () => {
    const fetchSpy = mockFetch(200);
    vi.stubGlobal("fetch", fetchSpy);

    await expect(validateLink("t", "not-a-slug", [])).rejects.toBeInstanceOf(
      LinkValidationError,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects an already-linked repo before any network call", async () => {
    const fetchSpy = mockFetch(200);
    vi.stubGlobal("fetch", fetchSpy);

    await expect(
      validateLink("t", "acme/widgets", linked),
    ).rejects.toThrow(/already linked/i);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects when the repo is missing or inaccessible (404)", async () => {
    vi.stubGlobal("fetch", mockFetch(404));
    await expect(validateLink("t", "acme/secret", linked)).rejects.toThrow(
      /can't access it|can't find/i,
    );
  });

  it("rejects with a token message when GitHub returns 401/403", async () => {
    vi.stubGlobal("fetch", mockFetch(403));
    await expect(validateLink("t", "acme/gadgets", linked)).rejects.toThrow(
      /rejected/i,
    );
  });

  it("resolves to the parsed ref when the token can access the repo", async () => {
    const fetchSpy = mockFetch(200);
    vi.stubGlobal("fetch", fetchSpy);

    await expect(validateLink("tok", "acme/gadgets", linked)).resolves.toEqual({
      owner: "acme",
      repo: "gadgets",
    });
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.github.com/repos/acme/gadgets",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer tok" }),
      }),
    );
  });
});
