import type { AgentRun } from "../github/runs.ts";
import { formatAge } from "../github/IssueList.tsx";
import { summarizeRunMetrics } from "./runMetrics.ts";

/**
 * Per-repo Agent-run metrics panel (#82, ADR-0009): the mission-deck read of
 * one repo's run health — success vs failure, the settled success rate, and how
 * much has run lately. It reuses the stat-tile idiom (a `<dl>` of dt/dd tiles,
 * text-2xl font-semibold, one semantic colour per state) from
 * {@link RunningAgentsSummary} and {@link AgentRuns} so the panes read alike.
 *
 * Colour follows the brand palette: tide teal for succeeded (healthy), coral
 * for failed — surfaced plainly, not as an alarm (a failed run is information,
 * not a crisis), driftwood for idle/unknown.
 *
 * The token-usage tile is a deliberate, labelled SLOT left empty (ADR-0009):
 * token cost isn't in the GitHub Actions API and Sandcastle doesn't emit it
 * yet, so it reads a calm "not yet reported" in driftwood rather than a guessed
 * or hidden number. It stays visible so the gap is honest and the wiring is
 * ready when a real source appears.
 */
export function RunMetricsPanel({ runs }: { runs: AgentRun[] }) {
  const metrics = summarizeRunMetrics(runs);
  const newest = mostRecent(runs);

  return (
    <section aria-labelledby="run-metrics-heading" className="text-left">
      <h3 id="run-metrics-heading" className="text-sm text-deep-sea/70">
        Run metrics
      </h3>

      {runs.length === 0 ? (
        <p className="mt-3 text-deep-sea/60">No agent runs yet — all quiet.</p>
      ) : (
        <>
          <dl className="mt-3 flex flex-wrap gap-6">
            <Tile label="Succeeded" className="text-tide-teal">
              {metrics.succeeded}
            </Tile>
            <Tile label="Failed" className="text-coral">
              {metrics.failed}
            </Tile>
            <Tile label="Success rate" className="text-deep-sea">
              {formatRate(metrics.successRate)}
            </Tile>
            <Tile label="Runs in window" className="text-deep-sea">
              {metrics.total}
            </Tile>
            {/* ADR-0009: token usage has no source yet — a calm, labelled slot. */}
            <Tile label="Token usage" className="text-driftwood text-base">
              not yet reported
            </Tile>
          </dl>

          {newest && (
            <p className="mt-2 text-xs text-driftwood">
              last run {formatAge(newest.createdAt)}
            </p>
          )}
        </>
      )}
    </section>
  );
}

function Tile({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs text-deep-sea/60">{label}</dt>
      <dd className={`text-2xl font-semibold ${className ?? "text-deep-sea"}`}>
        {children}
      </dd>
    </div>
  );
}

/** Settled success rate as a whole-number percent, or "—" when unknown. */
function formatRate(rate: number | null): string {
  return rate === null ? "—" : `${Math.round(rate * 100)}%`;
}

/** The newest run by createdAt, or null for an empty window. */
function mostRecent(runs: AgentRun[]): AgentRun | null {
  let newest: AgentRun | null = null;
  for (const run of runs) {
    if (!newest || new Date(run.createdAt) > new Date(newest.createdAt)) {
      newest = run;
    }
  }
  return newest;
}
