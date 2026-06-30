import type { RepoRef } from "../config.ts";
import { defaultTriageMapping, parseTriageLabels } from "../triage/mapping.ts";
import type { RunCommand } from "./ghDataSource.ts";
import {
  SET_ROLE_TOOL_NAME,
  setRoleToolConfig,
  runSetTriageRole,
  type SetTriageRoleDeps,
} from "./triageTool.ts";

const REPO = "octo/alpha";

/**
 * A `run` stub: `gh issue view` returns the given current labels, `gh issue
 * edit` records its call. Returns the recorded calls for assertion.
 */
function stubRun(current: string[]): { run: RunCommand; calls: string[][] } {
  const calls: string[][] = [];
  const run: RunCommand = (command, args) => {
    calls.push([command, ...args]);
    if (args[0] === "issue" && args[1] === "view") {
      return JSON.stringify({ labels: current.map((name) => ({ name })) });
    }
    return ""; // `gh issue edit` prints nothing we use.
  };
  return { run, calls };
}

function deps(
  run: RunCommand,
  mapping = defaultTriageMapping(),
): SetTriageRoleDeps {
  return { run, fetchTriageMapping: (_repo: RepoRef) => Promise.resolve(mapping) };
}

describe("the set-triage-role tool", () => {
  it("is named and described for any MCP host", () => {
    expect(SET_ROLE_TOOL_NAME).toBe("beachfront_set_triage_role");
    expect(setRoleToolConfig.title).toBeTruthy();
    expect(setRoleToolConfig.description).toMatch(/triage role/i);
  });

  it("writes the mapped label and drops the prior state label", async () => {
    const { run, calls } = stubRun(["needs-triage", "enhancement"]);

    const result = await runSetTriageRole(deps(run), {
      repo: REPO,
      issue: 5,
      role: "ready-for-agent",
    });

    const edit = calls.find((c) => c[1] === "issue" && c[2] === "edit");
    expect(edit).toEqual([
      "gh",
      "issue",
      "edit",
      "5",
      "-R",
      REPO,
      "--add-label",
      "ready-for-agent",
      "--remove-label",
      "needs-triage",
    ]);
    expect(result.structuredContent).toMatchObject({
      label: "ready-for-agent",
      removed: ["needs-triage"],
      unchanged: false,
    });
    // The category label is untouched — only the same-kind sibling is replaced.
    expect(edit).not.toContain("enhancement");
  });

  it("uses the repo's remapped label string (per #6)", async () => {
    const mapping = parseTriageLabels(
      "| role | label |\n| ready-for-agent | 🤖 agent |\n",
    );
    const { run, calls } = stubRun([]);

    const result = await runSetTriageRole(deps(run, mapping!), {
      repo: REPO,
      issue: 9,
      role: "ready-for-agent",
    });

    expect(result.structuredContent.label).toBe("🤖 agent");
    const edit = calls.find((c) => c[2] === "edit");
    expect(edit).toContain("🤖 agent");
  });

  it("is a no-op when the issue already has the role", async () => {
    const { run, calls } = stubRun(["ready-for-agent"]);

    const result = await runSetTriageRole(deps(run), {
      repo: REPO,
      issue: 5,
      role: "ready-for-agent",
    });

    expect(calls.some((c) => c[2] === "edit")).toBe(false);
    expect(result.structuredContent.unchanged).toBe(true);
    expect(result.content[0].text.toLowerCase()).toContain("no change");
  });

  it("only removes sibling labels the issue actually carries", async () => {
    // Issue has no state label at all — nothing to remove, just add.
    const { run, calls } = stubRun(["enhancement"]);

    await runSetTriageRole(deps(run), {
      repo: REPO,
      issue: 7,
      role: "ready-for-agent",
    });

    const edit = calls.find((c) => c[2] === "edit")!;
    expect(edit).not.toContain("--remove-label");
    expect(edit).toContain("--add-label");
  });

  it("rejects an unknown role", async () => {
    const { run } = stubRun([]);
    await expect(
      runSetTriageRole(deps(run), {
        repo: REPO,
        issue: 1,
        // deliberately invalid at runtime
        role: "frobnicate" as never,
      }),
    ).rejects.toThrow();
  });
});
