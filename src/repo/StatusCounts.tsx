/**
 * The mission deck's one-line status summary (#81, ADR-0009).
 *
 * A deck shouldn't shout. This renders the per-role counts as a single calm
 * line — "5 ready for agent · 2 need triage" — and nothing more. Zero-count
 * roles drop out so the line stays short, and an empty repo reads "all calm"
 * rather than a row of noughts. Coral is the brand's "needs a human" colour, so
 * only the human-facing buckets (untriaged, needs triage, ready for human) wear
 * it; ready-for-agent is tide teal ("in hand"); the rest stay neutral deep-sea.
 */
import { countIssuesByRole } from "./statusCounts.ts";
import type { Issue } from "../github/issues.ts";
import type { TriageMapping } from "../triage/mapping.ts";

interface RoleStyle {
  /** Human-readable wording for the line. */
  word: string;
  /** Tailwind text colour token class for this role's badge. */
  tone: string;
}

const ROLE_STYLES: Record<string, RoleStyle> = {
  untriaged: { word: "untriaged", tone: "text-coral" },
  "needs-triage": { word: "needs triage", tone: "text-coral" },
  "ready-for-human": { word: "ready for human", tone: "text-coral" },
  "ready-for-agent": { word: "ready for agent", tone: "text-tide-teal" },
  "needs-info": { word: "needs info", tone: "text-deep-sea/70" },
  wontfix: { word: "wontfix", tone: "text-driftwood" },
};

export function StatusCounts({
  issues,
  mapping,
}: {
  issues: Issue[];
  mapping: TriageMapping | null;
}) {
  const counts = countIssuesByRole(issues, mapping).filter(
    ({ count }) => count > 0,
  );

  if (counts.length === 0) {
    return (
      <p className="text-sm text-deep-sea/60">
        {issues.length === 0 ? "no open issues" : "all calm"}
      </p>
    );
  }

  return (
    <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm text-deep-sea/70">
      {counts.map(({ role, count }, index) => {
        const style = ROLE_STYLES[role] ?? {
          word: role,
          tone: "text-deep-sea/70",
        };
        return (
          <span key={role} className={style.tone}>
            {index > 0 && (
              <span className="mr-2 text-deep-sea/30" aria-hidden="true">
                ·
              </span>
            )}
            {count} {style.word}
          </span>
        );
      })}
    </p>
  );
}
