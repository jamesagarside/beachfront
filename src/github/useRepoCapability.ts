import { useQuery } from "@tanstack/react-query";
import type { RepoRef } from "../config.ts";
import { fetchRepoCapability } from "./editIssue.ts";

/**
 * Caches whether the Viewer's token can write to a repo under a per-repo key,
 * mirroring {@link useOpenIssues}. The capability gate (ADR-0001/0004) decides
 * whether the per-repo view offers in-app editing or a pivot to GitHub.
 * Disabled until a token is present.
 */
export function useRepoCapability(token: string | null, repo: RepoRef) {
  return useQuery({
    queryKey: ["capability", repo.owner, repo.repo],
    queryFn: () => fetchRepoCapability(token as string, repo),
    enabled: Boolean(token),
  });
}
