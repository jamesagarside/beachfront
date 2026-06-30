import { aggregateEstate } from "../core/estate.ts";
import { makeIssue, makeRun, mockDataSource } from "../core/testSource.ts";
import { defaultTriageMapping } from "../triage/mapping.ts";
import { buildEstateView, renderEstateText } from "./estateView.ts";

const REPO_A = { owner: "octo", repo: "alpha" };
const REPO_B = { owner: "octo", repo: "beta" };

async function view(fixtures: Parameters<typeof mockDataSource>[0]) {
  return buildEstateView(await aggregateEstate(mockDataSource(fixtures)));
}

describe("buildEstateView", () => {
  it("summarises each repo: open / running / attention and role counts", async () => {
    const v = await view([
      {
        repo: REPO_A,
        mapping: defaultTriageMapping(),
        issues: [
          makeIssue({ number: 1, labels: [{ name: "ready-for-agent", color: "" }] }),
          makeIssue({ number: 2, labels: [{ name: "ready-for-agent", color: "" }] }),
          makeIssue({ number: 3, labels: [{ name: "needs-triage", color: "" }] }),
        ],
        runs: [
          makeRun({ id: 10, status: "running" }),
          makeRun({ id: 11, status: "succeeded" }),
        ],
      },
    ]);

    expect(v.repos).toHaveLength(1);
    const repo = v.repos[0];
    expect(repo.owner).toBe("octo");
    expect(repo.repo).toBe("alpha");
    expect(repo.openCount).toBe(3);
    expect(repo.runningCount).toBe(1);
    expect(repo.attentionCount).toBe(1); // the lone needs-triage issue
    expect(repo.roles).toEqual([
      { role: "needs-triage", count: 1 },
      { role: "ready-for-agent", count: 2 },
    ]);
  });

  it("rolls the tide-line totals across every loaded repo", async () => {
    const v = await view([
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

    expect(v.tideLine).toEqual({
      repoCount: 2,
      openCount: 2,
      attentionCount: 1,
      runningCount: 1,
    });
  });

  it("carries through repos the source couldn't read as skipped", async () => {
    const v = await view([
      { repo: REPO_A, issues: [makeIssue({ number: 1 })] },
      { repo: REPO_B, inaccessible: true },
    ]);
    expect(v.repos.map((r) => r.repo)).toEqual(["alpha"]);
    expect(v.skipped).toEqual([{ owner: "octo", repo: "beta" }]);
  });
});

describe("renderEstateText", () => {
  it("renders a calm, plainspoken estate summary for non-UI hosts", async () => {
    const v = await view([
      {
        repo: REPO_A,
        mapping: defaultTriageMapping(),
        issues: [
          makeIssue({ number: 1, labels: [{ name: "needs-triage", color: "" }] }),
          makeIssue({ number: 2, labels: [{ name: "ready-for-agent", color: "" }] }),
        ],
        runs: [makeRun({ id: 10, status: "running" })],
      },
    ]);

    const text = renderEstateText(v);

    expect(text).toContain("1 repo");
    expect(text).toContain("octo/alpha");
    expect(text).toContain("2 open");
    expect(text).toContain("1 need you");
    expect(text).toContain("1 running");
    // Surfaces the per-role triage breakdown so the text host sees the board too.
    expect(text).toContain("ready-for-agent");
  });

  it("notes an empty estate calmly rather than rendering nothing", async () => {
    const text = renderEstateText(await view([]));
    expect(text).toContain("No repos");
  });

  it("notes skipped repos so an inaccessible repo isn't silently dropped", async () => {
    const text = renderEstateText(
      await view([{ repo: REPO_A, inaccessible: true }]),
    );
    expect(text.toLowerCase()).toContain("skipped");
    expect(text).toContain("octo/alpha");
  });
});
