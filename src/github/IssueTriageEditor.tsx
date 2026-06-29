import { useState } from "react";
import type { RepoRef } from "../config.ts";
import { classify } from "../triage/classify.ts";
import {
  CANONICAL_STATE_ROLES,
  type TriageMapping,
  type TriageStateRole,
} from "../triage/mapping.ts";
import { postIssueComment, setIssueStateRole } from "./editIssue.ts";
import type { Issue } from "./issues.ts";

/**
 * In-place triage editing for one issue in the per-repo view (#17). With a
 * write-scoped token the Viewer can change the issue's canonical state role
 * (which writes the repo's mapped labels) and post a comment — both as the
 * Viewer's own token (ADR-0001/0004). With a read-only token there is nothing
 * to write, so the editor collapses to an "Edit on GitHub" deep link. A repo
 * with no triage Mapping can't offer role editing (we can't name the labels),
 * but comments still work.
 */
type Phase =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; message: string }
  | { kind: "error"; message: string };

export function IssueTriageEditor({
  token,
  repo,
  issue,
  mapping,
  canWrite,
}: {
  token: string;
  repo: RepoRef;
  issue: Issue;
  mapping: TriageMapping | null;
  canWrite: boolean;
}) {
  const current = mapping
    ? classify(
        issue.labels.map((label) => label.name),
        mapping,
      ).stateRole
    : null;

  const [labels, setLabels] = useState(issue.labels.map((label) => label.name));
  const [role, setRole] = useState<TriageStateRole>(
    current ?? CANONICAL_STATE_ROLES[0],
  );
  const [comment, setComment] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });

  // Read-only token: nothing to write — pivot the Viewer out to GitHub.
  if (!canWrite) {
    return (
      <p className="mt-2 text-xs text-driftwood">
        Read-only token —{" "}
        <a
          href={issue.url}
          target="_blank"
          rel="noreferrer"
          className="text-deep-sea underline"
        >
          edit on GitHub
        </a>
        .
      </p>
    );
  }

  async function applyRole() {
    if (!mapping) return;
    setPhase({ kind: "saving" });
    try {
      const next = await setIssueStateRole(
        token,
        repo,
        issue.number,
        labels,
        mapping,
        role,
      );
      setLabels(next);
      setPhase({ kind: "saved", message: `Triage role set to ${role}.` });
    } catch (err: unknown) {
      setPhase({
        kind: "error",
        message:
          err instanceof Error ? err.message : "Couldn't update the role.",
      });
    }
  }

  async function submitComment() {
    const body = comment.trim();
    if (!body) return;
    setPhase({ kind: "saving" });
    try {
      await postIssueComment(token, repo, issue.number, body);
      setComment("");
      setPhase({ kind: "saved", message: "Comment posted." });
    } catch (err: unknown) {
      setPhase({
        kind: "error",
        message:
          err instanceof Error ? err.message : "Couldn't post the comment.",
      });
    }
  }

  const busy = phase.kind === "saving";

  return (
    <div className="mt-2 flex w-full flex-col gap-2 text-left">
      {mapping && (
        <div className="flex flex-wrap items-end gap-2">
          <label
            htmlFor={`role-${issue.number}`}
            className="text-xs text-deep-sea/70"
          >
            Triage role
          </label>
          <select
            id={`role-${issue.number}`}
            value={role}
            onChange={(e) => setRole(e.target.value as TriageStateRole)}
            className="rounded border border-deep-sea/30 bg-white/60 px-2 py-1 text-xs text-deep-sea"
          >
            {CANONICAL_STATE_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={busy}
            onClick={applyRole}
            className="rounded bg-tide-teal px-3 py-1 text-xs text-white disabled:opacity-60"
          >
            Set role
          </button>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label
          htmlFor={`comment-${issue.number}`}
          className="text-xs text-deep-sea/70"
        >
          Comment
        </label>
        <textarea
          id={`comment-${issue.number}`}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={2}
          className="rounded border border-deep-sea/30 bg-white/60 px-2 py-1 text-xs text-deep-sea"
        />
        <button
          type="button"
          disabled={busy || comment.trim() === ""}
          onClick={submitComment}
          className="self-start rounded bg-tide-teal px-3 py-1 text-xs text-white disabled:opacity-60"
        >
          Comment
        </button>
      </div>

      {phase.kind === "saved" && (
        <p role="status" className="text-xs text-tide-teal">
          {phase.message}
        </p>
      )}
      {phase.kind === "error" && (
        <p role="alert" className="text-xs text-coral">
          {phase.message}
        </p>
      )}
    </div>
  );
}
