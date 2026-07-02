import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  IssueWriteError,
  fetchRepoCapability,
  postIssueComment,
  setIssueStateRole,
} from "./editIssue.ts";
import { defaultTriageMapping } from "../triage/mapping.ts";

const reposGet = vi.fn();
const addLabels = vi.fn();
const removeLabel = vi.fn();
const createComment = vi.fn();

vi.mock("octokit", () => ({
  Octokit: vi.fn().mockImplementation(() => ({
    rest: {
      repos: { get: reposGet },
      issues: { addLabels, removeLabel, createComment },
    },
  })),
}));

const REPO = { owner: "acme", repo: "gadgets" };
const mapping = defaultTriageMapping();

// Clear call history (but not the Octokit constructor mock, which
// vi.restoreAllMocks would) between tests so the "not called" assertions are
// scoped to a single test.
beforeEach(() => vi.clearAllMocks());

describe("setIssueStateRole", () => {
  it("removes the current state-role label and adds the target", async () => {
    addLabels.mockResolvedValue({});
    removeLabel.mockResolvedValue({});

    const next = await setIssueStateRole(
      "tok",
      REPO,
      7,
      ["enhancement", "needs-triage"],
      mapping,
      "ready-for-agent",
    );

    expect(removeLabel).toHaveBeenCalledWith(
      expect.objectContaining({ issue_number: 7, name: "needs-triage" }),
    );
    expect(addLabels).toHaveBeenCalledWith(
      expect.objectContaining({ issue_number: 7, labels: ["ready-for-agent"] }),
    );
    // Category label is left untouched; the state role is swapped.
    expect(next).toEqual(["enhancement", "ready-for-agent"]);
  });

  it("is a no-op add when the issue already carries the target role", async () => {
    const next = await setIssueStateRole(
      "tok",
      REPO,
      7,
      ["enhancement", "ready-for-agent"],
      mapping,
      "ready-for-agent",
    );

    expect(addLabels).not.toHaveBeenCalled();
    expect(removeLabel).not.toHaveBeenCalled();
    expect(next).toEqual(["enhancement", "ready-for-agent"]);
  });

  it("falls back to the default Mapping when the repo ships none", async () => {
    addLabels.mockResolvedValue({});
    removeLabel.mockResolvedValue({});

    const next = await setIssueStateRole(
      "tok",
      REPO,
      7,
      ["needs-triage"],
      null,
      "ready-for-agent",
    );

    expect(removeLabel).toHaveBeenCalledWith(
      expect.objectContaining({ name: "needs-triage" }),
    );
    expect(addLabels).toHaveBeenCalledWith(
      expect.objectContaining({ labels: ["ready-for-agent"] }),
    );
    expect(next).toEqual(["ready-for-agent"]);
  });

  it("maps a 403 to a clear write-scope error", async () => {
    removeLabel.mockRejectedValue({ status: 403 });

    await expect(
      setIssueStateRole("ro", REPO, 7, ["needs-triage"], mapping, "wontfix"),
    ).rejects.toBeInstanceOf(IssueWriteError);
  });
});

describe("postIssueComment", () => {
  it("posts the comment and returns its URL", async () => {
    createComment.mockResolvedValue({
      data: { html_url: "https://github.com/acme/gadgets/issues/7#issuecomment-1" },
    });

    const url = await postIssueComment("tok", REPO, 7, "Looking into this.");

    expect(createComment).toHaveBeenCalledWith(
      expect.objectContaining({ issue_number: 7, body: "Looking into this." }),
    );
    expect(url).toBe(
      "https://github.com/acme/gadgets/issues/7#issuecomment-1",
    );
  });

  it("maps a 401 to a clear write-scope error", async () => {
    createComment.mockRejectedValue({ status: 401 });

    await expect(
      postIssueComment("ro", REPO, 7, "hi"),
    ).rejects.toBeInstanceOf(IssueWriteError);
  });
});

describe("fetchRepoCapability", () => {
  it("reports write capability from the repo's push permission", async () => {
    reposGet.mockResolvedValue({ data: { permissions: { push: true } } });
    expect(await fetchRepoCapability("tok", REPO)).toBe(true);
  });

  it("reports read-only when push permission is absent", async () => {
    reposGet.mockResolvedValue({ data: { permissions: { push: false } } });
    expect(await fetchRepoCapability("ro", REPO)).toBe(false);

    reposGet.mockResolvedValue({ data: {} });
    expect(await fetchRepoCapability("ro", REPO)).toBe(false);
  });
});
