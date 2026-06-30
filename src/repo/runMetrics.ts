/**
 * Per-repo Agent-run metrics (#82, ADR-0009): folds one repo's recent Agent
 * runs (#10) into a small run-health summary — counts by status, plus a
 * success rate over the runs that have settled. This is the at-a-glance health
 * a Viewer wants for a single repo, where {@link summarizeRuns} answers the
 * cross-repo "what's in flight" question.
 *
 * The success rate is deliberately taken over settled runs only (succeeded +
 * failed). In-flight runs (running, queued) have no outcome yet, so folding
 * them in would understate the rate while work is mid-tide. When nothing has
 * settled there's no honest number to show, so the rate is null and the panel
 * reads "—" rather than a misleading 0%.
 */
import type { AgentRun } from "../github/runs.ts";

export interface RunMetrics {
  running: number;
  queued: number;
  succeeded: number;
  failed: number;
  /** All runs in the window. */
  total: number;
  /** succeeded + failed — the runs that have an outcome. */
  settled: number;
  /** succeeded / settled, in 0..1; null when nothing has settled. */
  successRate: number | null;
}

/** Counts each run status across the given recent-run window and derives the
 * settled success rate (null when no run has settled — avoids divide-by-zero). */
export function summarizeRunMetrics(runs: AgentRun[]): RunMetrics {
  let running = 0;
  let queued = 0;
  let succeeded = 0;
  let failed = 0;

  for (const run of runs) {
    switch (run.status) {
      case "running":
        running += 1;
        break;
      case "queued":
        queued += 1;
        break;
      case "succeeded":
        succeeded += 1;
        break;
      case "failed":
        failed += 1;
        break;
    }
  }

  const settled = succeeded + failed;

  return {
    running,
    queued,
    succeeded,
    failed,
    total: runs.length,
    settled,
    successRate: settled === 0 ? null : succeeded / settled,
  };
}
