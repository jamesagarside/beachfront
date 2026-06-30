import {
  CREATE_ISSUES_TOOL_NAME,
  type IssueDraft,
  runCreateIssuesTool,
} from "./authorIssues.ts";
import type { RunCommand } from "./ghDataSource.ts";
import type { RepoRef } from "../config.ts";

const REPO: RepoRef = { owner: "octo", repo: "widgets" };

const DRAFTS: IssueDraft[] = [
  { title: "Wire the deck", body: "## What to build\nThe deck.", labels: ["enhancement"] },
  { title: "Add a test", body: "Cover it." },
];

/** A `run` stub that records calls and returns a queued URL per `issue create`. */
function stubRun(urls: string[]): { run: RunCommand; calls: string[][] } {
  const calls: string[][] = [];
  const queue = [...urls];
  const run: RunCommand = (command, args) => {
    calls.push([command, ...args]);
    if (args[0] === "issue" && args[1] === "create") {
      const url = queue.shift();
      if (url === undefined) throw new Error("gh create failed");
      return `${url}\n`;
    }
    throw new Error(`unexpected gh ${args.join(" ")}`);
  };
  return { run, calls };
}

describe("runCreateIssuesTool", () => {
  it("has a stable tool name", () => {
    expect(CREATE_ISSUES_TOOL_NAME).toBe("beachfront_create_issues");
  });

  it("drafts a preview and writes nothing without confirm", async () => {
    const { run, calls } = stubRun([]);

    const result = await runCreateIssuesTool(run, REPO, DRAFTS, false);

    expect(calls).toEqual([]); // no gh invocation at all
    expect(result.structuredContent.created).toBe(false);
    expect(result.structuredContent.drafts).toHaveLength(2);
    const text = result.content[0].text;
    expect(text).toContain("octo/widgets");
    expect(text).toContain("Wire the deck");
    expect(text).toContain("Add a test");
    expect(text.toLowerCase()).toContain("confirm");
  });

  it("creates all drafts on a single confirm, via gh", async () => {
    const { run, calls } = stubRun([
      "https://github.com/octo/widgets/issues/12",
      "https://github.com/octo/widgets/issues/13",
    ]);

    const result = await runCreateIssuesTool(run, REPO, DRAFTS, true);

    // One create per draft, scoped to the repo with title/body/label flags.
    const creates = calls.filter((c) => c[1] === "issue" && c[2] === "create");
    expect(creates).toHaveLength(2);
    expect(creates[0]).toContain("-R");
    expect(creates[0]).toContain("octo/widgets");
    expect(creates[0]).toContain("--title");
    expect(creates[0]).toContain("Wire the deck");
    expect(creates[0]).toContain("--label");
    expect(creates[0]).toContain("enhancement");
    // Second draft has no labels → no --label flag.
    expect(creates[1]).not.toContain("--label");

    expect(result.structuredContent.created).toBe(true);
    expect(result.structuredContent.issues).toEqual([
      { title: "Wire the deck", url: "https://github.com/octo/widgets/issues/12" },
      { title: "Add a test", url: "https://github.com/octo/widgets/issues/13" },
    ]);
    expect(result.content[0].text).toContain(
      "https://github.com/octo/widgets/issues/12",
    );
  });

  it("reports partial failure without aborting the batch", async () => {
    // Only one URL queued → the second create throws.
    const { run } = stubRun(["https://github.com/octo/widgets/issues/12"]);

    const result = await runCreateIssuesTool(run, REPO, DRAFTS, true);

    expect(result.structuredContent.issues).toHaveLength(1);
    expect(result.content[0].text.toLowerCase()).toContain("failed");
    expect(result.content[0].text).toContain("Add a test");
  });

  it("does nothing for an empty draft list", async () => {
    const { run, calls } = stubRun([]);
    const result = await runCreateIssuesTool(run, REPO, [], true);
    expect(calls).toEqual([]);
    expect(result.structuredContent.created).toBe(false);
  });
});
