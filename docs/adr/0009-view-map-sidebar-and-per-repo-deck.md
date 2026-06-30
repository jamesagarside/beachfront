# Beachfront is a sidebar SPA: a Shoreline overview and a per-repo mission deck

## Status

proposed

## Context

Today `App.tsx` renders a single flat cross-repo issue list. The target is the full
pane of glass: a navigable app where a Viewer sees every Sandcastle-enabled repo at once
*and* drills into one. This ADR fixes the **view map** — the navigation shell and how the
views are composed — not the internals of the data panes, which are separate slices
(#8 Attention queue, #9 ready-for-agent pool, #10/#11 Agent runs, #7 role classification,
#6 per-repo Mapping). It consumes those; it does not redefine them.

Vocabulary: `CONTEXT.md` flags "dashboard"/"control centre" as terms to avoid — this is the
**pane of glass**, and its home is the **Shoreline**. The *feel* is a control centre; the
*language* stays the project's.

Two constraints shaped the mechanics:

- **Static SPA on GitHub Pages-style hosting under a sub-path (ADR-0001/0005).** Path
  routing 404s on deep-link/reload there without redirect hacks; hash routing is served by
  the single `index.html` with zero server config.
- **The home has two jobs that compete for the top spot.** It must show *everything across
  repos* (the shore — the literal Beachfront metaphor) **and** surface *what needs a human
  now* (the Attention queue, which `CONTEXT.md` calls the primary value). The owner wants
  both first-class, with the Attention queue genuinely prominent.

## Decision

**A single-page app with a persistent sidebar; a rich Shoreline home; a powerful per-repo
deck. Hash routing, no router dependency.**

1. **Sidebar = Shoreline (home) + the list of Managed repos** the Viewer's token can access,
   and nothing else. The cross-repo lenses are **not** separate sidebar entries; they live
   on the Shoreline home. (Deliberate walk-back from an earlier draft that promoted Attention
   and the pool to top-level routes — the lean sidebar matches how the owner navigates and
   avoids bloat before the panes exist. Hash routing makes promoting a lens to its own entry
   a cheap later change if one earns it.)

2. **Routing: hash, no dependency**, behind a small `src/routing/` seam so `react-router`
   can replace it later as a localised change. Routes: `#/` (Shoreline) and
   `#/repo/<owner>/<repo>` using the **canonical Registry key** verbatim. A deep-link
   resolves against the bundled Registry, then gates on the Viewer's token (ADR-0001), with
   honest states — not-linked / token-can't-read / unknown-route → fall back to Shoreline —
   never a blank pane.

3. **The Shoreline home is a full overview carrying both jobs:**
   - a calm **tide-line summary** in the brand voice ("12 repos calm · 3 need you");
   - the cross-repo **Attention queue** (#8) prominently — "what needs you now", given real
     estate, not a thin strip;
   - the **repo grid / shore** — every Managed repo as a card with a health summary (open
     issues, attention count, running agents);
   - the **ready-for-agent pool** (#9) and **running agents** (#11) read as signals (on the
     summary and the cards), not competing top-level blocks.
   When nothing needs a human, the home is simply the calm shore.

4. **The per-repo view is a mission-control deck for that repo's agentic development:**
   - a pinned **Agent-run status** region — running / queued / failed, success vs failure
     (#10/#11/#66) — "agents overlaid on top";
   - the repo's open **issues as a Kanban board**, columns by canonical triage role (#7
     classification via the #6 Mapping), issues as cards, with **per-column counts**;
   - **agentic-dev metrics** — run outcomes over time and **token usage where available**
     (see Consequences).

## Consequences

- Matches the owner's model and the brand: the shore is home, "your turn" surfaces above it
  exactly when it matters, and the language stays "pane of glass / Shoreline" though the feel
  is a control centre.
- **The per-repo deck is richer than the currently-scoped slices** (#65 per-repo issue list,
  #66 agent overlay). New issues should spin out against this ADR: a Kanban board by triage
  role, per-status counts, and a run-metrics panel. Naming them keeps the scope honest rather
  than silently inflating #65/#66.
- **Token usage is not in the GitHub Actions API.** Beachfront sees Agent runs as workflow
  runs; it can show token cost only if **Sandcastle emits it** where Beachfront can read — a
  job summary, an artifact, or a comment. That is a Sandcastle-side dependency and a separate
  issue; until it lands, the metrics panel shows run outcomes without token cost.
- Lean sidebar + hash routing keep the shell cheap and the URLs deep-linkable (`#/repo/...`);
  path routing stays available behind the routing seam if the hosting model changes.
- Reuses Viewer-identity gating (ADR-0001) for every deep-link: a repo the token cannot read
  simply does not render, consistent with the Registry being a list of candidates (ADR-0002).
