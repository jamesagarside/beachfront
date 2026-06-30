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
      <h2 id="runs-summary-heading" className="text-sm text-deep-sea/70">
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
        <dl className="mt-3 flex gap-6">
          {TILES.map(({ key, label, className }) => (
            <div key={key} className="flex flex-col">
              <dt className="text-xs text-deep-sea/60">{label}</dt>
              <dd className={`text-2xl font-semibold ${className}`}>
                {summary[key]}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
