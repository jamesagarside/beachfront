import { describe, expect, it, vi } from "vitest";
import { fetchTriageMapping, TRIAGE_LABELS_PATH } from "./triageMapping.ts";

const getContent = vi.fn();

vi.mock("octokit", () => ({
  Octokit: vi.fn().mockImplementation(() => ({
    rest: { repos: { getContent } },
  })),
}));

const REPO = { owner: "acme", repo: "gadgets" };

function encode(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

const CONTRACT = [
  "| role | label |",
  "| --- | --- |",
  "| enhancement | feature |",
  "| ready-for-agent | ready-for-agent |",
].join("\n");

describe("fetchTriageMapping", () => {
  it("parses the repo's triage-labels contract into a Mapping", async () => {
    getContent.mockResolvedValue({
      data: { type: "file", content: encode(CONTRACT) },
    });

    const mapping = await fetchTriageMapping("tok", REPO);

    expect(getContent).toHaveBeenCalledWith(
      expect.objectContaining({ ...REPO, path: TRIAGE_LABELS_PATH }),
    );
    // The repo remaps `enhancement` to its own `feature` label.
    expect(mapping?.labelForRole.enhancement).toBe("feature");
    expect(mapping?.roleForLabel.get("feature")).toBe("enhancement");
  });

  it("handles GitHub's line-wrapped base64 payload", async () => {
    const wrapped = encode(CONTRACT).replace(/(.{8})/g, "$1\n");
    getContent.mockResolvedValue({
      data: { type: "file", content: wrapped },
    });

    const mapping = await fetchTriageMapping("tok", REPO);
    expect(mapping?.labelForRole.enhancement).toBe("feature");
  });

  it("returns null when the repo ships no contract (404)", async () => {
    getContent.mockRejectedValue(Object.assign(new Error("nope"), { status: 404 }));
    expect(await fetchTriageMapping("tok", REPO)).toBeNull();
  });

  it("returns null when the path is a directory, not a file", async () => {
    getContent.mockResolvedValue({ data: [{ type: "dir" }] });
    expect(await fetchTriageMapping("tok", REPO)).toBeNull();
  });
});
