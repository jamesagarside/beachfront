/**
 * The per-repo mission-deck view-model (#85, ADR-0010): one repo's board, built
 * purely from its aggregated {@link RepoEstate} so the web SPA and the MCP App
 * render the same deck. It produces two things the deck pins together:
 *
 * - a **Kanban** bucketing of open issues by canonical triage state role
 *   (#7 via the #6 Mapping), in lifecycle order — issues with no single state
 *   role (untriaged, conflicting, or category-only) fall into `untriaged`, the
 *   board's catch-all left column;
 * - a **run summary** over the repo's Agent runs (#10) — counts per status plus
 *   a success rate over finished runs — the pinned run/metrics strip.
 *
 * A repo with no Mapping can't be classified (ADR-0003); every issue then lands
 * in `untriaged`, which reads honestly as "not yet placed".
 */
import { classify } from "../triage/classify.ts";
import type { RepoRef } from "../config.ts";
import type { Issue } from "../github/issues.ts";
import type { AgentRun } from "../github/runs.ts";
import { CANONICAL_STATE_ROLES } from "../triage/mapping.ts";
import type { RepoEstate } from "./estate.ts";

/**
 * The board's columns, in lifecycle order: `untriaged` first (the rawest /
 * catch-all column), then the canonical state roles from needs-triage through
 * wontfix. Defined once here so both surfaces order the board identically.
 */
export const DECK_COLUMN_ORDER = [
  "untriaged",
  ...CANONICAL_STATE_ROLES,
] as const;

export type DeckColumnKey = (typeof DECK_COLUMN_ORDER)[number];

export interface DeckColumn {
  role: DeckColumnKey;
  issues: Issue[];
}

/** Counts per Agent-run status, plus a success rate over finished runs. */
export interface RunSummary {
  total: number;
  running: number;
  queued: number;
  succeeded: number;
  failed: number;
  /** succeeded / (succeeded + failed), or null when no run has finished. */
  successRate: number | null;
}

export interface RepoDeck {
  repo: RepoRef;
  columns: DeckColumn[];
  /** Per-column issue counts, keyed by role (the per-status summary, #81). */
  counts: Record<DeckColumnKey, number>;
  runs: RunSummary;
}

/** Which board column an issue belongs to — its state role, else untriaged. */
function columnFor(issue: Issue, repo: RepoEstate): DeckColumnKey {
  const roles = classify(
    issue.labels.map((label) => label.name),
    repo.mapping,
  );
  return roles.stateRole ?? "untriaged";
}

function summariseRuns(runs: AgentRun[]): RunSummary {
  const summary: RunSummary = {
    total: runs.length,
    running: 0,
    queued: 0,
    succeeded: 0,
    failed: 0,
    successRate: null,
  };
  for (const run of runs) {
    if (run.status === "running") summary.running++;
    else if (run.status === "queued") summary.queued++;
    else if (run.status === "succeeded") summary.succeeded++;
    else summary.failed++;
  }
  const finished = summary.succeeded + summary.failed;
  if (finished > 0) summary.successRate = summary.succeeded / finished;
  return summary;
}

/** Builds the per-repo deck view-model from one repo's aggregated estate. */
export function buildRepoDeck(repo: RepoEstate): RepoDeck {
  const byRole = {} as Record<DeckColumnKey, Issue[]>;
  for (const role of DECK_COLUMN_ORDER) byRole[role] = [];
  for (const issue of repo.issues) byRole[columnFor(issue, repo)].push(issue);

  const columns: DeckColumn[] = DECK_COLUMN_ORDER.map((role) => ({
    role,
    issues: byRole[role],
  }));
  const counts = {} as Record<DeckColumnKey, number>;
  for (const role of DECK_COLUMN_ORDER) counts[role] = byRole[role].length;

  return { repo: repo.repo, columns, counts, runs: summariseRuns(repo.runs) };
}
