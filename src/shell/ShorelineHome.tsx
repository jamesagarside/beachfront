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
    <div className="flex flex-col gap-10">
      <header>
        <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-driftwood">
          Shoreline
        </h2>
        <p className="mt-1.5 text-3xl font-light tracking-tight text-deep-sea">
          {isPending && issues.length === 0
            ? "Reading the shoreline…"
            : tideLine(summary)}
        </p>
        {/* Horizon line — the brand's sea/sky seam, closing the masthead. */}
        <div
          aria-hidden="true"
          className="mt-5 h-px w-full bg-gradient-to-r from-deep-sea/25 via-deep-sea/10 to-transparent"
        />
      </header>

      {/* "What needs you now" — given real estate, not a thin strip. */}
      <AttentionQueue token={token} repos={repos} />

      {/* The shore: every Managed repo as a card you can step into. */}
      <section aria-labelledby="shore-heading">
        <h2
          id="shore-heading"
          className="text-[11px] font-medium uppercase tracking-[0.14em] text-driftwood"
        >
          The shore
        </h2>
        {summary.repos.length === 0 ? (
          <p className="mt-3 text-deep-sea/60">
            {isPending ? "Counting the castles…" : "No repos linked yet."}
          </p>
        ) : (
          <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {summary.repos.map((health) => (
              <li key={`${health.repo.owner}/${health.repo.repo}`}>
                <ShoreCard health={health} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Quieter cross-repo signals. */}
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
        <ReadyForAgentPool token={token} repos={repos} />
        <RunningAgentsSummary token={token} repos={repos} />
      </div>
    </div>
  );
}
