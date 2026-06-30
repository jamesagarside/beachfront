import { summarizeRuns, type RepoRuns } from "./runsSummary.ts";
import type { AgentRun, RunStatus } from "./runs.ts";

function run(id: number, status: RunStatus): AgentRun {
  return {
    id,
    name: `Run ${id}`,
    status,
    url: `https://github.com/o/r/actions/runs/${id}`,
    branch: null,
    createdAt: "2026-06-01T00:00:00Z",
  };
}

function repoRuns(repo: string, runs: AgentRun[]): RepoRuns {
  return { repo: { owner: "alpha", repo }, runs };
}

describe("summarizeRuns", () => {
  it("counts running, queued, and failed across every repo", () => {
    const summary = summarizeRuns([
      repoRuns("one", [run(1, "running"), run(2, "queued"), run(3, "failed")]),
      repoRuns("two", [run(4, "running"), run(5, "succeeded")]),
    ]);

    expect(summary).toEqual({ running: 2, queued: 1, failed: 1, total: 4 });
  });

  it("excludes settled succeeded runs from the total", () => {
    const summary = summarizeRuns([
      repoRuns("one", [run(1, "succeeded"), run(2, "succeeded")]),
    ]);

    expect(summary).toEqual({ running: 0, queued: 0, failed: 0, total: 0 });
  });

  it("returns all-zero for no repos", () => {
    expect(summarizeRuns([])).toEqual({
      running: 0,
      queued: 0,
      failed: 0,
      total: 0,
    });
  });
});
