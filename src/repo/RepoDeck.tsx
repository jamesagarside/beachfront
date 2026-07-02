import type { RepoRef } from "../config.ts";
import { computeHarnessDrift } from "../core/harnessDrift.ts";
import { currentHarnessVersion } from "../core/harnessVersion.ts";
import { AgentRuns } from "../github/AgentRuns.tsx";
import { GitHubAuthError } from "../github/issues.ts";
import { useAgentRuns } from "../github/useRuns.ts";
import { useHarnessVersion } from "../github/useHarnessVersion.ts";
import { useOpenIssues } from "../github/useIssues.ts";
import { useTriageMapping } from "../github/useTriageMapping.ts";
import { SHORELINE_HASH } from "../routing/route.ts";
import { HarnessNote } from "./HarnessNote.tsx";
import { KanbanBoard } from "./KanbanBoard.tsx";
import { RunMetricsPanel } from "./RunMetricsPanel.tsx";
import { StatusCounts } from "./StatusCounts.tsx";

/**
 * The per-repo mission deck (ADR-0009): one Managed repo's agentic-development
 * cockpit. A per-status count line reads the room at a glance (#81); the open
 * issues sit as a Kanban board by triage role (#80, #65); the agent runs are
 * pinned alongside their run-outcome metrics (#82). All three panes share the
 * same cached per-repo queries the rest of the app uses, so opening a deck costs
 * no extra fetches.
 *
 * A deep-linked repo is resolved against the Registry by the router; here we
 * only handle the read itself. A token that can't read the repo gets an honest,
 * calm message with a way back to the Shoreline — never a blank pane (ADR-0001).
 */
export function RepoDeck({
  token,
  repo,
}: {
  token: string | null;
  repo: RepoRef;
}) {
  const { data: issues, isPending, isError, error } = useOpenIssues(token, repo);
  const { data: mapping } = useTriageMapping(token, repo);
  const { data: runs } = useAgentRuns(token, repo);
  const { data: installedHarness } = useHarnessVersion(token, repo);

  const slug = `${repo.owner}/${repo.repo}`;
  // One shared answer with the MCP surface, via the core drift function (#115).
  const harness = computeHarnessDrift(
    repo,
    installedHarness ?? null,
    currentHarnessVersion(),
  );

  return (
    <div className="flex flex-col gap-10">
      <header>
        <h2 className="text-3xl font-light tracking-tight text-deep-sea">
          <span className="text-deep-sea/50">{repo.owner}/</span>
          <span className="font-medium">{repo.repo}</span>
        </h2>
        {issues && issues.length > 0 && (
          <div className="mt-2">
            <StatusCounts issues={issues} mapping={mapping ?? null} />
          </div>
        )}
        {/* Harness drift — silent when current, coral with the fix when behind. */}
        <div className="mt-2">
          <HarnessNote drift={harness} />
        </div>
        {/* Horizon line — the brand's sea/sky seam, closing the masthead. */}
        <div
          aria-hidden="true"
          className="mt-5 h-px w-full bg-gradient-to-r from-deep-sea/25 via-deep-sea/10 to-transparent"
        />
      </header>

      {isPending && <p className="text-deep-sea/60">Reading the shoreline…</p>}

      {isError && (
        <div role="alert" className="text-sm text-coral">
          <p>
            {error instanceof GitHubAuthError
              ? error.message
              : `Couldn't read ${slug} right now.`}
          </p>
          <a
            href={SHORELINE_HASH}
            className="mt-2 inline-block text-deep-sea/70 underline"
          >
            Back to the Shoreline
          </a>
        </div>
      )}

      {issues && (
        <>
          <section aria-labelledby="deck-board-heading">
            <h3
              id="deck-board-heading"
              className="mb-4 text-[11px] font-medium uppercase tracking-[0.14em] text-driftwood"
            >
              Issues by triage role
            </h3>
            {issues.length === 0 ? (
              <p className="text-deep-sea/60">No open issues — all calm.</p>
            ) : (
              <KanbanBoard issues={issues} mapping={mapping ?? null} />
            )}
          </section>

          <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
            <RunMetricsPanel runs={runs ?? []} />
            <AgentRuns token={token} repo={repo} />
          </div>
        </>
      )}
    </div>
  );
}
