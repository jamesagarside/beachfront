import { buildAttentionQueue, hasReporterActivity } from "./attentionQueue.ts";
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

describe("hasReporterActivity", () => {
  it("is true when an issue has at least one comment", () => {
    expect(hasReporterActivity(issue({ number: 1, comments: 2 }))).toBe(true);
  });

  it("is false when an issue has no comments", () => {
    expect(hasReporterActivity(issue({ number: 1, comments: 0 }))).toBe(false);
  });
});

describe("buildAttentionQueue", () => {
  it("sorts an unlabelled issue into the untriaged bucket", () => {
    const queue = buildAttentionQueue([
      repoIssues([issue({ number: 1, labels: [] })]),
    ]);
    expect(queue.untriaged.map((i) => i.issue.number)).toEqual([1]);
    expect(queue.needsTriage).toHaveLength(0);
    expect(queue.needsInfo).toHaveLength(0);
  });

  it("sorts a needs-triage issue into the needs-triage bucket", () => {
    const queue = buildAttentionQueue([
      repoIssues([
        issue({ number: 2, labels: [{ name: "needs-triage", color: "" }] }),
      ]),
    ]);
    expect(queue.needsTriage.map((i) => i.issue.number)).toEqual([2]);
  });

  it("sorts a needs-info issue with reporter activity into the needs-info bucket", () => {
    const queue = buildAttentionQueue([
      repoIssues([
        issue({
          number: 3,
          labels: [{ name: "needs-info", color: "" }],
          comments: 1,
        }),
      ]),
    ]);
    expect(queue.needsInfo.map((i) => i.issue.number)).toEqual([3]);
  });

  it("excludes a needs-info issue with no reporter activity", () => {
    const queue = buildAttentionQueue([
      repoIssues([
        issue({
          number: 4,
          labels: [{ name: "needs-info", color: "" }],
          comments: 0,
        }),
      ]),
    ]);
    expect(queue.needsInfo).toHaveLength(0);
  });

  it("excludes issues in a handled state (e.g. ready-for-agent)", () => {
    const queue = buildAttentionQueue([
      repoIssues([
        issue({ number: 5, labels: [{ name: "ready-for-agent", color: "" }] }),
      ]),
    ]);
    expect(queue.untriaged).toHaveLength(0);
    expect(queue.needsTriage).toHaveLength(0);
    expect(queue.needsInfo).toHaveLength(0);
  });

  it("ignores repos with no Mapping — they can't be classified (ADR-0003)", () => {
    const queue = buildAttentionQueue([
      { repo: REPO, issues: [issue({ number: 6, labels: [] })], mapping: null },
    ]);
    expect(queue.untriaged).toHaveLength(0);
  });

  it("spans every repo and orders each bucket oldest-first", () => {
    const queue = buildAttentionQueue([
      {
        repo: { owner: "alpha", repo: "one" },
        mapping,
        issues: [issue({ number: 1, createdAt: "2026-06-10T00:00:00Z" })],
      },
      {
        repo: { owner: "beta", repo: "two" },
        mapping,
        issues: [
          issue({ number: 2, createdAt: "2026-06-02T00:00:00Z" }),
          issue({ number: 3, createdAt: "2026-06-20T00:00:00Z" }),
        ],
      },
    ]);
    // Oldest first, across all repos.
    expect(queue.untriaged.map((i) => i.issue.number)).toEqual([2, 1, 3]);
    expect(queue.untriaged.map((i) => i.repo.repo)).toEqual([
      "two",
      "one",
      "two",
    ]);
  });
});
