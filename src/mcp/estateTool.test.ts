import { aggregateEstate } from "../core/estate.ts";
import { makeIssue, makeRun, mockDataSource } from "../core/testSource.ts";
import { defaultTriageMapping } from "../triage/mapping.ts";
import { renderEstateHtml } from "./estateHtml.ts";
import { buildEstateView, renderEstateText } from "./estateView.ts";
import {
  ESTATE_RESOURCE_URI,
  ESTATE_TOOL_NAME,
  estateToolConfig,
  runEstateTool,
} from "./estateTool.ts";

const REPO = { owner: "octo", repo: "alpha" };

const fixtures = [
  {
    repo: REPO,
    mapping: defaultTriageMapping(),
    issues: [
      makeIssue({ number: 1, labels: [{ name: "needs-triage", color: "" }] }),
      makeIssue({ number: 2, labels: [{ name: "ready-for-agent", color: "" }] }),
    ],
    runs: [makeRun({ id: 10, status: "running" })],
  },
];

describe("the estate tool", () => {
  it("is named and described for any MCP host", () => {
    expect(ESTATE_TOOL_NAME).toBe("beachfront_estate");
    expect(estateToolConfig.title).toBeTruthy();
    expect(estateToolConfig.description).toMatch(/estate/i);
  });

  it("returns the estate as structured content, the Shoreline App, and calm text", async () => {
    const source = mockDataSource(fixtures);
    const expected = buildEstateView(await aggregateEstate(source));

    const result = await runEstateTool(source);

    // Structured content drives hosts + the later tools.
    expect(result.structuredContent).toEqual(expected);
    // The Shoreline UI resource (#87) is the rich-host surface...
    expect(result.content).toEqual([
      {
        type: "resource",
        resource: {
          uri: ESTATE_RESOURCE_URI,
          mimeType: "text/html",
          text: renderEstateHtml(expected),
        },
      },
      // ...with the calm text floor a non-UI host still reads.
      { type: "text", text: renderEstateText(expected) },
    ]);
  });

  it("degrades calmly when a repo can't be read", async () => {
    const result = await runEstateTool(
      mockDataSource([{ repo: REPO, inaccessible: true }]),
    );
    expect(result.structuredContent.repos).toEqual([]);
    expect(result.structuredContent.skipped).toEqual([REPO]);
    const text = result.content.find((c) => c.type === "text");
    expect(text?.type === "text" && text.text.toLowerCase()).toContain("skipped");
  });
});
