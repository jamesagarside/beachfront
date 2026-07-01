/**
 * The per-repo Kanban board (#80, ADR-0009): open issues laid out left-to-right
 * by canonical triage state, so where work sits in the `triage` lifecycle is
 * legible at a glance. The bucketing lives in {@link bucketIssuesByRole}; this
 * component is purely presentational and reuses the app's established card and
 * badge idiom (see IssueList / AgentRuns).
 *
 * Palette per the brand: coral is reserved for the states that need a human to
 * act — untriaged and needs-triage — carried on those columns' top seam and
 * count badges; ready-for-agent wears the tide-teal seam ("fed, in hand"); the
 * rest stay neutral driftwood. The same seams the MCP deck renderer draws, so
 * the two surfaces' boards read alike. Empty columns render a calm, dimmed
 * "none" rather than vanishing, so the board's shape stays stable.
 */
import { bucketIssuesByRole } from "./kanban.ts";
import type { Issue } from "../github/issues.ts";
import type { TriageMapping } from "../triage/mapping.ts";

/** Columns whose work is waiting on a human — coral, per the brand. The same
 * set the StatusCounts line and the MCP deck renderer colour coral. */
const NEEDS_HUMAN: ReadonlySet<string> = new Set([
  "untriaged",
  "needs-triage",
  "ready-for-human",
]);

/** Columns whose work is fed and in hand — tide teal. */
const IN_HAND: ReadonlySet<string> = new Set(["ready-for-agent"]);

/**
 * A column's accent — the same semantic seam the MCP deck renderer draws, so
 * the two surfaces' boards read alike: coral where a human is needed, teal
 * where work is fed, driftwood for the calm rest. An empty column always reads
 * driftwood: coral marks work waiting on a human, and its scarcity is the
 * brand's whole point.
 */
function columnAccent(role: string, empty: boolean): string {
  if (empty) return "border-t-driftwood/40";
  if (NEEDS_HUMAN.has(role)) return "border-t-coral";
  if (IN_HAND.has(role)) return "border-t-tide-teal";
  return "border-t-driftwood/50";
}

export function KanbanBoard({
  issues,
  mapping,
}: {
  issues: Issue[];
  mapping: TriageMapping | null;
}) {
  const columns = bucketIssuesByRole(issues, mapping);

  return (
    <div className="-mx-1 overflow-x-auto px-1 pb-3">
      <div className="flex items-start gap-3">
        {columns.map((column) => {
          const needsHuman = NEEDS_HUMAN.has(column.role);
          const empty = column.issues.length === 0;
          return (
            <section
              key={column.role}
              className={`flex shrink-0 flex-col gap-2 rounded-lg border-t-2 ${columnAccent(
                column.role,
                empty,
              )} bg-white/45 px-2.5 pb-2.5 pt-2 shadow-sm ring-1 ring-deep-sea/10 ${
                empty ? "w-40 opacity-70" : "w-60"
              }`}
            >
              <div className="flex items-center justify-between gap-2 px-0.5">
                <h3 className="text-sm font-medium text-deep-sea/80">
                  {column.label}
                </h3>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    needsHuman && !empty
                      ? "bg-coral/15 font-semibold text-coral"
                      : "bg-deep-sea/5 text-driftwood"
                  }`}
                >
                  {column.issues.length}
                </span>
              </div>

              {empty ? (
                <p className="py-1 text-center text-xs text-deep-sea/40">
                  none
                </p>
              ) : (
                column.issues.map((issue) => (
                  <a
                    key={issue.number}
                    href={issue.url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-md bg-white px-3 py-2 text-sm text-deep-sea shadow-sm ring-1 ring-deep-sea/10 transition hover:ring-deep-sea/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tide-teal"
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
