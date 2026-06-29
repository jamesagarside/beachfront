import { useQueries } from "@tanstack/react-query";
import type { RepoRef } from "../config.ts";
import { fetchOpenIssues, type Issue } from "./issues.ts";

/** One Registry repo and the open issues that loaded for it. */
export interface RepoIssues {
  repo: RepoRef;
  issues: Issue[];
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
 * Fans the single-repo fetch out across every Registry repo (#5). Each repo is
 * its own query keyed exactly as {@link useOpenIssues}, so fetches run
 * concurrently and are cached individually. A repo the Viewer's token can't
 * read fails its own query and is reported as `skipped` rather than breaking
 * the aggregate view. Disabled until a token is present (ADR-0001).
 */
export function useRegistryIssues(
  token: string | null,
  repos: RepoRef[],
): RegistryIssuesResult {
  return useQueries({
    queries: repos.map((repo) => ({
      queryKey: ["issues", repo.owner, repo.repo],
      queryFn: () => fetchOpenIssues(token as string, repo),
      enabled: Boolean(token),
    })),
    combine: (results): RegistryIssuesResult => {
      const loaded: RepoIssues[] = [];
      const skipped: RepoRef[] = [];
      let isPending = false;

      results.forEach((result, i) => {
        const repo = repos[i];
        if (result.isSuccess) {
          loaded.push({ repo, issues: result.data });
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
