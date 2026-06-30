import type { QueryClient } from "@tanstack/react-query";
import type { RepoRef } from "../config.ts";
import type { Issue } from "../github/issues.ts";
import { normalizeRunStatus, type AgentRun } from "../github/runs.ts";
import { parseTriageLabels } from "../triage/mapping.ts";
import demoData from "./demoData.json";

/**
 * Demo mode (#27, ADR-0001). The Viewer's token is the data gate, so with no
 * token the app would have nothing to show. Rather than a blank login wall, the
 * public instance ships a *baked* snapshot of its public Registry repos — real
 * issues, runs, and triage contracts — and renders the full pane of glass from
 * it. Pasting a token switches to live fetch.
 *
 * The snapshot is `demoData.json`, the shape a scheduled bake (#26) will later
 * write. Here we load it once and prime the TanStack Query cache under the same
 * per-repo keys the live hooks use; with no token those hooks stay disabled
 * (they never fetch) but still read this seeded data, so demo and live share one
 * code path. Run state is collapsed through the same {@link normalizeRunStatus}
 * the live fetch uses, and triage contracts through {@link parseTriageLabels},
 * so the baked view classifies identically to the live one.
 */
interface DemoRun {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  url: string;
  branch: string | null;
  createdAt: string;
}

interface DemoRepo {
  owner: string;
  repo: string;
  issues: Issue[];
  runs: DemoRun[];
  /** The repo's `triage-labels.md` contents, or null if it ships none. */
  triageLabels: string | null;
}

interface DemoData {
  /** ISO timestamp the snapshot was baked — shown in the demo indicator. */
  bakedAt: string;
  repos: DemoRepo[];
}

const data = demoData as DemoData;

/** ISO time the bundled demo snapshot was baked. */
export const DEMO_BAKED_AT: string = data.bakedAt;

/** The repos the demo snapshot covers — the shore the public demo shows. */
export function demoRepos(): RepoRef[] {
  return data.repos.map((r) => ({ owner: r.owner, repo: r.repo }));
}

function toAgentRun(run: DemoRun): AgentRun {
  return {
    id: run.id,
    name: run.name,
    status: normalizeRunStatus(run.status, run.conclusion),
    url: run.url,
    branch: run.branch,
    createdAt: run.createdAt,
  };
}

/**
 * Primes the query cache with the baked snapshot under the live hooks' keys, so
 * the disabled (token-less) queries resolve from it. Idempotent — safe to call
 * once at startup before render.
 */
export function seedDemoCache(queryClient: QueryClient): void {
  for (const repo of data.repos) {
    queryClient.setQueryData(["issues", repo.owner, repo.repo], repo.issues);
    queryClient.setQueryData(
      ["triage-mapping", repo.owner, repo.repo],
      parseTriageLabels(repo.triageLabels),
    );
    queryClient.setQueryData(
      ["runs", repo.owner, repo.repo],
      repo.runs.map(toAgentRun),
    );
  }
}
