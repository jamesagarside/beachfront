# Beachfront is MCP-plugin-first: the rich experience is an MCP App in Claude Desktop, the web is a secondary read view

## Status

proposed

Supersedes the hosted-session approach of ADR-0008 for v1 (see Consequences); ADR-0009's
information architecture now describes the *secondary* (web) surface.

## Context

Pinning down the interactive issue-authoring session (#61, ADR-0008) kept running into the
same wall: any *hosted* interactive session needs a place to run Claude and a credential,
and the subscription `CLAUDE_CODE_OAUTH_TOKEN` only works through the Claude Code harness,
never the raw API — so a browser/Worker can't use it, and a Node relay (Actions or a
container on Cloud Run/Vercel/Fly) plus a hosting/auth story is required. A lot of
machinery for a chat that drafts issues.

Two facts change the calculus:

- **MCP Apps shipped (Jan 26 2026).** An MCP server can declare **UI resources** that the
  host renders inline as interactive components (dashboards, kanban, live status). So an MCP
  server *is* a UI delivery mechanism, not just tools.
- **The developer already runs an authed Claude locally.** Claude Desktop/Code is logged
  into their subscription, and local `gh` carries their GitHub access. A *local* MCP plugin
  needs **no** credential handling, no relay, no CORS, no hosting — the very problems
  ADR-0008 was wrestling with vanish.

Beachfront already lives in this ecosystem (Sandcastle, Claude Code, Matt Pocock skills), so
delivering it as a Claude plugin is native, not a detour.

## Decision

**Beachfront's primary surface is a Claude plugin — an MCP server — and the web SPA becomes
a secondary read-only companion.**

1. **One MCP server, two modes — interactive *and* text-driven.** It exposes the estate
   (Aggregation), Triage, issue authoring, and Agent status as **tools** (text-driven, work
   in any MCP host including the terminal) and as **MCP App UI resources** (interactive
   panels — the Shoreline estate view and the per-repo kanban deck — rendered in Claude
   Desktop). The same tool backs both: a Viewer can click the board or just say "hand #64 to
   an agent." Rich UI is progressive enhancement; text is the floor everywhere.

2. **v1 targets Claude Desktop and handles no auth.** Model access comes from the
   developer's local Claude (subscription); GitHub access comes from local `gh`. Beachfront
   stores no credentials. This is the whole reason v1 is simpler than any hosted session.

3. **The web SPA remains as the "view from anywhere," read-mostly.** It renders the same
   Shoreline/per-repo views for Viewers without Claude Desktop (or on mobile), fetching
   GitHub directly with the Viewer's token (ADR-0001). ADR-0009's IA (sidebar, Shoreline,
   per-repo deck) describes *this* surface.

4. **Build the views once — shared core.** Estate Aggregation, Triage classification, and
   the view components are a shared core consumed by both the MCP App (data via MCP tools +
   local `gh`) and the web SPA (data via direct GitHub reads). No double-build; the two
   surfaces cannot drift because they share rendering and logic.

5. **Hosted-session machinery is deferred, not deleted.** The ADR-0008 analysis (relay
   runtimes A/B/C, BYO-API-key client-side, Cloud Run/Vercel/Fly hosting) is parked as the
   path to revisit *only if* a browser-native or non-local interactive session is ever
   wanted. v1 does not need any of it.

## Consequences

- **v1 is dramatically simpler**: no backend, no auth handling, no hosting decision, no
  token/CORS problem — it runs against the developer's own local Claude + `gh`.
- **Interactive and text-driven by construction** (tools everywhere; UI layer in Desktop),
  satisfying the requirement that it work both ways.
- **A bet on young tech**: MCP Apps is ~5 months old and the rich UI is Claude-Desktop-bound
  (the terminal degrades to text). Acceptable for the dogfooding "AI developer" persona.
- **The interactive layer is local-only** — it needs Claude Desktop + the plugin installed.
  Browser-only Viewers and the public demo get the web read view, not the interactive App.
- **Web work is demoted, not dropped.** ADR-0009 and the web slices (#63–66, #80–83) still
  ship, now for the secondary surface; the shared core keeps them honest.
- **Supersedes the browser-terminal slices** #67/#68 (the interactive authoring lives in the
  plugin now) and **defers ADR-0008**.
- The MCP server reuses exactly the data Beachfront already aggregates (#6 Mapping, #7 roles,
  #8 attention, #10/#11 Agent runs), so the pivot reshapes the *surface*, not the substance.
