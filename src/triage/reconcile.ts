/**
 * The one state-role reconcile shared by both write surfaces (#107): the web
 * write path ({@link setIssueStateRole}) and the MCP set-triage-role tool
 * ({@link runSetTriageRoleTool}) both compute *what to change* here, then apply
 * it through their own transport (Octokit vs local `gh`).
 *
 * "Reconcile the state column" means: leave exactly one state-role label on the
 * issue — the one mapped to `nextRole` — by removing any *other* state-role
 * label and adding the target if it's missing. Category labels (`bug` /
 * `enhancement`) and anything outside the triage vocabulary are never touched.
 */
import {
  CANONICAL_STATE_ROLES,
  defaultTriageMapping,
  type TriageMapping,
  type TriageStateRole,
} from "./mapping.ts";

/** The label changes that move an issue to a single canonical state role. */
export interface StateRoleReconcile {
  /** The repo's label string for the target role (per the Mapping). */
  target: string;
  /** The target label to add, or `null` when it's already present. */
  add: string | null;
  /** Other state-role labels to remove, so exactly one state label remains. */
  remove: string[];
}

/**
 * Computes the label reconcile for moving `currentLabels` to `nextRole`.
 *
 * The fallback is canonicalised here so both surfaces agree: a repo that ships
 * no `triage-labels.md` (`mapping == null`) uses the identity default Mapping,
 * where every role's label is its own name.
 */
export function reconcileStateRole(
  currentLabels: string[],
  mapping: TriageMapping | null | undefined,
  nextRole: TriageStateRole,
): StateRoleReconcile {
  const resolved = mapping ?? defaultTriageMapping();
  const target = resolved.labelForRole[nextRole];
  const stateLabels = new Set(
    CANONICAL_STATE_ROLES.map((role) => resolved.labelForRole[role]),
  );
  const remove = currentLabels.filter(
    (label) => stateLabels.has(label) && label !== target,
  );
  const add = currentLabels.includes(target) ? null : target;
  return { target, add, remove };
}
