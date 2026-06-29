import type { RepoRef } from "../config.ts";
import { GitHubAuthError, type Issue } from "./issues.ts";
import { useOpenIssues } from "./useIssues.ts";

/**
 * The first aggregation pane: one configured repo's open issues, each with its
 * title, number, labels, and age. Loading, empty, and error states (including a
 * rejected token) are handled calmly per the brand voice.
 */
export function IssueList({
  token,
  repo,
}: {
  token: string | null;
  repo: RepoRef;
}) {
  const { data, isPending, isError, error } = useOpenIssues(token, repo);

  return (
    <section aria-labelledby="issues-heading" className="text-left">
      <h2 id="issues-heading" className="text-sm text-deep-sea/70">
        Open issues in{" "}
        <strong className="font-medium">
          {repo.owner}/{repo.repo}
        </strong>
      </h2>

      {isPending && (
        <p className="mt-3 text-deep-sea/60">Reading the shoreline…</p>
      )}

      {isError && (
        <p role="alert" className="mt-3 text-sm text-coral">
          {error instanceof GitHubAuthError
            ? error.message
            : "Couldn't read this repo's issues right now."}
        </p>
      )}

      {data && data.length === 0 && (
        <p className="mt-3 text-deep-sea/60">No open issues — all calm.</p>
      )}

      {data && data.length > 0 && (
        <ul className="mt-3 flex flex-col gap-3">
          {data.map((issue) => (
            <IssueRow key={issue.number} issue={issue} />
          ))}
        </ul>
      )}
    </section>
  );
}

function IssueRow({ issue }: { issue: Issue }) {
  return (
    <li className="rounded border border-deep-sea/15 bg-white/50 px-3 py-2">
      <a
        href={issue.url}
        target="_blank"
        rel="noreferrer"
        className="text-deep-sea hover:underline"
      >
        <span className="text-deep-sea/50">#{issue.number}</span> {issue.title}
      </a>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        {issue.labels.map((label) => (
          <span
            key={label.name}
            className="rounded-full border px-2 py-0.5 text-xs"
            style={
              label.color
                ? {
                    borderColor: `#${label.color}`,
                    color: `#${label.color}`,
                  }
                : undefined
            }
          >
            {label.name}
          </span>
        ))}
        <span className="text-xs text-driftwood">
          opened {formatAge(issue.createdAt)}
        </span>
      </div>
    </li>
  );
}

export function formatAge(
  iso: string,
  now: Date = new Date(),
): string {
  const ms = now.getTime() - new Date(iso).getTime();
  const day = 86_400_000;
  const days = Math.floor(ms / day);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.floor(days / 365);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}
