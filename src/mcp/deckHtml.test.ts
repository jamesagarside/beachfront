import { aggregateEstate } from "../core/estate.ts";
import { makeIssue, makeRun, mockDataSource } from "../core/testSource.ts";
import { defaultTriageMapping } from "../triage/mapping.ts";
import { buildRepoDeckView } from "./repoDeckView.ts";
import { renderDeckHtml } from "./deckHtml.ts";

const REPO = { owner: "octo", repo: "alpha" };

async function html(fixture: Parameters<typeof mockDataSource>[0][number]) {
  const estate = await aggregateEstate(mockDataSource([fixture]));
  return renderDeckHtml(buildRepoDeckView(estate.repos[0]));
}

describe("renderDeckHtml", () => {
  it("renders a self-contained Kanban deck document", async () => {
    const out = await html({ repo: REPO, issues: [], runs: [] });
    expect(out).toContain("<!doctype html>");
    expect(out).toContain("octo/alpha");
  });

  it("renders a column per board role and a card per issue, linking to GitHub", async () => {
    const out = await html({
      repo: REPO,
      mapping: defaultTriageMapping(),
      issues: [
        makeIssue({
          number: 7,
          title: "Fix the tide chart",
          url: "https://github.com/octo/alpha/issues/7",
          labels: [{ name: "ready-for-agent", color: "" }],
        }),
      ],
    });
    // Every board column is drawn, including empty ones (calmly).
    expect(out).toContain("ready-for-agent");
    expect(out).toContain("needs-info");
    // The card shows the issue and links out.
    expect(out).toContain("#7");
    expect(out).toContain("Fix the tide chart");
    expect(out).toContain('href="https://github.com/octo/alpha/issues/7"');
  });

  it("pins a run/metrics strip with the success rate", async () => {
    const out = await html({
      repo: REPO,
      issues: [],
      runs: [
        makeRun({ id: 1, status: "running" }),
        makeRun({ id: 2, status: "succeeded" }),
        makeRun({ id: 3, status: "failed" }),
      ],
    });
    expect(out).toContain("1 running");
    expect(out).toContain("50% success");
  });

  it("escapes issue titles so they can't break the markup", async () => {
    const out = await html({
      repo: REPO,
      mapping: defaultTriageMapping(),
      issues: [
        makeIssue({
          number: 9,
          title: '<script>alert("x")</script>',
          labels: [{ name: "ready-for-agent", color: "" }],
        }),
      ],
    });
    expect(out).not.toContain('<script>alert("x")</script>');
    expect(out).toContain("&lt;script&gt;");
  });
});
