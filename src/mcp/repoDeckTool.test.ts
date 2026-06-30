import { makeIssue, makeRun, mockDataSource } from "../core/testSource.ts";
import { defaultTriageMapping } from "../triage/mapping.ts";
import {
  REPO_DECK_TOOL_NAME,
  deckResourceUri,
  repoDeckToolConfig,
  runRepoDeckTool,
} from "./repoDeckTool.ts";

const REPO = { owner: "octo", repo: "alpha" };

const fixtures = [
  {
    repo: REPO,
    mapping: defaultTriageMapping(),
    issues: [
      makeIssue({ number: 1, labels: [{ name: "needs-triage", color: "" }] }),
      makeIssue({ number: 2, labels: [{ name: "ready-for-agent", color: "" }] }),
      makeIssue({ number: 3, labels: [{ name: "ready-for-agent", color: "" }] }),
    ],
    runs: [makeRun({ id: 10, status: "running" })],
  },
  { repo: { owner: "octo", repo: "beta" }, inaccessible: true },
];

describe("the per-repo deck tool", () => {
  it("is named and described for any MCP host", () => {
    expect(REPO_DECK_TOOL_NAME).toBe("beachfront_repo_deck");
    expect(repoDeckToolConfig.title).toBeTruthy();
    expect(repoDeckToolConfig.description).toMatch(/deck|board/i);
  });

  it("returns one repo's board bucketed by triage role, plus the run summary", async () => {
    const result = await runRepoDeckTool(mockDataSource(fixtures), REPO);

    const view = result.structuredContent!;
    expect(view.owner).toBe("octo");
    expect(view.repo).toBe("alpha");
    const byRole = Object.fromEntries(view.columns.map((c) => [c.role, c.cards]));
    expect(byRole["needs-triage"].map((c) => c.number)).toEqual([1]);
    expect(byRole["ready-for-agent"].map((c) => c.number)).toEqual([2, 3]);
    expect(view.runs.running).toBe(1);
  });

  it("carries both the Kanban UI resource and a text fallback", async () => {
    const result = await runRepoDeckTool(mockDataSource(fixtures), REPO);

    const resource = result.content.find((c) => c.type === "resource");
    expect(resource?.resource.mimeType).toBe("text/html");
    expect(resource?.resource.uri).toBe(deckResourceUri(REPO));
    expect(resource?.resource.text).toContain("octo/alpha");

    const text = result.content.find((c) => c.type === "text");
    expect(text?.text).toContain("ready-for-agent");
  });

  it("degrades calmly when the requested repo can't be read", async () => {
    const result = await runRepoDeckTool(mockDataSource(fixtures), {
      owner: "octo",
      repo: "beta",
    });
    expect(result.structuredContent).toBeUndefined();
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");
    expect(result.content[0].type === "text" && result.content[0].text).toMatch(
      /couldn't read|could not read/i,
    );
  });

  it("says so plainly when the repo isn't linked in the Registry", async () => {
    const result = await runRepoDeckTool(mockDataSource(fixtures), {
      owner: "octo",
      repo: "ghost",
    });
    expect(result.structuredContent).toBeUndefined();
    expect(result.content[0].type === "text" && result.content[0].text).toMatch(
      /not linked|isn't linked/i,
    );
  });
});
