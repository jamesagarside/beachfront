/**
 * The web surface's {@link EstateDataSource} (#85, ADR-0010): it satisfies the
 * shared-core interface with direct GitHub reads made as the Viewer's own token
 * (ADR-0001), reusing the existing Octokit fetchers. The MCP plugin supplies a
 * sibling implementation backed by tools + local `gh` (#86); both drive the same
 * aggregation and view builders, so the two surfaces can't diverge.
 */
import type { RepoRef } from "../config.ts";
import { fetchHarnessVersion } from "../github/harnessVersion.ts";
import { fetchOpenIssues } from "../github/issues.ts";
import { fetchAgentRuns } from "../github/runs.ts";
import { fetchTriageMapping } from "../github/triageMapping.ts";
import type { EstateDataSource } from "./dataSource.ts";

export function webDataSource(
  token: string,
  repos: RepoRef[],
): EstateDataSource {
  return {
    listRepos: () => Promise.resolve(repos),
    fetchOpenIssues: (repo) => fetchOpenIssues(token, repo),
    fetchTriageMapping: (repo) => fetchTriageMapping(token, repo),
    fetchAgentRuns: (repo) => fetchAgentRuns(token, repo),
    fetchHarnessVersion: (repo) => fetchHarnessVersion(token, repo),
  };
}
