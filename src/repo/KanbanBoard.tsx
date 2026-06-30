/**
 * The per-repo Kanban board (#80, ADR-0009): open issues laid out left-to-right
 * by canonical triage state, so where work sits in the `triage` lifecycle is
 * legible at a glance. The bucketing lives in {@link bucketIssuesByRole}; this
 * component is purely presentational and reuses the app's established card and
 * badge idiom (see IssueList / AgentRuns).
 *
 * Palette per the brand: coral is reserved for the states that need a human to
 * act — untriaged and needs-triage — so their count badges carry coral. Every
 * other column's count is neutral driftwood. Empty columns render a calm,
 * dimmed "none" rather than vanishing, so the board's shape stays stable.
 */
import { bucketIssuesByRole } from "./kanban.ts";
import type { Issue } from "../github/issues.ts";
import type { TriageMapping } from "../triage/mapping.ts";

/** Columns whose work is waiting on a human — coral, per the brand. */
const NEEDS_HUMAN: ReadonlySet<string> = new Set(["untriaged", "needs-triage"]);

export function KanbanBoard({
  issues,
  mapping,
}: {
  issues: Issue[];
  mapping: TriageMapping | null;
}) {
  const columns = bucketIssuesByRole(issues, mapping);

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-4">
        {columns.map((column) => {
          const needsHuman = NEEDS_HUMAN.has(column.role);
          return (
            <section
              key={column.role}
              className="flex min-w-[14rem] flex-col gap-2"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm text-deep-sea/70">{column.label}</h3>
                <span
                  className={`rounded-full border px-2 py-0.5 text-xs ${
                    needsHuman
                      ? "border-coral/60 text-coral"
                      : "border-driftwood text-driftwood"
                  }`}
                >
                  {column.issues.length}
                </span>
              </div>

              {column.issues.length === 0 ? (
                <p className="text-xs text-deep-sea/50">none</p>
              ) : (
                column.issues.map((issue) => (
                  <a
                    key={issue.number}
                    href={issue.url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded border border-deep-sea/15 bg-white/50 px-3 py-2 text-deep-sea hover:underline"
                  >
                    <span className="text-deep-sea/50">#{issue.number}</span>{" "}
                    {issue.title}
                  </a>
                ))
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
