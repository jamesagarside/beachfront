import { aggregateEstate } from "../core/estate.ts";
import { makeIssue, makeRun, mockDataSource } from "../core/testSource.ts";
import { defaultTriageMapping } from "../triage/mapping.ts";
import { buildEstateView, renderEstateText } from "./estateView.ts";
import { ESTATE_TOOL_NAME, estateToolConfig, runEstateTool } from "./estateTool.ts";

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

  it("returns the estate as both structured content and calm text", async () => {
    const source = mockDataSource(fixtures);
    const expected = buildEstateView(await aggregateEstate(source));

    const result = await runEstateTool(source);

    // Structured content drives hosts + the later UI resources (#87/#88).
    expect(result.structuredContent).toEqual(expected);
    // Text is the floor: a non-UI host still gets a readable board.
    expect(result.content).toEqual([
      { type: "text", text: renderEstateText(expected) },
    ]);
    expect(result.content[0].text).toContain("octo/alpha");
  });

  it("degrades calmly when a repo can't be read", async () => {
    const result = await runEstateTool(
      mockDataSource([{ repo: REPO, inaccessible: true }]),
    );
    expect(result.structuredContent.repos).toEqual([]);
    expect(result.structuredContent.skipped).toEqual([REPO]);
    expect(result.content[0].text.toLowerCase()).toContain("skipped");
  });
});
