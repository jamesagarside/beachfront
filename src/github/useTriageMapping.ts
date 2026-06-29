import { useQuery } from "@tanstack/react-query";
import type { RepoRef } from "../config.ts";
import { fetchTriageMapping } from "./triageMapping.ts";

/**
 * Caches one repo's triage Mapping under a per-repo key so TanStack Query
 * dedupes and reuses fetches, mirroring {@link useOpenIssues}. Disabled until a
 * token is present, since the read is the Viewer's own credential (ADR-0001).
 */
export function useTriageMapping(token: string | null, repo: RepoRef) {
  return useQuery({
    queryKey: ["triage-mapping", repo.owner, repo.repo],
    queryFn: () => fetchTriageMapping(token as string, repo),
    enabled: Boolean(token),
  });
}
