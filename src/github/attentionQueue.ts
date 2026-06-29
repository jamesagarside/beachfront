/**
 * The cross-repo Attention queue (#8): the role-driven surfacing of issues that
 * need a human, spanning every Managed repo. It mirrors the `triage` skill's
 * "what needs attention" buckets (CONTEXT.md, ADR-0003):
 *
 * - **untriaged** — no recognized triage label yet (needs initial triage)
 * - **needs-triage** — labelled `needs-triage`, awaiting a decision
 * - **needs-info** — labelled `needs-info` *and* the reporter has responded,
 *   so there's a reply to act on
 *
 * Issues in a handled state (`ready-for-agent`, `ready-for-human`, `wontfix`)
 * and `needs-info` issues with no reporter activity are not the human's problem
 * and stay out of the queue. A repo with no Mapping can't be classified at all
 * (ADR-0003) and contributes nothing.
 */
import type { RepoRef } from "../config.ts";
import { classify } from "../triage/classify.ts";
import type { TriageMapping } from "../triage/mapping.ts";
import type { Issue } from "./issues.ts";
import type { RepoIssues } from "./useRegistryIssues.ts";

export type AttentionBucket = "untriaged" | "needs-triage" | "needs-info";

/** One issue in the queue, carrying the repo it came from. */
export interface AttentionItem {
  repo: RepoRef;
  issue: Issue;
}

export interface AttentionQueue {
  untriaged: AttentionItem[];
  needsTriage: AttentionItem[];
  needsInfo: AttentionItem[];
}

/**
 * A `needs-info` issue re-enters the Attention queue once the reporter has
 * responded — there's a reply to read. Without the label-event timeline we use
 * the cheapest faithful proxy the issues list affords: the issue has at least
 * one comment, i.e. the conversation has moved since it was opened.
 */
export function hasReporterActivity(issue: Issue): boolean {
  return issue.comments > 0;
}

/** Which Attention bucket an issue belongs to, or null if it needs no human. */
function bucketFor(
  issue: Issue,
  mapping: TriageMapping | null,
): AttentionBucket | null {
  const roles = classify(
    issue.labels.map((label) => label.name),
    mapping,
  );
  if (roles.untriaged) return "untriaged";
  if (roles.stateRole === "needs-triage") return "needs-triage";
  if (roles.stateRole === "needs-info" && hasReporterActivity(issue)) {
    return "needs-info";
  }
  return null;
}

function byAge(a: AttentionItem, b: AttentionItem): number {
  return (
    new Date(a.issue.createdAt).getTime() - new Date(b.issue.createdAt).getTime()
  );
}

/**
 * Builds the cross-repo Attention queue from the loaded per-repo issues. Each
 * bucket spans every repo and is ordered oldest-first, so the longest-waiting
 * work surfaces at the top.
 */
export function buildAttentionQueue(repos: RepoIssues[]): AttentionQueue {
  const untriaged: AttentionItem[] = [];
  const needsTriage: AttentionItem[] = [];
  const needsInfo: AttentionItem[] = [];

  for (const { repo, issues, mapping } of repos) {
    for (const issue of issues) {
      const item: AttentionItem = { repo, issue };
      switch (bucketFor(issue, mapping)) {
        case "untriaged":
          untriaged.push(item);
          break;
        case "needs-triage":
          needsTriage.push(item);
          break;
        case "needs-info":
          needsInfo.push(item);
          break;
      }
    }
  }

  untriaged.sort(byAge);
  needsTriage.sort(byAge);
  needsInfo.sort(byAge);
  return { untriaged, needsTriage, needsInfo };
}
