import { aggregateEstate } from "./estate.ts";
import {
  makeIssue,
  makeRun,
  mockDataSource,
  type RepoFixture,
} from "./testSource.ts";
import { defaultTriageMapping } from "../triage/mapping.ts";
import type { EstateDataSource } from "./dataSource.ts";

const ALPHA = { owner: "alpha", repo: "one" };
const BETA = { owner: "beta", repo: "two" };

describe("aggregateEstate", () => {
  it("resolves each repo's issues, mapping, and runs from the source", async () => {
    const mapping = defaultTriageMapping();
    const source = mockDataSource([
      {
        repo: ALPHA,
        issues: [makeIssue({ number: 1 })],
        mapping,
        runs: [makeRun({ id: 10, status: "running" })],
      },
    ]);

    const estate = await aggregateEstate(source);

    expect(estate.repos).toHaveLength(1);
    expect(estate.repos[0].repo).toEqual(ALPHA);
    expect(estate.repos[0].issues.map((i) => i.number)).toEqual([1]);
    expect(estate.repos[0].mapping).toBe(mapping);
    expect(estate.repos[0].runs.map((r) => r.id)).toEqual([10]);
    expect(estate.skipped).toEqual([]);
  });

  it("keeps the source's repo order for loaded repos", async () => {
    const estate = await aggregateEstate(
      mockDataSource([{ repo: ALPHA }, { repo: BETA }]),
    );
    expect(estate.repos.map((r) => r.repo)).toEqual([ALPHA, BETA]);
  });

  it("skips a repo whose issues can't be read, keeping the rest", async () => {
    const fixtures: RepoFixture[] = [
      { repo: ALPHA, inaccessible: true },
      { repo: BETA, issues: [makeIssue({ number: 2 })] },
    ];

    const estate = await aggregateEstate(mockDataSource(fixtures));

    expect(estate.repos.map((r) => r.repo)).toEqual([BETA]);
    expect(estate.skipped).toEqual([ALPHA]);
  });

  it("degrades a failing mapping read to null without dropping the repo", async () => {
    const source: EstateDataSource = {
      ...mockDataSource([{ repo: ALPHA, issues: [makeIssue({ number: 1 })] }]),
      fetchTriageMapping: () => Promise.reject(new Error("boom")),
    };

    const estate = await aggregateEstate(source);

    expect(estate.repos).toHaveLength(1);
    expect(estate.repos[0].mapping).toBeNull();
  });

  it("degrades a failing runs read to an empty list without dropping the repo", async () => {
    const source: EstateDataSource = {
      ...mockDataSource([{ repo: ALPHA, issues: [makeIssue({ number: 1 })] }]),
      fetchAgentRuns: () => Promise.reject(new Error("boom")),
    };

    const estate = await aggregateEstate(source);

    expect(estate.repos[0].runs).toEqual([]);
  });
});
