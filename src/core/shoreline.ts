/**
 * The Shoreline estate view-model (#85, ADR-0010): the cross-repo "view from the
 * lookout" that both surfaces render. It is built purely from an aggregated
 * {@link Estate} — no data source, no React, no MCP — so the web SPA and the MCP
 * App render the same shape and cannot diverge.
 *
 * It composes the cross-repo panes already proven for the web skeleton: the
 * Attention queue (#8) and the ready-for-agent pool (#9), reused verbatim. On
 * top it adds the tide-line summary (the calm one-glance totals) and the repo
 * shore grid — one health row per repo (open / needs-a-human / running). Coral
 * is reserved for the attention figures by the renderer (docs/brand.md); this
 * layer only produces the numbers.
 */
import type { RepoRef } from "../config.ts";
import {
  buildAttentionQueue,
  type AttentionQueue,
} from "../github/attentionQueue.ts";
import {
  buildReadyForAgentPool,
  type PoolItem,
} from "../github/readyForAgentPool.ts";
import type { AgentRun } from "../github/runs.ts";
import type { Estate, RepoEstate } from "./estate.ts";

/** One repo's compact health summary in the shore grid. */
export interface RepoHealth {
  repo: RepoRef;
  openCount: number;
  /** Issues needing a human — the Attention buckets for this repo. */
  attentionCount: number;
  /** Agent runs currently running for this repo. */
  runningCount: number;
}

/** The calm one-glance totals across the whole estate. */
export interface TideLine {
  repoCount: number;
  openCount: number;
  attentionCount: number;
  runningCount: number;
}

export interface Shoreline {
  tideLine: TideLine;
  attention: AttentionQueue;
  readyForAgent: PoolItem[];
  repos: RepoHealth[];
  /** Repos the source couldn't read, carried through for a calm note. */
  skipped: RepoRef[];
}

function runningCount(runs: AgentRun[]): number {
  return runs.filter((run) => run.status === "running").length;
}

/** Issues needing a human for one repo — its three Attention buckets summed. */
function attentionCount(repo: RepoEstate): number {
  const queue = buildAttentionQueue([repo]);
  return (
    queue.untriaged.length + queue.needsTriage.length + queue.needsInfo.length
  );
}

function repoHealth(repo: RepoEstate): RepoHealth {
  return {
    repo: repo.repo,
    openCount: repo.issues.length,
    attentionCount: attentionCount(repo),
    runningCount: runningCount(repo.runs),
  };
}

/** Builds the Shoreline view-model from an aggregated estate. */
export function buildShoreline(estate: Estate): Shoreline {
  const repos = estate.repos.map(repoHealth);
  const tideLine: TideLine = {
    repoCount: repos.length,
    openCount: repos.reduce((sum, r) => sum + r.openCount, 0),
    attentionCount: repos.reduce((sum, r) => sum + r.attentionCount, 0),
    runningCount: repos.reduce((sum, r) => sum + r.runningCount, 0),
  };

  return {
    tideLine,
    attention: buildAttentionQueue(estate.repos),
    readyForAgent: buildReadyForAgentPool(estate.repos),
    repos,
    skipped: estate.skipped,
  };
}
