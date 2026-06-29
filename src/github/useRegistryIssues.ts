import { useQueries } from "@tanstack/react-query";
import type { RepoRef } from "../config.ts";
import type { TriageMapping } from "../triage/mapping.ts";
import { fetchOpenIssues, type Issue } from "./issues.ts";
import { fetchTriageMapping } from "./triageMapping.ts";

/** One Registry repo, the open issues that loaded for it, and its Mapping. */
export interface RepoIssues {
  repo: RepoRef;
  issues: Issue[];
  /** The repo's triage Mapping, or null when it ships no contract (ADR-0003). */
  mapping: TriageMapping | null;
}

export interface RegistryIssuesResult {
  /** Repos that loaded, in Registry order, each with its open issues. */
  loaded: RepoIssues[];
  /** Repos whose fetch failed — inaccessible/private — and were skipped. */
  skipped: RepoRef[];
  /** True while at least one repo's fetch is still in flight. */
  isPending: boolean;
}

/**
 * Fans the single-repo fetch out across every Registry repo (#5). Each repo
 * gets two concurrent, individually-cached queries: its open issues and its
 * triage Mapping (#7). A repo the Viewer's token can't read fails its issues
 * query and is reported as `skipped` rather than breaking the aggregate view; a
 * missing Mapping simply leaves classification to fall back to raw labels.
 * Disabled until a token is present (ADR-0001).
 */
export function useRegistryIssues(
  token: string | null,
  repos: RepoRef[],
): RegistryIssuesResult {
  return useQueries({
    queries: repos.flatMap((repo) => [
      {
        queryKey: ["issues", repo.owner, repo.repo],
        queryFn: () => fetchOpenIssues(token as string, repo),
        enabled: Boolean(token),
      },
      {
        queryKey: ["triage-mapping", repo.owner, repo.repo],
        queryFn: () => fetchTriageMapping(token as string, repo),
        enabled: Boolean(token),
      },
    ]),
    combine: (results): RegistryIssuesResult => {
      const loaded: RepoIssues[] = [];
      const skipped: RepoRef[] = [];
      let isPending = false;

      repos.forEach((repo, i) => {
        const issuesResult = results[i * 2];
        const mappingResult = results[i * 2 + 1];
        if (issuesResult.isSuccess) {
          loaded.push({
            repo,
            issues: issuesResult.data as Issue[],
            mapping: mappingResult.isSuccess
              ? (mappingResult.data as TriageMapping | null)
              : null,
          });
        } else if (issuesResult.isError) {
          skipped.push(repo);
        } else {
          isPending = true;
        }
      });

      return { loaded, skipped, isPending };
    },
  });
}
