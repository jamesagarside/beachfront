/**
 * The per-repo deck tool (#88, ADR-0010) — the sibling to {@link runEstateTool}
 * that zooms from the whole estate to one repo's **mission deck**: its open
 * issues bucketed by triage role plus a run/metrics summary. It is what the
 * Shoreline estate App calls when a Viewer selects a repo (#87), and it stands
 * alone as a text tool in any MCP host.
 *
 * Kept free of the MCP SDK so it stays unit-testable and the app typecheck (which
 * carries no Node types) covers it; the plugin entry owns the `registerTool`
 * wiring and the `gh`-backed source. Given an {@link EstateDataSource} and a repo
 * it aggregates the estate once, finds that repo, and returns the deck three
 * ways: a serialisable {@link RepoDeckView} (`structuredContent`), the Kanban
 * **UI resource** ({@link renderDeckHtml}, the MCP App), and a calm text fallback
 * — so rich hosts and the terminal see the same board. A repo that can't be read,
 * or isn't in the Registry, degrades to a calm one-line explanation.
 */
import type { RepoRef } from "../config.ts";
import type { EstateDataSource } from "../core/dataSource.ts";
import { aggregateEstate } from "../core/estate.ts";
import { renderDeckHtml } from "./deckHtml.ts";
import {
  buildRepoDeckView,
  type RepoDeckView,
  renderRepoDeckText,
} from "./repoDeckView.ts";

/** The tool's stable name — what an MCP host calls and a Viewer can say. */
export const REPO_DECK_TOOL_NAME = "beachfront_repo_deck";

/** Host-facing metadata for `registerTool`. */
export const repoDeckToolConfig = {
  title: "Beachfront repo deck",
  description:
    "Show one repo's mission deck — its open issues as a Kanban board by " +
    "triage role, with a pinned Agent-run/metrics strip.",
} as const;

/** The `ui://` URI the Kanban App resource is addressed by, per repo. */
export function deckResourceUri(repo: RepoRef): string {
  return `ui://beachfront/deck/${repo.owner}/${repo.repo}`;
}

/** A content item the tool returns: a text line or the Kanban UI resource. */
export type DeckContent =
  | { type: "text"; text: string }
  | {
      type: "resource";
      resource: { uri: string; mimeType: "text/html"; text: string };
    };

/** The MCP tool-result shape the deck tool produces (SDK-agnostic). */
export interface RepoDeckToolResult {
  content: DeckContent[];
  /** Present only when the repo loaded; absent on a skip or unknown repo. */
  structuredContent?: RepoDeckView;
}

const sameRepo = (a: RepoRef, b: RepoRef): boolean =>
  a.owner === b.owner && a.repo === b.repo;

/**
 * Runs the deck tool for one repo against a data source. The plugin entry passes
 * a `gh`-backed source; tests pass a mock.
 */
export async function runRepoDeckTool(
  source: EstateDataSource,
  repo: RepoRef,
): Promise<RepoDeckToolResult> {
  const slug = `${repo.owner}/${repo.repo}`;
  const estate = await aggregateEstate(source);

  const loaded = estate.repos.find((r) => sameRepo(r.repo, repo));
  if (loaded) {
    const view = buildRepoDeckView(loaded);
    return {
      content: [
        {
          type: "resource",
          resource: {
            uri: deckResourceUri(repo),
            mimeType: "text/html",
            text: renderDeckHtml(view),
          },
        },
        { type: "text", text: renderRepoDeckText(view) },
      ],
      structuredContent: view,
    };
  }

  // The repo is in the Registry but its issues couldn't be read (private /
  // inaccessible) — the aggregator parked it in `skipped` rather than failing.
  if (estate.skipped.some((r) => sameRepo(r, repo))) {
    return {
      content: [
        { type: "text", text: `${slug} — couldn't read this repo right now.` },
      ],
    };
  }

  // Not in the Registry at all: say so plainly rather than drawing an empty board.
  return {
    content: [
      {
        type: "text",
        text: `${slug} isn't linked in this estate — link it with \`beachfront link\`.`,
      },
    ],
  };
}
