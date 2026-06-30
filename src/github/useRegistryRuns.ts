import { useQueries } from "@tanstack/react-query";
import type { RepoRef } from "../config.ts";
import { fetchAgentRuns, type AgentRun } from "./runs.ts";
import type { RepoRuns } from "./runsSummary.ts";

export interface RegistryRunsResult {
  /** Repos whose runs loaded, in Registry order. */
  loaded: RepoRuns[];
  /** Repos whose runs fetch failed — inaccessible/private — and were skipped. */
  skipped: RepoRef[];
  /** True while at least one repo's runs fetch is still in flight. */
  isPending: boolean;
}

/**
 * Fans the single-repo Agent-runs fetch (#10) out across every Registry repo so
 * the running-agents summary (#11) can fold them together. Each repo gets its
 * own cached query — mirroring {@link useRegistryIssues} — so a repo the
 * Viewer's token can't read fails alone and is reported as `skipped` rather than
 * breaking the cross-repo count. Disabled until a token is present (ADR-0001).
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

      repos.forEach((repo, i) => {
        const result = results[i];
        if (result.isSuccess) {
          loaded.push({ repo, runs: result.data as AgentRun[] });
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
