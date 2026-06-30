/**
 * The estate tool (#86, ADR-0010) — the Beachfront plugin's walking skeleton and
 * the base every later tool and UI resource builds on (#87/#88/#89). It does the
 * one thing the plugin must do everywhere: aggregate the Viewer's Sandcastle
 * estate (Registry repos + open issues + triage roles + running-agent counts) and
 * return it as content that works in **any** MCP host, no UI required.
 *
 * The handler is kept free of the MCP SDK so it stays unit-testable and the app
 * typecheck (which carries no Node types) covers it; the plugin entry script owns
 * the `McpServer.registerTool` wiring and the `gh`-backed data source. Given any
 * {@link EstateDataSource} it runs the shared-core aggregation once and returns
 * both a serialisable {@link EstateView} (`structuredContent`) and a calm text
 * rendering (`content`), so rich hosts and the terminal see the same estate.
 */
import type { EstateDataSource } from "../core/dataSource.ts";
import { aggregateEstate } from "../core/estate.ts";
import { renderEstateHtml } from "./estateHtml.ts";
import {
  buildEstateView,
  type EstateView,
  renderEstateText,
} from "./estateView.ts";

/** The tool's stable name — what an MCP host calls and a Viewer can say. */
export const ESTATE_TOOL_NAME = "beachfront_estate";

/** The `ui://` URI the Shoreline App resource is addressed by (#87). */
export const ESTATE_RESOURCE_URI = "ui://beachfront/estate";

/** Host-facing metadata for `registerTool`. */
export const estateToolConfig = {
  title: "Beachfront estate",
  description:
    "Aggregate the Sandcastle estate across all linked repos — open issues by " +
    "triage role and running-agent counts — as a calm single pane of glass.",
} as const;

/** A content item the tool returns: a text line or the Shoreline UI resource. */
export type EstateContent =
  | { type: "text"; text: string }
  | {
      type: "resource";
      resource: { uri: string; mimeType: "text/html"; text: string };
    };

/** The MCP tool-result shape the estate tool produces (SDK-agnostic). */
export interface EstateToolResult {
  content: EstateContent[];
  structuredContent: EstateView;
}

/**
 * Runs the estate tool against a data source: one aggregation, rendered three
 * ways — the serialisable view (`structuredContent`), the Shoreline **UI
 * resource** ({@link renderEstateHtml}, the MCP App rich hosts draw, #87) and the
 * calm text floor every host can read. The plugin entry passes a `gh`-backed
 * source; tests pass a mock.
 */
export async function runEstateTool(
  source: EstateDataSource,
): Promise<EstateToolResult> {
  const view = buildEstateView(await aggregateEstate(source));
  return {
    content: [
      {
        type: "resource",
        resource: {
          uri: ESTATE_RESOURCE_URI,
          mimeType: "text/html",
          text: renderEstateHtml(view),
        },
      },
      { type: "text", text: renderEstateText(view) },
    ],
    structuredContent: view,
  };
}
