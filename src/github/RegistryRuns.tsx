import type { RepoRef } from "../config.ts";
import { formatAge } from "./IssueList.tsx";
import type { AgentRun, RunState } from "./runs.ts";
import { useRegistryRuns, type RepoRuns } from "./useRegistryRuns.ts";

/**
 * The Agent-runs pane (#10): every Registry repo the Viewer's token can read,
 * its recent GitHub Actions runs grouped under a per-repo heading with a clear
 * status and a link out to the run. Repos the token can't read are skipped
 * quietly (see {@link useRegistryRuns}). Per the brand, coral is reserved for the
 * Attention queue, so failed runs are made legible — not alarming.
 */
export function RegistryRuns({
  token,
  repos,
}: {
  token: string | null;
  repos: RepoRef[];
}) {
  const { loaded, skipped, isPending } = useRegistryRuns(token, repos);

  return (
    <div className="flex flex-col gap-8">
      {isPending && loaded.length === 0 && (
        <p className="text-deep-sea/60">Watching the tide…</p>
      )}

      {loaded.map((entry) => (
        <RepoRunSection
          key={`${entry.repo.owner}/${entry.repo.repo}`}
          {...entry}
        />
      ))}

      {skipped.length > 0 && (
        <p className="text-xs text-driftwood">
          Skipped {skipped.length} repo{skipped.length === 1 ? "" : "s"} this
          token can't read.
        </p>
      )}
    </div>
  );
}

function RepoRunSection({ repo, runs }: RepoRuns) {
  const slug = `${repo.owner}/${repo.repo}`;
  const headingId = `runs-${repo.owner}-${repo.repo}`;

  return (
    <section role="region" aria-labelledby={headingId} className="text-left">
      <h2 id={headingId} className="text-sm text-deep-sea/70">
        <strong className="font-medium">{slug}</strong> · agent runs
      </h2>

      {runs.length === 0 ? (
        <p className="mt-3 text-deep-sea/60">No agent runs yet — quiet shore.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {runs.map((run) => (
            <AgentRunRow key={run.id} run={run} />
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Each canonical {@link RunState} maps to one calm visual state. Running and
 * succeeded read as "handled" in tide teal; queued is calm sky; failed is
 * prominent deep-sea (legible, never an alarm); other is muted driftwood. Coral
 * is deliberately absent — it belongs to the Attention queue alone.
 */
const STATE_STYLES: Record<RunState, { label: string; className: string }> = {
  running: { label: "running", className: "border-tide-teal text-tide-teal" },
  succeeded: {
    label: "succeeded",
    className: "border-tide-teal/60 text-tide-teal",
  },
  queued: { label: "queued", className: "border-sky text-deep-sea/70" },
  failed: {
    label: "failed",
    className: "border-deep-sea bg-deep-sea/5 font-medium text-deep-sea",
  },
  other: { label: "finished", className: "border-driftwood text-driftwood" },
};

export function AgentRunRow({ run }: { run: AgentRun }) {
  const style = STATE_STYLES[run.state];

  return (
    <li className="rounded border border-deep-sea/15 bg-white/50 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <a
          href={run.url}
          target="_blank"
          rel="noreferrer"
          className="text-deep-sea hover:underline"
        >
          {run.name}
        </a>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-xs ${style.className}`}
        >
          {style.label}
        </span>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-driftwood">
        {run.branch && <span>{run.branch}</span>}
        <span>started {formatAge(run.createdAt)}</span>
      </div>
    </li>
  );
}
