/**
 * Per-status issue counts for a repo's mission deck (#81, ADR-0009).
 *
 * A mission deck wants a single calm glance: how many issues sit in each triage
 * state. This counts a repo's open issues by canonical state role via the same
 * {@link classify} the rest of Beachfront uses, so the deck's summary can never
 * drift from the Attention queue or the ready-for-agent pool. Untriaged issues
 * get their own bucket; an issue with only a category role (or none we
 * recognise) belongs to no state and is simply left uncounted — it's open, and
 * that's all the deck claims. We always return every canonical role, zeros
 * included, so the presentation layer owns the "what to show" decision.
 */
import type { Issue } from "../github/issues.ts";
import { classify } from "../triage/classify.ts";
import { CANONICAL_STATE_ROLES, type TriageMapping } from "../triage/mapping.ts";

export interface StatusCount {
  role: string;
  count: number;
}

/** The roles we report, in display order: untriaged first, then the states. */
const REPORTED_ROLES = ["untriaged", ...CANONICAL_STATE_ROLES] as const;

export function countIssuesByRole(
  issues: Issue[],
  mapping: TriageMapping | null,
): StatusCount[] {
  const counts = new Map<string, number>();
  for (const role of REPORTED_ROLES) counts.set(role, 0);

  for (const issue of issues) {
    const labels = issue.labels.map((label) => label.name);
    const result = classify(labels, mapping);

    const bucket = result.untriaged ? "untriaged" : result.stateRole;
    // category-only / unclassifiable issues fall through with no state role.
    if (bucket && counts.has(bucket)) {
      counts.set(bucket, counts.get(bucket)! + 1);
    }
  }

  return REPORTED_ROLES.map((role) => ({ role, count: counts.get(role)! }));
}
