import { useQueries } from "@tanstack/react-query";
import type { RepoRef } from "../config.ts";
import { fetchAgentRuns, type AgentRun } from "./runs.ts";

/** One Registry repo and the recent Agent runs that loaded for it. */
export interface RepoRuns {
  repo: RepoRef;
  runs: AgentRun[];
}

export interface RegistryRunsResult {
  /** Repos that loaded, in Registry order, each with its recent runs. */
  loaded: RepoRuns[];
  /** Repos whose fetch failed — inaccessible/private — and were skipped. */
  skipped: RepoRef[];
  /** True while at least one repo's fetch is still in flight. */
  isPending: boolean;
}

/**
 * Fans the single-repo Agent-run fetch out across every Registry repo (#10),
 * mirroring {@link useRegistryIssues}: one query per repo so fetches run
 * concurrently and cache individually, and a repo the Viewer's token can't read
 * is reported as `skipped` rather than breaking the aggregate view. Disabled
 * until a token is present (ADR-0001).
 */
export function useRegistryRuns(
  token: string | null,
  repos: RepoRef[],
): RegistryRunsResult {
  return useQueries({
    queries: repos.map((repo) => ({
      queryKey: ["runs", repo.owner, repo.repo],
      queryFn: () => fetchAgentRuns(token as string, repo),
      enabled: Boolean(token),
    })),
    combine: (results): RegistryRunsResult => {
      const loaded: RepoRuns[] = [];
      const skipped: RepoRef[] = [];
      let isPending = false;

      results.forEach((result, i) => {
        const repo = repos[i];
        if (result.isSuccess) {
          loaded.push({ repo, runs: result.data });
        } else if (result.isError) {
          skipped.push(repo);
        } else {
          isPending = true;
        }
      });

      return { loaded, skipped, isPending };
    },
  });
}
