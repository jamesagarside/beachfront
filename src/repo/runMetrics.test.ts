import { summarizeRunMetrics } from "./runMetrics.ts";
import type { AgentRun, RunStatus } from "../github/runs.ts";

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

describe("summarizeRunMetrics", () => {
  it("counts each status and totals the window", () => {
    const metrics = summarizeRunMetrics([
      run(1, "running"),
      run(2, "queued"),
      run(3, "succeeded"),
      run(4, "succeeded"),
      run(5, "failed"),
    ]);

    expect(metrics.running).toBe(1);
    expect(metrics.queued).toBe(1);
    expect(metrics.succeeded).toBe(2);
    expect(metrics.failed).toBe(1);
    expect(metrics.total).toBe(5);
  });

  it("computes settled count and success rate over settled runs only", () => {
    const metrics = summarizeRunMetrics([
      run(1, "succeeded"),
      run(2, "succeeded"),
      run(3, "succeeded"),
      run(4, "failed"),
      run(5, "running"), // in-flight: excluded from settled and the rate
    ]);

    expect(metrics.settled).toBe(4);
    expect(metrics.successRate).toBeCloseTo(0.75);
  });

  it("returns successRate null when nothing has settled", () => {
    const metrics = summarizeRunMetrics([run(1, "running"), run(2, "queued")]);

    expect(metrics.settled).toBe(0);
    expect(metrics.successRate).toBeNull();
  });

  it("returns all-zero, null rate for an empty window", () => {
    expect(summarizeRunMetrics([])).toEqual({
      running: 0,
      queued: 0,
      succeeded: 0,
      failed: 0,
      total: 0,
      settled: 0,
      successRate: null,
    });
  });
});
