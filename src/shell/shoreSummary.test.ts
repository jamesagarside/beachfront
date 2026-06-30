import type { Issue } from "../github/issues.ts";
import type { RepoRuns } from "../github/runsSummary.ts";
import type { RepoIssues } from "../github/useRegistryIssues.ts";
import { defaultTriageMapping } from "../triage/mapping.ts";
import { buildShoreSummary, tideLine } from "./shoreSummary.ts";

const mapping = defaultTriageMapping();

function issue(number: number, labels: string[] = []): Issue {
  return {
    number,
    title: `Issue ${number}`,
    url: `https://example.test/${number}`,
    labels: labels.map((name) => ({ name, color: "" })),
    createdAt: "2026-01-01T00:00:00Z",
    comments: 0,
  };
}

function repoIssues(
  owner: string,
  repo: string,
  issues: Issue[],
): RepoIssues {
  return { repo: { owner, repo }, issues, mapping };
}

describe("buildShoreSummary", () => {
  it("counts open issues, attention, and in-flight agents per repo", () => {
    const issues: RepoIssues[] = [
      // one untriaged (attention) + one ready-for-agent (handled)
      repoIssues("acme", "alpha", [
        issue(1, []),
        issue(2, ["ready-for-agent"]),
      ]),
      // all calm
      repoIssues("acme", "beta", [issue(3, ["ready-for-agent"])]),
    ];
    const runs: RepoRuns[] = [
      {
        repo: { owner: "acme", repo: "alpha" },
        runs: [
          { id: 1, name: "r", status: "running", url: "", branch: null, createdAt: "" },
          { id: 2, name: "r", status: "queued", url: "", branch: null, createdAt: "" },
          { id: 3, name: "r", status: "succeeded", url: "", branch: null, createdAt: "" },
        ],
      },
    ];

    const summary = buildShoreSummary(issues, runs);

    expect(summary.repos).toHaveLength(2);
    expect(summary.repos[0]).toEqual({
      repo: { owner: "acme", repo: "alpha" },
      openIssues: 2,
      attention: 1,
      running: 2, // running + queued; succeeded is settled
    });
    expect(summary.repos[1]).toMatchObject({ attention: 0, running: 0 });
    expect(summary.calmCount).toBe(1);
    expect(summary.needsYouCount).toBe(1);
    expect(summary.totalAttention).toBe(1);
  });

  it("omits nothing for a repo with no runs entry — reads as zero agents", () => {
    const summary = buildShoreSummary(
      [repoIssues("acme", "alpha", [issue(1, ["ready-for-agent"])])],
      [],
    );
    expect(summary.repos[0].running).toBe(0);
  });
});

describe("tideLine", () => {
  const base = { repos: [], calmCount: 0, needsYouCount: 0, totalAttention: 0 };

  it("reads plainly when no repos are linked", () => {
    expect(tideLine(base)).toBe("No repos linked yet.");
  });

  it("says all calm when nothing needs a human", () => {
    expect(
      tideLine({
        ...base,
        repos: [
          { repo: { owner: "a", repo: "b" }, openIssues: 0, attention: 0, running: 0 },
        ],
        calmCount: 1,
      }),
    ).toBe("1 repo · all calm");
  });

  it("surfaces how many need you", () => {
    const repos = Array.from({ length: 12 }, (_, i) => ({
      repo: { owner: "a", repo: `r${i}` },
      openIssues: 0,
      attention: i < 3 ? 1 : 0,
      running: 0,
    }));
    expect(
      tideLine({ repos, calmCount: 9, needsYouCount: 3, totalAttention: 3 }),
    ).toBe("9 of 12 repos calm · 3 need you");
  });
});
