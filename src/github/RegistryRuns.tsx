import type { RepoRef } from "../config.ts";
import { formatAge } from "./IssueList.tsx";
import type { AgentRun, RunStatus } from "./runs.ts";
import { useRegistryRuns, type RepoRuns } from "./useRegistryRuns.ts";

/**
 * The Agent-runs pane (#10): every Registry repo's recent GitHub Actions runs,
 * grouped under a per-repo heading, each with its status and a link out to the
 * run. Repos the token can't read are skipped quietly, the same as the issues
 * pane. Fetches run concurrently and are cached per repo
 * (see {@link useRegistryRuns}).
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
        <p className="text-deep-sea/60">Watching for agents…</p>
      )}

      {loaded.map((entry) => (
        <RepoRunsSection
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

function RepoRunsSection({ repo, runs }: RepoRuns) {
  const slug = `${repo.owner}/${repo.repo}`;
  const headingId = `runs-${repo.owner}-${repo.repo}`;

  return (
    <section role="region" aria-labelledby={headingId} className="text-left">
      <h2 id={headingId} className="text-sm text-deep-sea/70">
        Agent runs in <strong className="font-medium">{slug}</strong>
      </h2>

      {runs.length === 0 ? (
        <p className="mt-3 text-deep-sea/60">No recent agent runs — all quiet.</p>
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

export function AgentRunRow({ run }: { run: AgentRun }) {
  return (
    <li className="rounded border border-deep-sea/15 bg-white/50 px-3 py-2">
      <a
        href={run.url}
        target="_blank"
        rel="noreferrer"
        className="text-deep-sea hover:underline"
      >
        {run.name}
      </a>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <RunStatusBadge status={run.status} />
        {run.branch && (
          <span className="text-xs text-driftwood">{run.branch}</span>
        )}
        <span className="text-xs text-driftwood">
          started {formatAge(run.createdAt)}
        </span>
      </div>
    </li>
  );
}

/**
 * Each canonical run state gets its own calm, distinct tone so a Viewer reads
 * status at a glance. Failed is coral but unadorned — visible, not alarming.
 * (The full brand colour pass lands in #13.)
 */
const STATUS_TONE: Record<RunStatus, string> = {
  queued: "text-driftwood border-driftwood/40",
  running: "text-deep-sea border-deep-sea/30",
  succeeded: "text-tide-teal border-tide-teal/40",
  failed: "text-coral border-coral/50",
};

function RunStatusBadge({ status }: { status: RunStatus }) {
  return (
    <span
      data-status={status}
      className={`rounded-full border px-2 py-0.5 text-xs ${STATUS_TONE[status]}`}
    >
      {status}
    </span>
  );
}
