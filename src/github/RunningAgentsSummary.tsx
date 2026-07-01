import type { RepoRef } from "../config.ts";
import { summarizeRuns } from "./runsSummary.ts";
import { useRegistryRuns } from "./useRegistryRuns.ts";

/**
 * The cross-repo running-agents summary (#11): a single calm strip of counts —
 * running, queued, recently-failed — folded across every Managed repo's recent
 * Agent runs (#10), so a Viewer sees activity at a glance without opening each
 * repo. Running wears tide teal (healthy/in-flight); queued reads driftwood
 * (idle, waiting). Failed is surfaced plainly in coral so it isn't missed, but
 * without alarm styling — a failed run is information, not a crisis.
 */
const TILES = [
  {
    key: "running" as const,
    label: "Running",
    className: "text-tide-teal",
  },
  {
    key: "queued" as const,
    label: "Queued",
    className: "text-driftwood",
  },
  {
    key: "failed" as const,
    label: "Recently failed",
    className: "text-coral",
  },
];

export function RunningAgentsSummary({
  token,
  repos,
}: {
  token: string | null;
  repos: RepoRef[];
}) {
  const { loaded, isPending } = useRegistryRuns(token, repos);
  const summary = summarizeRuns(loaded);

  return (
    <section aria-labelledby="runs-summary-heading" className="text-left">
      <h2
        id="runs-summary-heading"
        className="text-[11px] font-medium uppercase tracking-[0.14em] text-driftwood"
      >
        Agents across the shore
      </h2>

      {isPending && loaded.length === 0 && (
        <p className="mt-3 text-deep-sea/60">Counting the agents…</p>
      )}

      {!isPending && loaded.length > 0 && summary.total === 0 && (
        <p className="mt-3 text-deep-sea/60">
          No agents running anywhere right now — all quiet.
        </p>
      )}

      {summary.total > 0 && (
        <dl className="mt-4 flex gap-3">
          {TILES.map(({ key, label, className }) => (
            <div
              key={key}
              className="flex min-w-[7rem] flex-col rounded-lg bg-white/60 px-4 py-3 shadow-sm ring-1 ring-deep-sea/10"
            >
              <dt className="text-xs text-deep-sea/60">{label}</dt>
              <dd className={`mt-0.5 text-2xl font-semibold ${className}`}>
                {summary[key]}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
