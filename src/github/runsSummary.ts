/**
 * The cross-repo running-agents summary (#11): a single glance at how busy the
 * whole shore is right now. It folds every Managed repo's recent Agent runs
 * (#10) into three counts — running, queued, and recently-failed — so a Viewer
 * sees activity across all repos without opening each one.
 *
 * "Recently failed" is just the failed runs in the per-repo recent window the
 * runs fetch already returns (newest first), so old, long-settled failures
 * don't keep ringing. Failures are surfaced plainly, not alarmingly (the brand
 * reserves coral for "needs a human", and a failed run is information, not a
 * crisis).
 */
import type { RepoRef } from "../config.ts";
import type { AgentRun } from "./runs.ts";

/** One Registry repo and the recent Agent runs that loaded for it. */
export interface RepoRuns {
  repo: RepoRef;
  runs: AgentRun[];
}

export interface RunsSummary {
  running: number;
  queued: number;
  failed: number;
  /** running + queued + failed — the runs worth a glance across all repos. */
  total: number;
}

/**
 * Counts running, queued, and recently-failed Agent runs across every repo.
 * Succeeded runs are settled and don't count toward the at-a-glance total —
 * the summary is about what's in flight or needs noticing.
 */
export function summarizeRuns(repos: RepoRuns[]): RunsSummary {
  let running = 0;
  let queued = 0;
  let failed = 0;

  for (const { runs } of repos) {
    for (const run of runs) {
      switch (run.status) {
        case "running":
          running += 1;
          break;
        case "queued":
          queued += 1;
          break;
        case "failed":
          failed += 1;
          break;
      }
    }
  }

  return { running, queued, failed, total: running + queued + failed };
}
