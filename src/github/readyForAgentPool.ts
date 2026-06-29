/**
 * The cross-repo ready-for-agent pool (#9) — the v1-completing counterpart to
 * the Attention queue (#8). Where the Attention queue surfaces work that needs a
 * *human*, this surfaces the work that keeps *agents* fed: every issue across
 * every Managed repo whose canonical state role (ADR-0003) is `ready-for-agent`.
 * Seeing it in one list makes idle agent capacity obvious at a glance.
 *
 * As with the Attention queue, a repo with no Mapping can't be classified
 * (ADR-0003) and contributes nothing.
 */
import type { RepoRef } from "../config.ts";
import { classify } from "../triage/classify.ts";
import type { Issue } from "./issues.ts";
import type { RepoIssues } from "./useRegistryIssues.ts";

/** One ready-for-agent issue, carrying the repo it came from. */
export interface PoolItem {
  repo: RepoRef;
  issue: Issue;
}

function byAge(a: PoolItem, b: PoolItem): number {
  return (
    new Date(a.issue.createdAt).getTime() - new Date(b.issue.createdAt).getTime()
  );
}

/**
 * Builds the cross-repo ready-for-agent pool from the loaded per-repo issues,
 * ordered oldest-first so the longest-waiting agent work surfaces at the top.
 */
export function buildReadyForAgentPool(repos: RepoIssues[]): PoolItem[] {
  const pool: PoolItem[] = [];

  for (const { repo, issues, mapping } of repos) {
    for (const issue of issues) {
      const roles = classify(
        issue.labels.map((label) => label.name),
        mapping,
      );
      if (roles.stateRole === "ready-for-agent") {
        pool.push({ repo, issue });
      }
    }
  }

  pool.sort(byAge);
  return pool;
}
