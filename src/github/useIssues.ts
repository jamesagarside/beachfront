import { useQuery } from "@tanstack/react-query";
import type { RepoRef } from "../config.ts";
import { fetchOpenIssues } from "./issues.ts";

/**
 * Caches one repo's open issues under a per-repo key so TanStack Query
 * dedupes and reuses fetches. Disabled until a token is present, since every
 * read is made as the Viewer's own credential (ADR-0001).
 */
export function useOpenIssues(token: string | null, repo: RepoRef) {
  return useQuery({
    queryKey: ["issues", repo.owner, repo.repo],
    queryFn: () => fetchOpenIssues(token as string, repo),
    enabled: Boolean(token),
  });
}
