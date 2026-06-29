import { useQuery } from "@tanstack/react-query";
import type { RepoRef } from "../config.ts";
import { fetchAgentRuns } from "./runs.ts";

/**
 * Caches one repo's recent Agent runs under a per-repo key so TanStack Query
 * dedupes and reuses fetches, mirroring {@link useOpenIssues}. Disabled until a
 * token is present, since every read is the Viewer's own credential (ADR-0001).
 */
export function useAgentRuns(token: string | null, repo: RepoRef) {
  return useQuery({
    queryKey: ["runs", repo.owner, repo.repo],
    queryFn: () => fetchAgentRuns(token as string, repo),
    enabled: Boolean(token),
  });
}
