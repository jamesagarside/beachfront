import type { RepoRef } from "../config.ts";
import { AttentionQueue } from "../github/AttentionQueue.tsx";
import { ReadyForAgentPool } from "../github/ReadyForAgentPool.tsx";
import { RunningAgentsSummary } from "../github/RunningAgentsSummary.tsx";
import { useRegistryIssues } from "../github/useRegistryIssues.ts";
import { useRegistryRuns } from "../github/useRegistryRuns.ts";
import { ShoreCard } from "./ShoreCard.tsx";
import { buildShoreSummary, tideLine } from "./shoreSummary.ts";

/**
 * The Shoreline home (#64, ADR-0009): the full cross-repo overview, carrying
 * both of the home's jobs. A calm tide-line summary sits up top; the Attention
 * queue — "what needs you now" — gets real estate next, prominent per the ADR;
 * then the shore itself, every Managed repo as a card with its health summary,
 * each a doorway into that repo's mission deck. The ready-for-agent pool and the
 * running-agents count read as quieter signals below, not competing top-level
 * blocks. When nothing needs a human, the home is simply the calm shore.
 */
export function ShorelineHome({
  token,
  repos,
}: {
  token: string | null;
  repos: RepoRef[];
}) {
  const { loaded: issues, isPending } = useRegistryIssues(token, repos);
  const { loaded: runs } = useRegistryRuns(token, repos);
  const summary = buildShoreSummary(issues, runs);

  return (
    <div className="flex flex-col gap-12">
      <header>
        <h2 className="text-sm uppercase tracking-wide text-driftwood">
          Shoreline
        </h2>
        <p className="mt-1 text-2xl font-light text-deep-sea">
          {isPending && issues.length === 0
            ? "Reading the shoreline…"
            : tideLine(summary)}
        </p>
      </header>

      {/* "What needs you now" — given real estate, not a thin strip. */}
      <AttentionQueue token={token} repos={repos} />

      {/* The shore: every Managed repo as a card you can step into. */}
      <section aria-labelledby="shore-heading">
        <h2 id="shore-heading" className="text-sm text-deep-sea/70">
          The shore
        </h2>
        {summary.repos.length === 0 ? (
          <p className="mt-3 text-deep-sea/60">
            {isPending ? "Counting the castles…" : "No repos linked yet."}
          </p>
        ) : (
          <ul className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {summary.repos.map((health) => (
              <li key={`${health.repo.owner}/${health.repo.repo}`}>
                <ShoreCard health={health} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Quieter cross-repo signals. */}
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
        <ReadyForAgentPool token={token} repos={repos} />
        <RunningAgentsSummary token={token} repos={repos} />
      </div>
    </div>
  );
}
