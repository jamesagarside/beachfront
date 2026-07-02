/**
 * The shared-core data source (ADR-0010, #85). Beachfront ships two surfaces —
 * the MCP plugin (tools + local `gh`) and the web SPA (direct GitHub reads with
 * the Viewer's token) — and they must not drift. The fix is to put every read
 * behind this one interface: aggregation, triage classification, and the view
 * builders all consume an {@link EstateDataSource}, never GitHub directly. Each
 * surface supplies its own implementation; the logic and rendering above are
 * shared, so the MCP App and the web SPA cannot diverge.
 *
 * The five reads mirror what a Managed repo's view needs: which repos to show,
 * each repo's open issues, its triage Mapping (#6), its Agent runs (#10), and
 * its installed harness vintage (#115). A source that can't read a repo's issues
 * signals it by rejecting {@link fetchOpenIssues}; a missing Mapping resolves to
 * `null`, missing runs to `[]`, and a missing version stamp to `null`, so
 * classification, the run strip, and the drift indicator degrade calmly
 * (ADR-0003).
 */
import type { RepoRef } from "../config.ts";
import type { Issue } from "../github/issues.ts";
import type { AgentRun } from "../github/runs.ts";
import type { TriageMapping } from "../triage/mapping.ts";

export interface EstateDataSource {
  /** The Managed repos to aggregate (the Registry, ADR-0002). */
  listRepos(): Promise<RepoRef[]>;
  /** A repo's open issues. Rejects when the source can't read the repo. */
  fetchOpenIssues(repo: RepoRef): Promise<Issue[]>;
  /** A repo's triage Mapping, or `null` when it ships no contract (#6). */
  fetchTriageMapping(repo: RepoRef): Promise<TriageMapping | null>;
  /** A repo's recent Agent runs (#10). */
  fetchAgentRuns(repo: RepoRef): Promise<AgentRun[]>;
  /**
   * A repo's installed harness vintage — the first line of its
   * `.sandcastle/.beachfront-version` stamp — or `null` when it carries no stamp
   * (an older onboard, before the stamp convention) (#115).
   */
  fetchHarnessVersion(repo: RepoRef): Promise<string | null>;
}
