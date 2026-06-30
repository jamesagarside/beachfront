import { aggregateEstate } from "../core/estate.ts";
import { makeIssue, makeRun, mockDataSource } from "../core/testSource.ts";
import { defaultTriageMapping } from "../triage/mapping.ts";
import { REPO_DECK_TOOL_NAME } from "./repoDeckTool.ts";
import { buildEstateView } from "./estateView.ts";
import { renderEstateHtml } from "./estateHtml.ts";

const REPO_A = { owner: "octo", repo: "alpha" };
const REPO_B = { owner: "octo", repo: "beta" };

async function html(fixtures: Parameters<typeof mockDataSource>[0]) {
  return renderEstateHtml(buildEstateView(await aggregateEstate(mockDataSource(fixtures))));
}

describe("renderEstateHtml", () => {
  it("renders a self-contained Shoreline document with the brand mark", async () => {
    const out = await html([{ repo: REPO_A, issues: [], runs: [] }]);
    expect(out).toContain("<!doctype html>");
    expect(out).toContain("Beachfront");
    // The sunset/horizon mark is inline SVG so the document is self-contained.
    expect(out).toContain("<svg");
  });

  it("shows the tide-line summary across every repo", async () => {
    const out = await html([
      {
        repo: REPO_A,
        mapping: defaultTriageMapping(),
        issues: [makeIssue({ number: 1, labels: [{ name: "needs-triage", color: "" }] })],
        runs: [makeRun({ id: 10, status: "running" })],
      },
      {
        repo: REPO_B,
        mapping: defaultTriageMapping(),
        issues: [makeIssue({ number: 2, labels: [{ name: "ready-for-agent", color: "" }] })],
        runs: [],
      },
    ]);
    expect(out).toContain("2 repos");
    expect(out).toContain("2 open issues");
    expect(out).toContain("1 need you");
    expect(out).toContain("1 running");
  });

  it("renders the cross-repo Attention queue, linking each item to GitHub", async () => {
    const out = await html([
      {
        repo: REPO_A,
        mapping: defaultTriageMapping(),
        issues: [
          makeIssue({
            number: 7,
            title: "Tide chart is wrong",
            url: "https://github.com/octo/alpha/issues/7",
            labels: [{ name: "needs-triage", color: "" }],
          }),
          // ready-for-agent is handled — it must NOT enter the Attention queue.
          makeIssue({ number: 8, labels: [{ name: "ready-for-agent", color: "" }] }),
        ],
      },
    ]);
    expect(out).toContain("Attention queue");
    expect(out).toContain("needs-triage");
    expect(out).toContain("octo/alpha #7");
    expect(out).toContain("Tide chart is wrong");
    expect(out).toContain('href="https://github.com/octo/alpha/issues/7"');
  });

  it("keeps the shore calm when nothing needs a human", async () => {
    const out = await html([
      {
        repo: REPO_A,
        mapping: defaultTriageMapping(),
        issues: [makeIssue({ number: 1, labels: [{ name: "ready-for-agent", color: "" }] })],
      },
    ]);
    expect(out).toContain("the shore is calm");
  });

  it("renders the repo shore grid with open / running / fed health chips", async () => {
    const out = await html([
      {
        repo: REPO_A,
        mapping: defaultTriageMapping(),
        issues: [
          makeIssue({ number: 1, labels: [{ name: "ready-for-agent", color: "" }] }),
          makeIssue({ number: 2, labels: [{ name: "ready-for-agent", color: "" }] }),
        ],
        runs: [makeRun({ id: 10, status: "running" })],
      },
    ]);
    expect(out).toContain("octo/alpha");
    expect(out).toContain("2 open");
    expect(out).toContain("1 running");
    expect(out).toContain("2 fed"); // the two ready-for-agent issues
  });

  it("wires repo selection to invoke the per-repo deck tool", async () => {
    const out = await html([{ repo: REPO_A, issues: [] }]);
    // The tile carries the repo identity and the bridge calls the deck tool.
    expect(out).toContain('data-owner="octo"');
    expect(out).toContain('data-repo="alpha"');
    expect(out).toContain(REPO_DECK_TOOL_NAME);
  });

  it("notes repos it couldn't read rather than dropping them silently", async () => {
    const out = await html([
      { repo: REPO_A, issues: [] },
      { repo: REPO_B, inaccessible: true },
    ]);
    expect(out).toContain("Couldn't read");
    expect(out).toContain("octo/beta");
  });

  it("escapes issue titles so they can't break the markup", async () => {
    const out = await html([
      {
        repo: REPO_A,
        mapping: defaultTriageMapping(),
        issues: [
          makeIssue({
            number: 9,
            title: '<script>alert("x")</script>',
            labels: [{ name: "needs-triage", color: "" }],
          }),
        ],
      },
    ]);
    expect(out).not.toContain('<script>alert("x")</script>');
    expect(out).toContain("&lt;script&gt;");
  });

  it("offers a calm empty state when no repos are linked", async () => {
    const out = await html([]);
    expect(out).toContain("No repos linked yet");
  });
});
