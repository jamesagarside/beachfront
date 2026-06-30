import { ghDataSource, type RunCommand } from "./ghDataSource.ts";
import type { RepoRef } from "../config.ts";

const REPO: RepoRef = { owner: "octo", repo: "widgets" };

/** A `run` stub that dispatches on the gh subcommand and records every call. */
function stubRun(
  handlers: Partial<{
    issue: string;
    runList: string;
    content: string;
  }>,
): { run: RunCommand; calls: string[][] } {
  const calls: string[][] = [];
  const run: RunCommand = (command, args) => {
    calls.push([command, ...args]);
    if (args[0] === "issue") {
      if (handlers.issue === undefined) throw new Error("no issues");
      return handlers.issue;
    }
    if (args[0] === "run") {
      if (handlers.runList === undefined) throw new Error("no runs");
      return handlers.runList;
    }
    if (args[0] === "api") {
      if (handlers.content === undefined) throw new Error("404");
      return handlers.content;
    }
    throw new Error(`unexpected gh ${args.join(" ")}`);
  };
  return { run, calls };
}

/** GitHub returns `comments` from `gh issue list` as an array, not a count. */
const ISSUES_JSON = JSON.stringify([
  {
    number: 7,
    title: "Wire the deck",
    url: "https://github.com/octo/widgets/issues/7",
    createdAt: "2026-06-01T00:00:00Z",
    labels: [
      { id: "1", name: "enhancement", color: "0B4F6C" },
      { id: "2", name: "ready-for-agent", color: "1B998B" },
    ],
    comments: [{ id: 1 }, { id: 2 }],
  },
]);

describe("ghDataSource", () => {
  it("lists the repos it was given (the local Registry)", async () => {
    const { run } = stubRun({});
    const source = ghDataSource(run, [REPO]);
    expect(await source.listRepos()).toEqual([REPO]);
  });

  it("parses open issues from `gh issue list`, counting comments", async () => {
    const { run, calls } = stubRun({ issue: ISSUES_JSON });
    const source = ghDataSource(run, [REPO]);

    const issues = await source.fetchOpenIssues(REPO);

    expect(issues).toEqual([
      {
        number: 7,
        title: "Wire the deck",
        url: "https://github.com/octo/widgets/issues/7",
        createdAt: "2026-06-01T00:00:00Z",
        labels: [
          { name: "enhancement", color: "0B4F6C" },
          { name: "ready-for-agent", color: "1B998B" },
        ],
        comments: 2,
      },
    ]);
    // Scopes the read to the repo, open-only, as the local gh login.
    const issueCall = calls.find((c) => c[1] === "issue")!;
    expect(issueCall).toContain("-R");
    expect(issueCall).toContain("octo/widgets");
    expect(issueCall).toContain("--state");
    expect(issueCall).toContain("open");
  });

  it("rejects fetchOpenIssues when gh can't read the repo (→ skipped)", async () => {
    const { run } = stubRun({}); // issue handler throws
    const source = ghDataSource(run, [REPO]);
    await expect(source.fetchOpenIssues(REPO)).rejects.toThrow();
  });

  it("parses Agent runs from `gh run list`, collapsing status", async () => {
    const runList = JSON.stringify([
      {
        databaseId: 42,
        name: "CI",
        status: "completed",
        conclusion: "success",
        url: "https://github.com/octo/widgets/actions/runs/42",
        headBranch: "main",
        createdAt: "2026-06-02T00:00:00Z",
      },
      {
        databaseId: 43,
        name: "sandcastle",
        status: "in_progress",
        conclusion: null,
        url: "https://github.com/octo/widgets/actions/runs/43",
        headBranch: "work",
        createdAt: "2026-06-03T00:00:00Z",
      },
    ]);
    const { run } = stubRun({ runList });
    const source = ghDataSource(run, [REPO]);

    const runs = await source.fetchAgentRuns(REPO);

    expect(runs).toEqual([
      {
        id: 42,
        name: "CI",
        status: "succeeded",
        url: "https://github.com/octo/widgets/actions/runs/42",
        branch: "main",
        createdAt: "2026-06-02T00:00:00Z",
      },
      {
        id: 43,
        name: "sandcastle",
        status: "running",
        url: "https://github.com/octo/widgets/actions/runs/43",
        branch: "work",
        createdAt: "2026-06-03T00:00:00Z",
      },
    ]);
  });

  it("decodes the base64 triage Mapping from `gh api` contents", async () => {
    const markdown = [
      "| state role | label |",
      "| --- | --- |",
      "| ready-for-agent | fed |",
    ].join("\n");
    const content = btoa(markdown);
    const { run } = stubRun({ content });
    const source = ghDataSource(run, [REPO]);

    const mapping = await source.fetchTriageMapping(REPO);

    expect(mapping?.labelForRole["ready-for-agent"]).toBe("fed");
    expect(mapping?.roleForLabel.get("fed")).toBe("ready-for-agent");
  });

  it("degrades to null when the repo ships no triage Mapping (404)", async () => {
    const { run } = stubRun({}); // api handler throws
    const source = ghDataSource(run, [REPO]);
    expect(await source.fetchTriageMapping(REPO)).toBeNull();
  });
});
