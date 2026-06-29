/**
 * Classify an issue into its canonical Triage roles (#7, ADR-0003).
 *
 * Using a repo's {@link TriageMapping}, every label string is resolved back to a
 * canonical role and split into the two kinds the `triage` state machine
 * defines: one *category* role (`bug` / `enhancement`) and one *state* role
 * (`needs-triage`, `ready-for-agent`, …). An issue with no recognized triage
 * label is **untriaged** — it still needs initial triage. An issue whose labels
 * resolve to two roles of the same kind is **flagged** as a conflict, since the
 * state machine expects exactly one of each.
 *
 * A repo without a Mapping (no `docs/agents/` contract) renders with reduced
 * fidelity: no classification at all, not "untriaged" — we simply can't say.
 */
import {
  CANONICAL_CATEGORY_ROLES,
  CANONICAL_STATE_ROLES,
  type TriageCategoryRole,
  type TriageStateRole,
  type TriageMapping,
} from "./mapping.ts";

const CATEGORY_SET: ReadonlySet<string> = new Set(CANONICAL_CATEGORY_ROLES);
const STATE_SET: ReadonlySet<string> = new Set(CANONICAL_STATE_ROLES);

export interface TriageClassification {
  /** The single canonical category role, or null if unset or conflicting. */
  categoryRole: TriageCategoryRole | null;
  /** The single canonical state role, or null if unset or conflicting. */
  stateRole: TriageStateRole | null;
  /** All distinct category roles found (length > 1 ⇒ a category conflict). */
  categoryRoles: TriageCategoryRole[];
  /** All distinct state roles found (length > 1 ⇒ a state conflict). */
  stateRoles: TriageStateRole[];
  /** True when no recognized triage label is present — needs initial triage. */
  untriaged: boolean;
  /** True when labels resolve to more than one role of the same kind. */
  conflict: boolean;
}

/**
 * Resolves an issue's label strings to canonical roles via the repo's Mapping.
 * Pass `null` for a repo that has no Mapping to get an empty classification.
 */
export function classify(
  labels: string[],
  mapping: TriageMapping | null,
): TriageClassification {
  const categoryRoles: TriageCategoryRole[] = [];
  const stateRoles: TriageStateRole[] = [];

  if (mapping) {
    const seen = new Set<string>();
    for (const label of labels) {
      const role = mapping.roleForLabel.get(label);
      if (role === undefined || seen.has(role)) continue;
      seen.add(role);
      if (CATEGORY_SET.has(role)) {
        categoryRoles.push(role as TriageCategoryRole);
      } else if (STATE_SET.has(role)) {
        stateRoles.push(role as TriageStateRole);
      }
    }
  }

  const recognized = categoryRoles.length > 0 || stateRoles.length > 0;
  const conflict = categoryRoles.length > 1 || stateRoles.length > 1;

  return {
    categoryRole: categoryRoles.length === 1 ? categoryRoles[0] : null,
    stateRole: stateRoles.length === 1 ? stateRoles[0] : null,
    categoryRoles,
    stateRoles,
    untriaged: mapping !== null && !recognized,
    conflict,
  };
}
