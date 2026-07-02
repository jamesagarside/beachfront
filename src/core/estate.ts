/**
 * Estate aggregation (#85): the data-source-agnostic gather step that both
 * surfaces run before rendering. It walks the Registry through an
 * {@link EstateDataSource}, pulling each repo's open issues, triage Mapping, and
 * Agent runs, and assembles them into an {@link Estate} the Shoreline and
 * per-repo deck builders render from.
 *
 * Resilience follows the brand: a repo whose issues can't be read (private /
 * inaccessible) is `skipped` rather than failing the whole estate (ADR-0001);
 * a missing Mapping degrades to `null` and missing runs to `[]` so the rest of
 * the repo still renders (ADR-0003). Repos load concurrently.
 */
import type { RepoRef } from "../config.ts";
import type { Issue } from "../github/issues.ts";
import type { AgentRun } from "../github/runs.ts";
import type { TriageMapping } from "../triage/mapping.ts";
import type { EstateDataSource } from "./dataSource.ts";

/** One Managed repo with everything the views need, fully resolved. */
export interface RepoEstate {
  repo: RepoRef;
  issues: Issue[];
  /** The repo's triage Mapping, or null when it ships no contract (#6). */
  mapping: TriageMapping | null;
  runs: AgentRun[];
  /**
   * The repo's installed harness vintage (its `.sandcastle/.beachfront-version`
   * stamp's first line), or null when it carries no stamp (an older onboard) —
   * the raw input the drift indicator is computed from (#115).
   */
  installedHarnessVersion: string | null;
}

export interface Estate {
  /** Repos that loaded, in Registry order. */
  repos: RepoEstate[];
  /** Repos whose issues couldn't be read — inaccessible — and were skipped. */
  skipped: RepoRef[];
}

type RepoResult =
  | { kind: "loaded"; estate: RepoEstate }
  | { kind: "skipped"; repo: RepoRef };

async function aggregateRepo(
  source: EstateDataSource,
  repo: RepoRef,
): Promise<RepoResult> {
  let issues: Issue[];
  try {
    issues = await source.fetchOpenIssues(repo);
  } catch {
    return { kind: "skipped", repo };
  }

  // Mapping, runs, and the harness vintage are best-effort: a failure leaves the
  // repo's issues visible, just with reduced fidelity rather than dropping the
  // whole repo. A missing/unreadable stamp degrades to null → "unknown" drift.
  const [mapping, runs, installedHarnessVersion] = await Promise.all([
    source.fetchTriageMapping(repo).catch(() => null),
    source.fetchAgentRuns(repo).catch((): AgentRun[] => []),
    source.fetchHarnessVersion(repo).catch((): string | null => null),
  ]);

  return {
    kind: "loaded",
    estate: { repo, issues, mapping, runs, installedHarnessVersion },
  };
}

/**
 * Aggregates the whole estate from a data source. Loaded repos keep the source's
 * `listRepos` order; inaccessible repos are reported in `skipped`.
 */
export async function aggregateEstate(
  source: EstateDataSource,
): Promise<Estate> {
  const repos = await source.listRepos();
  const results = await Promise.all(
    repos.map((repo) => aggregateRepo(source, repo)),
  );

  const loaded: RepoEstate[] = [];
  const skipped: RepoRef[] = [];
  for (const result of results) {
    if (result.kind === "loaded") loaded.push(result.estate);
    else skipped.push(result.repo);
  }

  return { repos: loaded, skipped };
}
