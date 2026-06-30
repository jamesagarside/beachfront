import { aggregateEstate } from "./estate.ts";
import { buildShoreline } from "./shoreline.ts";
import { makeIssue, makeRun, mockDataSource } from "./testSource.ts";
import { defaultTriageMapping } from "../triage/mapping.ts";

const ALPHA = { owner: "alpha", repo: "one" };
const BETA = { owner: "beta", repo: "two" };
const mapping = defaultTriageMapping();

function label(name: string) {
  return { name, color: "" };
}

async function shorelineFrom(fixtures: Parameters<typeof mockDataSource>[0]) {
  return buildShoreline(await aggregateEstate(mockDataSource(fixtures)));
}

describe("buildShoreline", () => {
  it("summarises the tide line across every loaded repo", async () => {
    const shoreline = await shorelineFrom([
      {
        repo: ALPHA,
        issues: [
          makeIssue({ number: 1, labels: [label("needs-triage")] }),
          makeIssue({ number: 2, labels: [label("ready-for-agent")] }),
        ],
        mapping,
        runs: [
          makeRun({ id: 1, status: "running" }),
          makeRun({ id: 2, status: "succeeded" }),
        ],
      },
      {
        repo: BETA,
        issues: [makeIssue({ number: 3, labels: [label("needs-triage")] })],
        mapping,
        runs: [makeRun({ id: 3, status: "running" })],
      },
    ]);

    expect(shoreline.tideLine).toEqual({
      repoCount: 2,
      openCount: 3,
      attentionCount: 2, // the two needs-triage issues
      runningCount: 2, // one running run per repo
    });
  });

  it("builds a per-repo health row with open / attention / running counts", async () => {
    const shoreline = await shorelineFrom([
      {
        repo: ALPHA,
        issues: [
          makeIssue({ number: 1, labels: [label("needs-triage")] }),
          makeIssue({ number: 2, labels: [label("ready-for-agent")] }),
        ],
        mapping,
        runs: [
          makeRun({ id: 1, status: "running" }),
          makeRun({ id: 2, status: "queued" }),
        ],
      },
    ]);

    expect(shoreline.repos).toEqual([
      { repo: ALPHA, openCount: 2, attentionCount: 1, runningCount: 1 },
    ]);
  });

  it("composes the cross-repo attention queue and ready-for-agent pool", async () => {
    const shoreline = await shorelineFrom([
      {
        repo: ALPHA,
        issues: [makeIssue({ number: 1, labels: [label("needs-triage")] })],
        mapping,
      },
      {
        repo: BETA,
        issues: [makeIssue({ number: 2, labels: [label("ready-for-agent")] })],
        mapping,
      },
    ]);

    expect(shoreline.attention.needsTriage.map((i) => i.issue.number)).toEqual([
      1,
    ]);
    expect(shoreline.readyForAgent.map((i) => i.issue.number)).toEqual([2]);
  });

  it("carries skipped repos through for a calm note", async () => {
    const shoreline = await shorelineFrom([
      { repo: ALPHA, inaccessible: true },
      { repo: BETA, issues: [] },
    ]);

    expect(shoreline.skipped).toEqual([ALPHA]);
    expect(shoreline.repos.map((r) => r.repo)).toEqual([BETA]);
  });
});
