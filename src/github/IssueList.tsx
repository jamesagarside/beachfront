import type { RepoRef } from "../config.ts";
import { classify } from "../triage/classify.ts";
import type { TriageMapping } from "../triage/mapping.ts";
import { IssueTriageEditor } from "./IssueTriageEditor.tsx";
import { GitHubAuthError, type Issue } from "./issues.ts";
import { useOpenIssues } from "./useIssues.ts";
import { useRepoCapability } from "./useRepoCapability.ts";
import { useTriageMapping } from "./useTriageMapping.ts";

/** Context that lets an {@link IssueRow} offer in-place triage editing (#17). */
export interface IssueEditing {
  token: string;
  repo: RepoRef;
  /** Whether the Viewer's token can write — the capability gate (ADR-0004). */
  canWrite: boolean;
}

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
  const { data: mapping } = useTriageMapping(token, repo);
  const { data: canWrite } = useRepoCapability(token, repo);

  const editing: IssueEditing | null = token
    ? { token, repo, canWrite: canWrite ?? false }
    : null;

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
            <IssueRow
              key={issue.number}
              issue={issue}
              mapping={mapping ?? null}
              editing={editing}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * One issue row. When the repo's triage {@link TriageMapping} is known, each
 * issue's labels are resolved to their canonical category and state roles
 * (#7, ADR-0003) and shown as role badges, with the two non-happy states —
 * untriaged and conflicting roles — flagged for attention. A repo with no
 * Mapping degrades gracefully to its raw label chips.
 */
export function IssueRow({
  issue,
  mapping = null,
  editing = null,
}: {
  issue: Issue;
  mapping?: TriageMapping | null;
  editing?: IssueEditing | null;
}) {
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
        {mapping ? (
          <RoleBadges issue={issue} mapping={mapping} />
        ) : (
          <RawLabels issue={issue} />
        )}
        <span className="text-xs text-driftwood">
          opened {formatAge(issue.createdAt)}
        </span>
      </div>
      {editing && (
        <IssueTriageEditor
          token={editing.token}
          repo={editing.repo}
          issue={issue}
          mapping={mapping}
          canWrite={editing.canWrite}
        />
      )}
    </li>
  );
}

/** The repo's raw GitHub labels — the fallback when no Mapping is known. */
function RawLabels({ issue }: { issue: Issue }) {
  return (
    <>
      {issue.labels.map((label) => (
        <span
          key={label.name}
          className="rounded-full border px-2 py-0.5 text-xs"
          style={
            label.color
              ? { borderColor: `#${label.color}`, color: `#${label.color}` }
              : undefined
          }
        >
          {label.name}
        </span>
      ))}
    </>
  );
}

/** Canonical triage roles for an issue, resolved through the repo's Mapping. */
function RoleBadges({
  issue,
  mapping,
}: {
  issue: Issue;
  mapping: TriageMapping;
}) {
  const roles = classify(
    issue.labels.map((label) => label.name),
    mapping,
  );

  return (
    <>
      {roles.categoryRole && (
        <span className="rounded-full border border-deep-sea/30 px-2 py-0.5 text-xs text-deep-sea/80">
          {roles.categoryRole}
        </span>
      )}
      {roles.stateRole && (
        <span className="rounded-full border border-tide-teal/50 px-2 py-0.5 text-xs text-tide-teal">
          {roles.stateRole}
        </span>
      )}
      {roles.untriaged && (
        <span className="rounded-full border border-coral/60 px-2 py-0.5 text-xs text-coral">
          untriaged
        </span>
      )}
      {roles.conflict && (
        <span
          role="status"
          className="rounded-full border border-coral/60 px-2 py-0.5 text-xs text-coral"
        >
          conflicting roles
        </span>
      )}
    </>
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
