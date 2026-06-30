/**
 * The per-repo **Kanban MCP App** UI resource (#88, ADR-0010). MCP Apps let a
 * server return interactive UI a host like Claude Desktop renders inline; this
 * module is the deck's renderer — a pure function from the serialisable
 * {@link RepoDeckView} to a self-contained `text/html` document, so it is fully
 * unit-testable and the plugin entry only has to hand the host the string.
 *
 * The deck pins a **run/metrics strip** (#82) over a **Kanban board** bucketed by
 * triage role (#80) — the same shape the web SPA's deck draws, both from the
 * shared core's {@link buildRepoDeck}. Brand voice holds (docs/brand.md): coral
 * is reserved for the "needs you" column, tide teal for fed/handled states,
 * driftwood grey for the calm rest. Non-UI hosts get {@link renderRepoDeckText}
 * instead; this is the progressive-enhancement layer, never the floor.
 */
import type { DeckColumnKey } from "../core/repoDeck.ts";
import type { RepoDeckView } from "./repoDeckView.ts";

/** Escape text for safe interpolation into HTML (titles are user content). */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * The accent each column carries, per the brand's semantic palette: coral marks
 * the columns that need a human, tide teal the fed/handled ones, driftwood grey
 * the calm rest. Used only as a thin top-border so the board stays calm.
 */
const CORAL = "#e8745c";
const TIDE = "#3aa6a0";
const DRIFTWOOD = "#9aa5a3";

const COLUMN_ACCENT: Record<DeckColumnKey, string> = {
  untriaged: DRIFTWOOD,
  "needs-triage": CORAL,
  "needs-info": CORAL,
  "ready-for-agent": TIDE,
  "ready-for-human": CORAL,
  wontfix: DRIFTWOOD,
};

/** A human label for a board column (roles are already kebab-case + calm). */
function columnTitle(role: DeckColumnKey): string {
  return role;
}

function renderCard(card: { number: number; title: string; url: string }): string {
  return (
    `<a class="card" href="${escapeHtml(card.url)}" target="_blank" rel="noopener">` +
    `<span class="num">#${card.number}</span>` +
    `<span class="title">${escapeHtml(card.title)}</span>` +
    `</a>`
  );
}

function renderColumn(column: RepoDeckView["columns"][number]): string {
  const accent = COLUMN_ACCENT[column.role];
  const cards =
    column.cards.length > 0
      ? column.cards.map(renderCard).join("")
      : `<p class="empty">—</p>`;
  return (
    `<section class="col" style="border-top-color:${accent}">` +
    `<h2>${escapeHtml(columnTitle(column.role))}` +
    `<span class="count">${column.cards.length}</span></h2>` +
    `<div class="cards">${cards}</div>` +
    `</section>`
  );
}

/** The pinned run/metrics strip (#82): counts plus success rate where known. */
function renderRunStrip(runs: RepoDeckView["runs"]): string {
  if (runs.total === 0) {
    return `<div class="runs"><span class="metric">no runs yet</span></div>`;
  }
  const rate =
    runs.successRate === null
      ? ""
      : `<span class="metric">${Math.round(runs.successRate * 100)}% success</span>`;
  return (
    `<div class="runs">` +
    `<span class="metric">${runs.running} running</span>` +
    `<span class="metric">${runs.queued} queued</span>` +
    `<span class="metric">${runs.succeeded} succeeded</span>` +
    `<span class="metric">${runs.failed} failed</span>` +
    rate +
    `</div>`
  );
}

/** Renders one repo's mission deck as a self-contained Kanban HTML document. */
export function renderDeckHtml(view: RepoDeckView): string {
  const slug = escapeHtml(`${view.owner}/${view.repo}`);
  const columns = view.columns.map(renderColumn).join("");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${slug} — Beachfront deck</title>
<style>
  :root { color-scheme: light dark; }
  body { margin: 0; font: 14px/1.5 system-ui, sans-serif; color: #1f2a2b; background: #f6f8f7; }
  header { padding: 16px 20px 8px; }
  header h1 { margin: 0; font-size: 18px; font-weight: 600; }
  .runs { position: sticky; top: 0; display: flex; flex-wrap: wrap; gap: 8px;
    padding: 8px 20px 12px; background: #f6f8f7; }
  .metric { padding: 2px 10px; border-radius: 999px; background: #e5ecea; font-size: 12px; }
  .board { display: flex; gap: 12px; padding: 4px 20px 24px; overflow-x: auto; align-items: flex-start; }
  .col { flex: 0 0 220px; background: #fff; border-radius: 10px; border-top: 3px solid ${DRIFTWOOD};
    box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
  .col h2 { margin: 0; padding: 10px 12px; font-size: 13px; font-weight: 600;
    display: flex; justify-content: space-between; align-items: center; }
  .col .count { background: #eef2f1; border-radius: 999px; padding: 0 8px; font-size: 12px; color: #5a6664; }
  .cards { display: flex; flex-direction: column; gap: 6px; padding: 0 10px 12px; }
  .card { display: block; text-decoration: none; color: inherit; padding: 8px 10px;
    border-radius: 8px; background: #f7faf9; border: 1px solid #e7eeec; }
  .card:hover { background: #eef4f2; }
  .card .num { color: #5a6664; font-size: 12px; margin-right: 6px; }
  .empty { color: ${DRIFTWOOD}; text-align: center; margin: 6px 0 0; }
</style>
</head>
<body>
<header><h1>${slug}</h1></header>
${renderRunStrip(view.runs)}
<main class="board">${columns}</main>
</body>
</html>`;
}
