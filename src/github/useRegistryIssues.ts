import { useQueries } from "@tanstack/react-query";
import type { RepoRef } from "../config.ts";
import type { TriageMapping } from "../triage/mapping.ts";
import { fetchHarnessVersion } from "./harnessVersion.ts";
import { fetchOpenIssues, GitHubRateLimitError, type Issue } from "./issues.ts";
import { fetchTriageMapping } from "./triageMapping.ts";

/** One Registry repo, the open issues that loaded for it, and its Mapping. */
export interface RepoIssues {
  repo: RepoRef;
  issues: Issue[];
  /** The repo's triage Mapping, or null when it ships no contract (ADR-0003). */
  mapping: TriageMapping | null;
  /**
   * The repo's installed harness vintage (its `.sandcastle/.beachfront-version`
   * stamp's first line), or null when it carries no stamp — the raw input the
   * drift indicator is computed from (#115). Optional so panes that only read
   * issues + mapping (Attention, ready-for-agent) needn't supply it; the
   * Shoreline shore grid sets it. Absent reads as an unknown vintage.
   */
  installedHarnessVersion?: string | null;
}

export interface RegistryIssuesResult {
  /** Repos that loaded, in Registry order, each with its open issues. */
  loaded: RepoIssues[];
  /** Repos whose fetch failed — inaccessible/private — and were skipped. */
  skipped: RepoRef[];
  /** Repos GitHub rate-limited this pass — throttled, not inaccessible. */
  rateLimited: RepoRef[];
  /** True while at least one repo's fetch is still in flight. */
  isPending: boolean;
}

/**
 * Fans the single-repo fetch out across every Registry repo (#5). Each repo
 * gets three concurrent, individually-cached queries: its open issues, its
 * triage Mapping (#7), and its installed harness vintage (#115). A repo the
 * Viewer's token can't read fails its issues query and is reported as `skipped`
 * rather than breaking the aggregate view; a repo GitHub is rate-limiting is
 * reported as `rateLimited` instead, since the token can read it fine once the
 * quota resets; a missing Mapping simply leaves classification to fall back to
 * raw labels, and a missing version stamp reads as an unknown harness vintage.
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
      {
        queryKey: ["harness-version", repo.owner, repo.repo],
        queryFn: () => fetchHarnessVersion(token as string, repo),
        enabled: Boolean(token),
      },
    ]),
    combine: (results): RegistryIssuesResult => {
      const loaded: RepoIssues[] = [];
      const skipped: RepoRef[] = [];
      const rateLimited: RepoRef[] = [];
      let isPending = false;

      repos.forEach((repo, i) => {
        const issuesResult = results[i * 3];
        const mappingResult = results[i * 3 + 1];
        const versionResult = results[i * 3 + 2];
        if (issuesResult.isSuccess) {
          loaded.push({
            repo,
            issues: issuesResult.data as Issue[],
            mapping: mappingResult.isSuccess
              ? (mappingResult.data as TriageMapping | null)
              : null,
            installedHarnessVersion: versionResult.isSuccess
              ? (versionResult.data as string | null)
              : null,
          });
        } else if (issuesResult.isError) {
          if (issuesResult.error instanceof GitHubRateLimitError) {
            rateLimited.push(repo);
          } else {
            skipped.push(repo);
          }
        } else {
          isPending = true;
        }
      });

      return { loaded, skipped, rateLimited, isPending };
    },
  });
}
