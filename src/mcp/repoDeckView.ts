/**
 * The per-repo deck tool's view-model and text rendering (#88, ADR-0010). Like
 * the estate tool ({@link buildEstateView}), the deck tool must work in **any**
 * MCP host, so it returns two things from one aggregation: a serialisable
 * {@link RepoDeckView} (the tool's `structuredContent`, which the Kanban MCP App
 * resource renders, #88) and a calm plaintext rendering (the floor everywhere a
 * UI can't draw the board).
 *
 * Both are built purely from one repo's aggregated {@link RepoEstate} by reusing
 * the shared core's {@link buildRepoDeck} — the same bucketing-by-triage-role and
 * run summary the web SPA's deck draws from — so the plugin's board and the web
 * board cannot drift. Coral-reserved-for-attention is a colour concern for the
 * renderers above; this layer only produces numbers and plainspoken lines.
 */
import type { RepoEstate } from "../core/estate.ts";
import {
  buildRepoDeck,
  type DeckColumnKey,
  type RunSummary,
} from "../core/repoDeck.ts";

/** One issue card on the board — the essentials a card and a link need. */
export interface DeckCard {
  number: number;
  title: string;
  url: string;
}

/** One board column: a canonical role and the cards bucketed into it. */
export interface DeckColumnView {
  role: DeckColumnKey;
  cards: DeckCard[];
}

/** One repo's mission deck as a serialisable, render-agnostic shape. */
export interface RepoDeckView {
  owner: string;
  repo: string;
  /** Every board column in lifecycle order, empty columns included. */
  columns: DeckColumnView[];
  /** Per-column issue counts, keyed by role (#81). */
  counts: Record<DeckColumnKey, number>;
  /** The pinned run/metrics strip (#82). */
  runs: RunSummary;
}

/** Builds the per-repo deck view-model from one repo's aggregated estate. */
export function buildRepoDeckView(repo: RepoEstate): RepoDeckView {
  const deck = buildRepoDeck(repo);
  return {
    owner: deck.repo.owner,
    repo: deck.repo.repo,
    columns: deck.columns.map((column) => ({
      role: column.role,
      cards: column.issues.map((issue) => ({
        number: issue.number,
        title: issue.title,
        url: issue.url,
      })),
    })),
    counts: deck.counts,
    runs: deck.runs,
  };
}

/** Pluralise a count with its noun: `1 run`, `2 runs`. */
function count(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? "" : "s"}`;
}

/** The non-empty roles as `1 ready-for-agent · 2 needs-info`, board order. */
function rolesLine(view: RepoDeckView): string {
  const parts = view.columns
    .filter((column) => column.cards.length > 0)
    .map((column) => `${column.cards.length} ${column.role}`);
  return parts.length > 0 ? parts.join(" · ") : "no open issues";
}

/** The pinned run/metrics strip as a calm one-liner. */
function runsLine(runs: RunSummary): string {
  if (runs.total === 0) return "Runs — no runs yet";
  const parts = [
    `${runs.running} running`,
    `${runs.queued} queued`,
    `${runs.succeeded} succeeded`,
    `${runs.failed} failed`,
  ];
  if (runs.successRate !== null) {
    parts.push(`${Math.round(runs.successRate * 100)}% success`);
  }
  return `Runs — ${parts.join(" · ")}`;
}

/**
 * Renders the deck as calm, plainspoken text for non-UI hosts: a header with the
 * repo and its per-role summary, the pinned run strip, then each non-empty column
 * with its cards. Mirrors the brand voice — no alarms, coral is the renderer's
 * job, not this layer's.
 */
export function renderRepoDeckText(view: RepoDeckView): string {
  const lines: string[] = [];

  lines.push(`${view.owner}/${view.repo} — ${rolesLine(view)}`);
  lines.push(runsLine(view.runs));

  for (const column of view.columns) {
    if (column.cards.length === 0) continue;
    lines.push(`\n${column.role} (${count(column.cards.length, "issue")})`);
    for (const card of column.cards) {
      lines.push(`  #${card.number} ${card.title}  ${card.url}`);
    }
  }

  return lines.join("\n");
}
