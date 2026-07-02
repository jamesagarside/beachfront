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

async function shorelineFrom(
  fixtures: Parameters<typeof mockDataSource>[0],
  current: string | null = "cur1234",
) {
  return buildShoreline(await aggregateEstate(mockDataSource(fixtures)), current);
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
      {
        repo: ALPHA,
        openCount: 2,
        attentionCount: 1,
        runningCount: 1,
        // No stamp in this fixture → unknown drift, no fix pushed.
        harness: { state: "unknown", installed: null, current: "cur1234", fix: null },
      },
    ]);
  });

  it("computes each repo's harness drift against the running build's vintage (#115)", async () => {
    const shoreline = await shorelineFrom(
      [
        { repo: ALPHA, issues: [], harnessVersion: "cur1234" }, // matches
        { repo: BETA, issues: [], harnessVersion: "old9999" }, // drifted
      ],
      "cur1234",
    );

    const [alpha, beta] = shoreline.repos;
    expect(alpha.harness.state).toBe("current");
    expect(beta.harness.state).toBe("behind");
    // A behind repo carries the exact fix a Viewer runs.
    expect(beta.harness.fix).toBe("scripts/beachfront-update.sh beta/two");
  });

  it("reads unknown drift for an unstamped (older-onboard) repo", async () => {
    const shoreline = await shorelineFrom([{ repo: ALPHA, issues: [] }], "cur1234");
    expect(shoreline.repos[0].harness.state).toBe("unknown");
    expect(shoreline.repos[0].harness.fix).toBeNull();
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
