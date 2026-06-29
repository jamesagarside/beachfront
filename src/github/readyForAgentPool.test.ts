import { buildReadyForAgentPool } from "./readyForAgentPool.ts";
import { defaultTriageMapping } from "../triage/mapping.ts";
import type { Issue } from "./issues.ts";
import type { RepoIssues } from "./useRegistryIssues.ts";

function issue(partial: Partial<Issue> & Pick<Issue, "number">): Issue {
  return {
    title: `Issue ${partial.number}`,
    url: `https://github.com/o/r/issues/${partial.number}`,
    createdAt: "2026-06-01T00:00:00Z",
    labels: [],
    comments: 0,
    ...partial,
  };
}

const REPO = { owner: "alpha", repo: "one" };
const mapping = defaultTriageMapping();

function repoIssues(issues: Issue[]): RepoIssues {
  return { repo: REPO, issues, mapping };
}

describe("buildReadyForAgentPool", () => {
  it("collects a ready-for-agent issue, carrying its repo", () => {
    const pool = buildReadyForAgentPool([
      repoIssues([
        issue({ number: 1, labels: [{ name: "ready-for-agent", color: "" }] }),
      ]),
    ]);
    expect(pool.map((i) => i.issue.number)).toEqual([1]);
    expect(pool[0].repo).toEqual(REPO);
  });

  it("excludes issues in any other state", () => {
    const pool = buildReadyForAgentPool([
      repoIssues([
        issue({ number: 1, labels: [{ name: "needs-triage", color: "" }] }),
        issue({ number: 2, labels: [{ name: "ready-for-human", color: "" }] }),
        issue({ number: 3, labels: [] }),
      ]),
    ]);
    expect(pool).toHaveLength(0);
  });

  it("ignores repos with no Mapping — they can't be classified (ADR-0003)", () => {
    const pool = buildReadyForAgentPool([
      {
        repo: REPO,
        issues: [
          issue({ number: 1, labels: [{ name: "ready-for-agent", color: "" }] }),
        ],
        mapping: null,
      },
    ]);
    expect(pool).toHaveLength(0);
  });

  it("spans every repo and orders oldest-first", () => {
    const pool = buildReadyForAgentPool([
      {
        repo: { owner: "alpha", repo: "one" },
        mapping,
        issues: [
          issue({
            number: 1,
            createdAt: "2026-06-10T00:00:00Z",
            labels: [{ name: "ready-for-agent", color: "" }],
          }),
        ],
      },
      {
        repo: { owner: "beta", repo: "two" },
        mapping,
        issues: [
          issue({
            number: 2,
            createdAt: "2026-06-02T00:00:00Z",
            labels: [{ name: "ready-for-agent", color: "" }],
          }),
          issue({
            number: 3,
            createdAt: "2026-06-20T00:00:00Z",
            labels: [{ name: "ready-for-agent", color: "" }],
          }),
        ],
      },
    ]);
    expect(pool.map((i) => i.issue.number)).toEqual([2, 1, 3]);
    expect(pool.map((i) => i.repo.repo)).toEqual(["two", "one", "two"]);
  });
});
