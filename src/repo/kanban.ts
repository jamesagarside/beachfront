/**
 * Bucket a repo's open issues into Kanban columns by canonical triage state
 * (#80, ADR-0009). The board is the triage state machine made visible: each
 * column is one place an issue can sit between arriving and being resolved, so
 * the column order mirrors the `triage` lifecycle — untriaged first (the work
 * that hasn't started), the five canonical state roles in their lifecycle
 * order, and a catch-all "other" last for issues classify() can place into no
 * single state (category-only issues, or — when the repo has no Mapping — every
 * issue, since we then can't say).
 *
 * We always surface the full set of state columns even when empty, so the board
 * reads as a stable shape rather than rearranging as issues move. The lone
 * exception is "other": it's a fallback, not a lifecycle stage, so we hide it
 * unless something actually lands there.
 */
import { classify } from "../triage/classify.ts";
import { CANONICAL_STATE_ROLES, type TriageMapping } from "../triage/mapping.ts";
import type { Issue } from "../github/issues.ts";

export interface KanbanColumn {
  role: string;
  label: string;
  issues: Issue[];
}

const UNTRIAGED = "untriaged";
const OTHER = "other";

/** Canonical left-to-right column order: untriaged, the states, then other. */
const COLUMN_ORDER: readonly string[] = [
  UNTRIAGED,
  ...CANONICAL_STATE_ROLES,
  OTHER,
];

/** Human-readable column heading — canonical roles are hyphenated; we space them. */
function labelForRole(role: string): string {
  return role.replace(/-/g, " ");
}

export function bucketIssuesByRole(
  issues: Issue[],
  mapping: TriageMapping | null,
): KanbanColumn[] {
  const byRole = new Map<string, Issue[]>();
  for (const role of COLUMN_ORDER) byRole.set(role, []);

  for (const issue of issues) {
    const result = classify(
      issue.labels.map((label) => label.name),
      mapping,
    );
    const role = result.untriaged
      ? UNTRIAGED
      : (result.stateRole ?? OTHER);
    byRole.get(role)!.push(issue);
  }

  return COLUMN_ORDER.filter(
    (role) => role !== OTHER || byRole.get(OTHER)!.length > 0,
  ).map((role) => ({
    role,
    label: labelForRole(role),
    issues: byRole.get(role)!,
  }));
}
