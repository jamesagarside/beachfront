/**
 * An in-memory {@link EstateDataSource} for the core's tests. It stands in for
 * any non-web surface (the MCP plugin's tools + local `gh`, #86): proving the
 * shared core runs against this mock proves both surfaces can drive it.
 */
import type { RepoRef } from "../config.ts";
import type { Issue } from "../github/issues.ts";
import type { AgentRun } from "../github/runs.ts";
import type { TriageMapping } from "../triage/mapping.ts";
import type { EstateDataSource } from "./dataSource.ts";

export interface RepoFixture {
  repo: RepoRef;
  issues?: Issue[];
  mapping?: TriageMapping | null;
  runs?: AgentRun[];
  /** The repo's installed harness vintage stamp, or null when unstamped (#115). */
  harnessVersion?: string | null;
  /** When true, the source rejects this repo's issues read (inaccessible). */
  inaccessible?: boolean;
}

export function makeIssue(
  partial: Partial<Issue> & Pick<Issue, "number">,
): Issue {
  return {
    title: `Issue ${partial.number}`,
    url: `https://github.com/o/r/issues/${partial.number}`,
    createdAt: "2026-06-01T00:00:00Z",
    labels: [],
    comments: 0,
    ...partial,
  };
}

export function makeRun(
  partial: Partial<AgentRun> & Pick<AgentRun, "id" | "status">,
): AgentRun {
  return {
    name: `Run ${partial.id}`,
    url: `https://github.com/o/r/actions/runs/${partial.id}`,
    branch: null,
    createdAt: "2026-06-01T00:00:00Z",
    ...partial,
  };
}

function find(fixtures: RepoFixture[], repo: RepoRef): RepoFixture | undefined {
  return fixtures.find(
    (f) => f.repo.owner === repo.owner && f.repo.repo === repo.repo,
  );
}

export function mockDataSource(fixtures: RepoFixture[]): EstateDataSource {
  return {
    listRepos: () => Promise.resolve(fixtures.map((f) => f.repo)),
    fetchOpenIssues: (repo) => {
      const fixture = find(fixtures, repo);
      if (fixture?.inaccessible) {
        return Promise.reject(new Error("inaccessible"));
      }
      return Promise.resolve(fixture?.issues ?? []);
    },
    fetchTriageMapping: (repo) =>
      Promise.resolve(find(fixtures, repo)?.mapping ?? null),
    fetchAgentRuns: (repo) => Promise.resolve(find(fixtures, repo)?.runs ?? []),
    fetchHarnessVersion: (repo) =>
      Promise.resolve(find(fixtures, repo)?.harnessVersion ?? null),
  };
}
