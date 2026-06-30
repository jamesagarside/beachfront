/**
 * The estate tool's view-model and text rendering (#86, ADR-0010). The plugin's
 * estate tool must work in **any** MCP host, terminal included, so it returns
 * two things from one aggregation: a serialisable {@link EstateView} (the
 * tool's `structuredContent`, for hosts and the later UI resources, #87) and a
 * calm plaintext rendering (the floor everywhere a UI can't render).
 *
 * Both are built purely from an aggregated {@link Estate} by reusing the shared
 * core's view builders — {@link buildShoreline} for the cross-repo tide-line and
 * Attention figures, {@link buildRepoDeck} for each repo's per-role bucketing —
 * so the plugin's text and the web SPA cannot drift. Coral-reserved-for-attention
 * is a colour concern for the renderers above; this layer only produces numbers
 * and plainspoken lines (docs/brand.md).
 */
import type { AttentionBucket, AttentionItem } from "../github/attentionQueue.ts";
import type { Estate } from "../core/estate.ts";
import {
  buildRepoDeck,
  DECK_COLUMN_ORDER,
  type DeckColumnKey,
} from "../core/repoDeck.ts";
import { buildShoreline, type TideLine } from "../core/shoreline.ts";

/** A non-zero triage-role bucket for a repo (the board, summarised). */
export interface RepoRoleCount {
  role: DeckColumnKey;
  count: number;
}

/** One cross-repo Attention-queue item — an issue that needs a human (#8). */
export interface EstateAttentionItem {
  owner: string;
  repo: string;
  number: number;
  title: string;
  url: string;
  /** Which Attention bucket surfaced it: untriaged / needs-triage / needs-info. */
  bucket: AttentionBucket;
}

/** One repo's line in the estate: counts plus its triage-role breakdown. */
export interface EstateRepoView {
  owner: string;
  repo: string;
  openCount: number;
  /** Issues needing a human (the repo's Attention buckets summed). */
  attentionCount: number;
  /** Agent runs currently running for the repo. */
  runningCount: number;
  /** Per-canonical-role issue counts, in board order, zero buckets omitted. */
  roles: RepoRoleCount[];
}

/** The whole estate as a serialisable, render-agnostic shape. */
export interface EstateView {
  tideLine: TideLine;
  /** The cross-repo Attention queue — what needs you, oldest-first (#8). */
  attention: EstateAttentionItem[];
  repos: EstateRepoView[];
  /** Repos the source couldn't read — surfaced, never silently dropped. */
  skipped: { owner: string; repo: string }[];
}

/** Flattens one Attention bucket's items into the serialisable view shape. */
function toAttention(
  items: AttentionItem[],
  bucket: AttentionBucket,
): EstateAttentionItem[] {
  return items.map(({ repo, issue }) => ({
    owner: repo.owner,
    repo: repo.repo,
    number: issue.number,
    title: issue.title,
    url: issue.url,
    bucket,
  }));
}

/** Builds the estate view-model from an aggregated estate. */
export function buildEstateView(estate: Estate): EstateView {
  const shoreline = buildShoreline(estate);
  // Flatten the cross-repo queue in bucket order; each bucket is oldest-first.
  const attention: EstateAttentionItem[] = [
    ...toAttention(shoreline.attention.untriaged, "untriaged"),
    ...toAttention(shoreline.attention.needsTriage, "needs-triage"),
    ...toAttention(shoreline.attention.needsInfo, "needs-info"),
  ];

  const repos: EstateRepoView[] = estate.repos.map((repoEstate, i) => {
    const deck = buildRepoDeck(repoEstate);
    const roles = DECK_COLUMN_ORDER.filter((role) => deck.counts[role] > 0).map(
      (role) => ({ role, count: deck.counts[role] }),
    );
    return {
      owner: repoEstate.repo.owner,
      repo: repoEstate.repo.repo,
      openCount: repoEstate.issues.length,
      // shoreline.repos mirrors estate.repos order, so the index aligns.
      attentionCount: shoreline.repos[i].attentionCount,
      runningCount: deck.runs.running,
      roles,
    };
  });

  return {
    tideLine: shoreline.tideLine,
    attention,
    repos,
    skipped: estate.skipped.map(({ owner, repo }) => ({ owner, repo })),
  };
}

/** Pluralise a count with its noun: `1 repo`, `2 repos`. */
function count(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? "" : "s"}`;
}

/** A repo's per-role breakdown as `2 ready-for-agent · 1 needs-triage`. */
function rolesLine(roles: RepoRoleCount[]): string {
  if (roles.length === 0) return "no triage labels yet";
  return roles.map((r) => `${r.count} ${r.role}`).join(" · ");
}

/**
 * Renders the estate as calm, plainspoken text for non-UI hosts. Mirrors the
 * brand voice ("1 repo calm · 3 need you", never alarms): a tide-line header,
 * one line per repo with its counts and triage breakdown, and a closing note for
 * any repos that couldn't be read.
 */
export function renderEstateText(view: EstateView): string {
  const { tideLine } = view;
  const lines: string[] = [];

  lines.push(
    `Beachfront — ${count(tideLine.repoCount, "repo")} · ` +
      `${count(tideLine.openCount, "open issue")} · ` +
      `${tideLine.attentionCount} need you · ` +
      `${tideLine.runningCount} running`,
  );

  if (view.repos.length === 0) {
    lines.push("No repos to show yet — link one with `beachfront link`.");
  }

  for (const repo of view.repos) {
    lines.push(
      `\n${repo.owner}/${repo.repo} — ${count(repo.openCount, "open")} · ` +
        `${repo.attentionCount} need you · ${repo.runningCount} running`,
    );
    lines.push(`  ${rolesLine(repo.roles)}`);
  }

  if (view.skipped.length > 0) {
    const names = view.skipped.map((r) => `${r.owner}/${r.repo}`).join(", ");
    lines.push(`\nSkipped (couldn't read): ${names}`);
  }

  return lines.join("\n");
}
