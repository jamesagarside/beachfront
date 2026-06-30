import {
  runSetTriageRoleTool,
  SET_TRIAGE_ROLE_TOOL_NAME,
} from "./triageRole.ts";
import type { RunCommand } from "./ghDataSource.ts";
import type { EstateDataSource } from "../core/dataSource.ts";
import type { RepoRef } from "../config.ts";
import {
  defaultTriageMapping,
  parseTriageLabels,
  type TriageMapping,
} from "../triage/mapping.ts";

const REPO: RepoRef = { owner: "octo", repo: "widgets" };

/** A `run` stub: `issue view` returns the issue's labels, `issue edit` records. */
function stubRun(currentLabels: string[]): {
  run: RunCommand;
  calls: string[][];
} {
  const calls: string[][] = [];
  const run: RunCommand = (command, args) => {
    calls.push([command, ...args]);
    if (args[0] === "issue" && args[1] === "view") {
      return JSON.stringify({
        labels: currentLabels.map((name) => ({ name })),
      });
    }
    if (args[0] === "issue" && args[1] === "edit") {
      return "";
    }
    throw new Error(`unexpected gh ${args.join(" ")}`);
  };
  return { run, calls };
}

/** A source whose triage Mapping is fixed; the other reads are unused here. */
function sourceWithMapping(mapping: TriageMapping | null): EstateDataSource {
  return {
    listRepos: () => Promise.resolve([REPO]),
    fetchOpenIssues: () => Promise.reject(new Error("unused")),
    fetchTriageMapping: () => Promise.resolve(mapping),
    fetchAgentRuns: () => Promise.resolve([]),
  };
}

describe("runSetTriageRoleTool", () => {
  it("has a stable tool name", () => {
    expect(SET_TRIAGE_ROLE_TOOL_NAME).toBe("beachfront_set_triage_role");
  });

  it("adds the mapped label and removes the prior state-role label", async () => {
    const { run, calls } = stubRun(["enhancement", "needs-triage"]);
    const source = sourceWithMapping(defaultTriageMapping());

    const result = await runSetTriageRoleTool(
      run,
      source,
      REPO,
      7,
      "ready-for-agent",
    );

    const edit = calls.find((c) => c[1] === "issue" && c[2] === "edit")!;
    expect(edit).toContain("7");
    expect(edit).toContain("-R");
    expect(edit).toContain("octo/widgets");
    expect(edit).toContain("--add-label");
    expect(edit).toContain("ready-for-agent");
    expect(edit).toContain("--remove-label");
    expect(edit).toContain("needs-triage");
    // The category label is left untouched.
    expect(edit).not.toContain("enhancement");

    expect(result.structuredContent).toMatchObject({
      issue: 7,
      role: "ready-for-agent",
      label: "ready-for-agent",
      added: true,
      removed: ["needs-triage"],
    });
    expect(result.content[0].text).toContain("ready-for-agent");
  });

  it("uses the repo's remapped label per the Mapping (#6)", async () => {
    const mapping = parseTriageLabels(
      ["| state role | label |", "| --- | --- |", "| ready-for-agent | fed |"].join(
        "\n",
      ),
    );
    const { run, calls } = stubRun(["needs-triage"]);
    const source = sourceWithMapping(mapping);

    const result = await runSetTriageRoleTool(
      run,
      source,
      REPO,
      9,
      "ready-for-agent",
    );

    const edit = calls.find((c) => c[1] === "issue" && c[2] === "edit")!;
    expect(edit).toContain("fed");
    expect(result.structuredContent.label).toBe("fed");
  });

  it("falls back to identity labels when the repo ships no Mapping", async () => {
    const { run, calls } = stubRun(["needs-triage"]);
    const source = sourceWithMapping(null);

    await runSetTriageRoleTool(run, source, REPO, 3, "ready-for-human");

    const edit = calls.find((c) => c[1] === "issue" && c[2] === "edit")!;
    expect(edit).toContain("ready-for-human");
  });

  it("is a no-op write when the issue already holds the target role", async () => {
    const { run, calls } = stubRun(["enhancement", "ready-for-agent"]);
    const source = sourceWithMapping(defaultTriageMapping());

    const result = await runSetTriageRoleTool(
      run,
      source,
      REPO,
      7,
      "ready-for-agent",
    );

    expect(calls.some((c) => c[1] === "issue" && c[2] === "edit")).toBe(false);
    expect(result.structuredContent.added).toBe(false);
    expect(result.structuredContent.removed).toEqual([]);
    expect(result.content[0].text.toLowerCase()).toContain("already");
  });
});
