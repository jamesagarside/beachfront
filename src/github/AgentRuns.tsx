import type { RepoRef } from "../config.ts";
import { GitHubAuthError } from "./issues.ts";
import type { AgentRun, RunStatus } from "./runs.ts";
import { formatAge } from "./IssueList.tsx";
import { useAgentRuns } from "./useRuns.ts";

/**
 * One Managed repo's recent Agent runs (#10): each GitHub Actions workflow run
 * with its status and a link out to the run. Loading, empty, and error states
 * (including a rejected token) stay calm per the brand voice. Status maps to the
 * semantic palette — tide teal for running/healthy, coral reserved for failure,
 * driftwood for queued/idle.
 */
export function AgentRuns({
  token,
  repo,
}: {
  token: string | null;
  repo: RepoRef;
}) {
  const { data, isPending, isError, error } = useAgentRuns(token, repo);

  return (
    <section aria-labelledby="runs-heading" className="text-left">
      <h2
        id="runs-heading"
        className="text-[11px] font-medium uppercase tracking-[0.14em] text-driftwood"
      >
        Recent agent runs in{" "}
        <strong className="font-semibold text-deep-sea/60 normal-case tracking-normal">
          {repo.owner}/{repo.repo}
        </strong>
      </h2>

      {isPending && <p className="mt-3 text-deep-sea/60">Watching the tide…</p>}

      {isError && (
        <p role="alert" className="mt-3 text-sm text-coral">
          {error instanceof GitHubAuthError
            ? error.message
            : "Couldn't read this repo's agent runs right now."}
        </p>
      )}

      {data && data.length === 0 && (
        <p className="mt-3 text-deep-sea/60">No agent runs yet — all quiet.</p>
      )}

      {data && data.length > 0 && (
        <ul className="mt-4 flex max-h-[26rem] flex-col gap-1.5 overflow-y-auto pr-1">
          {data.map((run) => (
            <RunRow key={run.id} run={run} />
          ))}
        </ul>
      )}
    </section>
  );
}

export function RunRow({ run }: { run: AgentRun }) {
  return (
    <li className="rounded-md bg-white/60 px-3 py-2 shadow-sm ring-1 ring-deep-sea/10 transition hover:bg-white/85">
      <a
        href={run.url}
        target="_blank"
        rel="noreferrer"
        className="text-sm text-deep-sea hover:underline"
      >
        {run.name}
        {run.branch && (
          <span className="text-deep-sea/50"> · {run.branch}</span>
        )}
      </a>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <RunStatusBadge status={run.status} />
        <span className="text-xs text-driftwood">
          started {formatAge(run.createdAt)}
        </span>
      </div>
    </li>
  );
}

const STATUS_STYLE: Record<RunStatus, { label: string; className: string }> = {
  queued: { label: "queued", className: "border-driftwood text-driftwood" },
  running: { label: "running", className: "border-tide-teal text-tide-teal" },
  succeeded: {
    label: "succeeded",
    className: "border-tide-teal text-tide-teal",
  },
  failed: { label: "failed", className: "border-coral text-coral" },
};

function RunStatusBadge({ status }: { status: RunStatus }) {
  const { label, className } = STATUS_STYLE[status];
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-xs ${className}`}
    >
      {label}
    </span>
  );
}
