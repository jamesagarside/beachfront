import type { RunCommand } from "./ghDataSource.ts";
import {
  AUTHOR_TOOL_NAME,
  authorToolConfig,
  runAuthorIssues,
} from "./authorTools.ts";

const REPO = "octo/alpha";

/** A `run` stub that returns a created-issue URL and records every call. */
function stubRun(): { run: RunCommand; calls: string[][] } {
  const calls: string[][] = [];
  let n = 100;
  const run: RunCommand = (command, args) => {
    calls.push([command, ...args]);
    return `https://github.com/octo/alpha/issues/${n++}\n`;
  };
  return { run, calls };
}

const DRAFTS = [
  { title: "Scaffold the deck", body: "Build the per-repo view." },
  { title: "Wire the board", body: "Bucket issues by role.", labels: ["enhancement"] },
];

describe("the author-issues tool", () => {
  it("is named and described for any MCP host", () => {
    expect(AUTHOR_TOOL_NAME).toBe("beachfront_author_issues");
    expect(authorToolConfig.title).toBeTruthy();
    expect(authorToolConfig.description).toMatch(/confirm/i);
  });

  it("previews the drafts and writes nothing without confirm", () => {
    const { run, calls } = stubRun();

    const result = runAuthorIssues(run, { repo: REPO, issues: DRAFTS });

    expect(calls).toEqual([]); // the single checkpoint — no writes yet.
    expect(result.structuredContent.created).toBe(false);
    expect(result.structuredContent.drafts).toEqual(DRAFTS);
    expect(result.structuredContent.issues).toEqual([]);
    expect(result.content[0].text).toContain("Scaffold the deck");
    expect(result.content[0].text.toLowerCase()).toContain("confirm");
  });

  it("creates every draft via `gh` on a single confirm", () => {
    const { run, calls } = stubRun();

    const result = runAuthorIssues(run, {
      repo: REPO,
      issues: DRAFTS,
      confirm: true,
    });

    // One `gh issue create` per draft, against the chosen repo.
    expect(calls).toHaveLength(2);
    expect(calls[0]).toEqual([
      "gh",
      "issue",
      "create",
      "-R",
      REPO,
      "--title",
      "Scaffold the deck",
      "--body",
      "Build the per-repo view.",
    ]);
    // The second draft's label is passed through to creation.
    expect(calls[1]).toContain("--label");
    expect(calls[1]).toContain("enhancement");

    expect(result.structuredContent.created).toBe(true);
    expect(result.structuredContent.issues).toEqual([
      { title: "Scaffold the deck", url: "https://github.com/octo/alpha/issues/100" },
      { title: "Wire the board", url: "https://github.com/octo/alpha/issues/101" },
    ]);
    expect(result.content[0].text).toContain("Created 2 issues");
  });

  it("handles an empty breakdown without writing", () => {
    const { run, calls } = stubRun();
    const result = runAuthorIssues(run, { repo: REPO, issues: [], confirm: true });
    expect(calls).toEqual([]);
    expect(result.structuredContent.created).toBe(false);
  });

  it("rejects a malformed repo slug", () => {
    const { run } = stubRun();
    expect(() => runAuthorIssues(run, { repo: "nope", issues: DRAFTS })).toThrow();
  });
});
