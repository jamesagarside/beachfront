/**
 * The Shoreline's per-repo health fold (ADR-0009, #64). The home shows every
 * Managed repo the Viewer's token can read as a card carrying a compact health
 * summary — how much is open, how much needs a human, how many agents are in
 * flight — plus a one-line tide-line across them all ("12 repos calm · 3 need
 * you"). This module turns the already-loaded cross-repo issue and run data into
 * that summary; it fetches nothing itself.
 *
 * Attention is counted by reusing the cross-repo Attention queue's own buckets
 * (#8) on one repo at a time, so the card and the queue can never disagree on
 * what "needs a human" means.
 */
import type { RepoRef } from "../config.ts";
import { computeHarnessDrift, type HarnessDrift } from "../core/harnessDrift.ts";
import { currentHarnessVersion } from "../core/harnessVersion.ts";
import { buildAttentionQueue } from "../github/attentionQueue.ts";
import type { RepoRuns } from "../github/runsSummary.ts";
import type { RepoIssues } from "../github/useRegistryIssues.ts";

/** One Managed repo's at-a-glance health for the shore grid. */
export interface RepoHealth {
  repo: RepoRef;
  /** Open issues the token can see in this repo. */
  openIssues: number;
  /** Issues that need a human (untriaged / needs-triage / needs-info reply). */
  attention: number;
  /**
   * Agent runs executing right now. Running only — queued runs are waiting,
   * not working, and the core Shoreline (both surfaces' canonical semantics)
   * counts them the same way; the run summary panel breaks out the queue.
   */
  running: number;
  /** Whether the repo's loop harness is current / behind / unknown (#115). */
  harness: HarnessDrift;
}

export interface ShoreSummary {
  /** Every accessible repo, in Registry order, with its health. */
  repos: RepoHealth[];
  /** Repos with nothing needing a human. */
  calmCount: number;
  /** Repos with at least one issue needing a human. */
  needsYouCount: number;
  /** Issues needing a human, summed across the shore. */
  totalAttention: number;
}

function repoKey({ owner, repo }: RepoRef): string {
  return `${owner}/${repo}`;
}

/**
 * Folds the loaded per-repo issues and runs into the Shoreline summary. Repos
 * are taken from the issues fetch — a repo the token can't read was already
 * dropped there (ADR-0001) and simply never appears on the shore. Runs are
 * joined in by canonical key; a repo whose runs were skipped just reads as zero
 * agents in flight, never an error.
 */
export function buildShoreSummary(
  issues: RepoIssues[],
  runs: RepoRuns[],
  current: string | null = currentHarnessVersion(),
): ShoreSummary {
  const runsByRepo = new Map<string, RepoRuns>();
  for (const entry of runs) runsByRepo.set(repoKey(entry.repo), entry);

  const repos: RepoHealth[] = issues.map((entry) => {
    const queue = buildAttentionQueue([entry]);
    const attention =
      queue.untriaged.length + queue.needsTriage.length + queue.needsInfo.length;

    const repoRuns = runsByRepo.get(repoKey(entry.repo))?.runs ?? [];
    const running = repoRuns.filter((run) => run.status === "running").length;

    return {
      repo: entry.repo,
      openIssues: entry.issues.length,
      attention,
      running,
      // Shared with the MCP surface via the core drift function, so both
      // surfaces give one answer (#115). An absent stamp reads as unknown.
      harness: computeHarnessDrift(
        entry.repo,
        entry.installedHarnessVersion ?? null,
        current,
      ),
    };
  });

  const needsYouCount = repos.filter((r) => r.attention > 0).length;
  const totalAttention = repos.reduce((sum, r) => sum + r.attention, 0);

  return {
    repos,
    calmCount: repos.length - needsYouCount,
    needsYouCount,
    totalAttention,
  };
}

/**
 * The calm tide-line summary sentence in the brand voice — "12 repos calm · 3
 * need you", or just "12 repos calm" when nothing needs a human. Empty shore
 * reads plainly. Coral is reserved for the "need you" clause at the render site;
 * this returns only the text.
 */
export function tideLine(summary: ShoreSummary): string {
  const total = summary.repos.length;
  if (total === 0) return "No repos linked yet.";

  const repoWord = total === 1 ? "repo" : "repos";
  if (summary.needsYouCount === 0) {
    return `${total} ${repoWord} · all calm`;
  }
  return `${summary.calmCount} of ${total} ${repoWord} calm · ${summary.needsYouCount} need you`;
}
