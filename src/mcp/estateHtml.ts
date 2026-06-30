/**
 * The **Shoreline estate MCP App** UI resource (#87, ADR-0010) — the estate-level
 * sibling of the per-repo {@link renderDeckHtml Kanban App}. MCP Apps let a server
 * return interactive UI a host like Claude Desktop renders inline; this module is
 * the Shoreline's renderer — a pure function from the serialisable
 * {@link EstateView} to a self-contained `text/html` document, so it is fully
 * unit-testable and the plugin entry only hands the host the string.
 *
 * It draws the same three panes the web SPA's Shoreline draws, all from the shared
 * core's view-model: the **tide-line summary** (calm one-glance totals), the
 * cross-repo **Attention queue** (#8), and the **repo shore grid** with health
 * chips (open / running / fed). Selecting a repo asks the host to call the per-repo
 * deck tool ({@link REPO_DECK_TOOL_NAME}, #88) so the Viewer zooms from shore to
 * deck without leaving the App.
 *
 * Brand holds (docs/brand.md): **coral is reserved for the Attention queue** — the
 * one place "warm" means "your turn" — tide teal marks fed/handled states, and the
 * calm rest stays in deep-sea ink on sand. Non-UI hosts get
 * {@link renderEstateText} instead; this is the progressive-enhancement layer.
 */
import { REPO_DECK_TOOL_NAME } from "./repoDeckTool.ts";
import type { EstateAttentionItem, EstateRepoView, EstateView } from "./estateView.ts";

/** The locked brand palette (docs/brand.md) — semantic, never decorative. */
const SAND = "#E9DCC3";
const DEEP_SEA = "#0B4F6C";
const TIDE_TEAL = "#1B998B";
const CORAL = "#FF8C61"; // reserved strictly for the Attention queue
const DRIFTWOOD = "#8A8580";

/** Escape text for safe interpolation into HTML (titles are user content). */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Pluralise a count with its noun: `1 repo`, `2 repos`. */
function count(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? "" : "s"}`;
}

/** The ready-for-agent ("fed") count for a repo — 0 when the bucket is empty. */
function fedCount(repo: EstateRepoView): number {
  return repo.roles.find((r) => r.role === "ready-for-agent")?.count ?? 0;
}

/**
 * The sunset/horizon mark (docs/brand.md): a pane framing a horizon line with the
 * sun on the tide. Inline SVG so the document stays self-contained.
 */
function brandMark(): string {
  return (
    `<svg class="mark" viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">` +
    `<rect x="1.5" y="1.5" width="29" height="29" rx="5" fill="${SAND}" stroke="${DEEP_SEA}" stroke-width="1.5"/>` +
    `<circle cx="16" cy="19" r="5" fill="${CORAL}"/>` +
    `<line x1="4" y1="19" x2="28" y2="19" stroke="${DEEP_SEA}" stroke-width="1.5"/>` +
    `</svg>`
  );
}

/** The calm tide-line summary — the one-glance totals across the estate. */
function renderTideLine(view: EstateView): string {
  const { tideLine } = view;
  return (
    `<header class="tide">${brandMark()}` +
    `<h1>Beachfront</h1>` +
    `<p class="totals">${count(tideLine.repoCount, "repo")} · ` +
    `${count(tideLine.openCount, "open issue")} · ` +
    `<span class="attn">${tideLine.attentionCount} need you</span> · ` +
    `${tideLine.runningCount} running</p>` +
    `</header>`
  );
}

/** One Attention-queue row: bucket, repo, issue — the only coral on the page. */
function renderAttentionItem(item: EstateAttentionItem): string {
  const slug = escapeHtml(`${item.owner}/${item.repo}`);
  return (
    `<a class="attn-item" href="${escapeHtml(item.url)}" target="_blank" rel="noopener">` +
    `<span class="bucket">${escapeHtml(item.bucket)}</span>` +
    `<span class="where">${slug} #${item.number}</span>` +
    `<span class="what">${escapeHtml(item.title)}</span>` +
    `</a>`
  );
}

/** The cross-repo Attention queue (#8) — what needs a human, oldest-first. */
function renderAttention(view: EstateView): string {
  if (view.attention.length === 0) {
    return (
      `<section class="attention calm">` +
      `<h2>Attention queue</h2>` +
      `<p class="empty">Nothing needs you right now — the shore is calm.</p>` +
      `</section>`
    );
  }
  const items = view.attention.map(renderAttentionItem).join("");
  return (
    `<section class="attention">` +
    `<h2>Attention queue<span class="count">${view.attention.length}</span></h2>` +
    `<div class="attn-list">${items}</div>` +
    `</section>`
  );
}

/** One repo's shore tile: health chips plus a select-to-deck action (#88). */
function renderRepoTile(repo: EstateRepoView): string {
  const slug = `${repo.owner}/${repo.repo}`;
  const fed = fedCount(repo);
  // The whole tile is a button: selecting it asks the host to open this repo's
  // deck (REPO_DECK_TOOL_NAME), so the Viewer zooms from shore to deck in-App.
  return (
    `<button type="button" class="tile" data-owner="${escapeHtml(repo.owner)}" ` +
    `data-repo="${escapeHtml(repo.repo)}">` +
    `<span class="slug">${escapeHtml(slug)}</span>` +
    `<span class="chips">` +
    `<span class="chip open">${repo.openCount} open</span>` +
    `<span class="chip running">${repo.runningCount} running</span>` +
    `<span class="chip fed">${fed} fed</span>` +
    (repo.attentionCount > 0
      ? `<span class="chip need">${repo.attentionCount} need you</span>`
      : "") +
    `</span>` +
    `</button>`
  );
}

