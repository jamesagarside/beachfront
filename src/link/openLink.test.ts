import { describe, expect, it, vi } from "vitest";
import { LinkWriteError, openLinkPr } from "./openLink.ts";

const reposGet = vi.fn();
const getRef = vi.fn();
const createRef = vi.fn();
const createOrUpdateFileContents = vi.fn();
const pullsCreate = vi.fn();

vi.mock("octokit", () => ({
  Octokit: vi.fn().mockImplementation(() => ({
    rest: {
      repos: { get: reposGet, createOrUpdateFileContents },
      git: { getRef, createRef },
      pulls: { create: pullsCreate },
    },
  })),
}));

const INSTANCE = { owner: "jamesagarside", repo: "beachfront" };
const REF = { owner: "acme", repo: "gadgets" };

function happyPath() {
  reposGet.mockResolvedValue({ data: { default_branch: "main" } });
  getRef.mockResolvedValue({ data: { object: { sha: "basesha" } } });
  createRef.mockResolvedValue({});
  createOrUpdateFileContents.mockResolvedValue({});
  pullsCreate.mockResolvedValue({
    data: { html_url: "https://github.com/jamesagarside/beachfront/pull/99" },
  });
}

function decode(base64: string): string {
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

// Each test sets its own mock implementations (which overwrite the last), so no
// reset hook is needed — and vi.restoreAllMocks() would also restore the
// Octokit constructor mock itself, breaking later tests (see issues.test.ts).
describe("openLinkPr", () => {
  it("branches from the Instance default branch and opens a PR", async () => {
    happyPath();

    const result = await openLinkPr("tok", REF, INSTANCE, {
      linkedBy: "octocat",
      linkedAt: "2026-06-29",
    });

    expect(getRef).toHaveBeenCalledWith(
      expect.objectContaining({ ref: "heads/main" }),
    );
    expect(createRef).toHaveBeenCalledWith(
      expect.objectContaining({
        ref: "refs/heads/beachfront/link-acme-gadgets",
        sha: "basesha",
      }),
    );
    expect(pullsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        base: "main",
        head: "beachfront/link-acme-gadgets",
      }),
    );
    expect(result).toEqual({
      url: "https://github.com/jamesagarside/beachfront/pull/99",
      branch: "beachfront/link-acme-gadgets",
    });
  });

  it("commits the Registry file at the canonical path with link metadata", async () => {
    happyPath();

    await openLinkPr("tok", REF, INSTANCE, {
      linkedBy: "octocat",
      linkedAt: "2026-06-29",
    });

    const call = createOrUpdateFileContents.mock.calls[0][0];
    expect(call.path).toBe("repos/acme/gadgets.json");
    expect(call.branch).toBe("beachfront/link-acme-gadgets");
    expect(JSON.parse(decode(call.content))).toEqual({
      owner: "acme",
      repo: "gadgets",
      linkedAt: "2026-06-29",
      linkedBy: "octocat",
    });
  });

  it("maps a 403 to a clear write-scope message", async () => {
    reposGet.mockResolvedValue({ data: { default_branch: "main" } });
    getRef.mockResolvedValue({ data: { object: { sha: "basesha" } } });
    createRef.mockRejectedValue({ status: 403 });

    await expect(
      openLinkPr("readonly", REF, INSTANCE, { linkedBy: "octocat" }),
    ).rejects.toBeInstanceOf(LinkWriteError);
  });

  it("flags an in-progress link when the branch already exists (422)", async () => {
    reposGet.mockResolvedValue({ data: { default_branch: "main" } });
    getRef.mockResolvedValue({ data: { object: { sha: "basesha" } } });
    createRef.mockRejectedValue({ status: 422 });

    await expect(
      openLinkPr("tok", REF, INSTANCE, { linkedBy: "octocat" }),
    ).rejects.toThrow(/already in progress/i);
  });

  it("rethrows unexpected errors unchanged", async () => {
    reposGet.mockRejectedValue(new Error("network down"));
    await expect(
      openLinkPr("tok", REF, INSTANCE, { linkedBy: "octocat" }),
    ).rejects.toThrow(/network down/);
  });
});