/** The repo shore grid — one health tile per linked repo. */
function renderShoreGrid(view: EstateView): string {
  if (view.repos.length === 0) {
    return (
      `<section class="grid-wrap">` +
      `<h2>The shore</h2>` +
      `<p class="empty">No repos linked yet — add one with <code>beachfront link</code>.</p>` +
      `</section>`
    );
  }
  const tiles = view.repos.map(renderRepoTile).join("");
  return (
    `<section class="grid-wrap"><h2>The shore</h2>` +
    `<div class="grid">${tiles}</div></section>`
  );
}

/** A calm closing note for repos the source couldn't read. */
function renderSkipped(view: EstateView): string {
  if (view.skipped.length === 0) return "";
  const names = view.skipped
    .map((r) => escapeHtml(`${r.owner}/${r.repo}`))
    .join(", ");
  return `<p class="skipped">Couldn't read: ${names}</p>`;
}

/**
 * The bridge that turns a repo-tile click into a host tool call. MCP App UI runs
 * in a host frame and asks the host to act via `postMessage`; selecting a tile
 * requests the per-repo deck tool for that repo. Hosts that don't wire the bridge
 * simply do nothing — the text fallback and the per-tile data stay intact.
 */
function selectionScript(): string {
  return (
    `<script>(function(){` +
    `var TOOL=${JSON.stringify(REPO_DECK_TOOL_NAME)};` +
    `document.querySelectorAll(".tile").forEach(function(t){` +
    `t.addEventListener("click",function(){` +
    `var msg={type:"tool",tool:TOOL,arguments:{owner:t.dataset.owner,repo:t.dataset.repo}};` +
    `if(window.parent){window.parent.postMessage(msg,"*");}` +
    `});});})();</script>`
  );
}

/** Renders the whole estate as a self-contained Shoreline HTML document. */
export function renderEstateHtml(view: EstateView): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Beachfront — Shoreline</title>
<style>
  :root { color-scheme: light; }
  body { margin: 0; font: 14px/1.5 Inter, system-ui, sans-serif; color: ${DEEP_SEA}; background: ${SAND}; }
  .tide { display: flex; align-items: center; gap: 10px; padding: 16px 20px 8px; flex-wrap: wrap; }
  .tide h1 { margin: 0; font-size: 20px; font-weight: 600; letter-spacing: -0.01em; }
  .tide .totals { margin: 0 0 0 auto; font-size: 14px; color: ${DEEP_SEA}; }
  .tide .attn { color: ${CORAL}; font-weight: 600; }
  h2 { margin: 0 0 8px; font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 8px;
    text-transform: uppercase; letter-spacing: 0.04em; color: ${DRIFTWOOD}; }
  h2 .count { background: ${CORAL}; color: #fff; border-radius: 999px; padding: 0 8px; font-size: 12px;
    text-transform: none; letter-spacing: 0; }
  section { padding: 8px 20px 16px; }
  .attention { border-top: 2px solid ${CORAL}; }
  .attn-list { display: flex; flex-direction: column; gap: 6px; }
  .attn-item { display: flex; align-items: baseline; gap: 10px; text-decoration: none; color: inherit;
    padding: 8px 10px; border-radius: 8px; background: #fff; border: 1px solid #efe6d2; }
  .attn-item:hover { background: #fffdf8; }
  .attn-item .bucket { color: ${CORAL}; font-weight: 600; font-size: 12px; flex: 0 0 auto; }
  .attn-item .where { color: ${DRIFTWOOD}; font-size: 12px; flex: 0 0 auto; }
  .attn-item .what { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; }
  .tile { text-align: left; cursor: pointer; font: inherit; color: inherit; padding: 12px;
    border-radius: 10px; background: #fff; border: 1px solid #efe6d2; box-shadow: 0 1px 2px rgba(0,0,0,0.04);
    display: flex; flex-direction: column; gap: 8px; }
  .tile:hover { border-color: ${TIDE_TEAL}; }
  .tile .slug { font-weight: 600; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip { font-size: 12px; padding: 1px 8px; border-radius: 999px; background: #f3ead6; color: ${DRIFTWOOD}; }
  .chip.running, .chip.fed { background: rgba(27,153,139,0.14); color: ${TIDE_TEAL}; }
  .chip.need { background: rgba(255,140,97,0.18); color: ${CORAL}; font-weight: 600; }
  .empty { color: ${DRIFTWOOD}; margin: 4px 0 0; }
  .skipped { padding: 0 20px 20px; color: ${DRIFTWOOD}; font-size: 12px; }
  code { background: #f3ead6; padding: 0 4px; border-radius: 4px; }
</style>
</head>
<body>
${renderTideLine(view)}
${renderAttention(view)}
${renderShoreGrid(view)}
${renderSkipped(view)}
${selectionScript()}
</body>
</html>`;
}
