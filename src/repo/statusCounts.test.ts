import { countIssuesByRole, type StatusCount } from "./statusCounts.ts";
import { defaultTriageMapping } from "../triage/mapping.ts";
import type { Issue } from "../github/issues.ts";

const mapping = defaultTriageMapping();

function issue(number: number, labelNames: string[]): Issue {
  return {
    number,
    title: `Issue ${number}`,
    url: `https://example.test/${number}`,
    labels: labelNames.map((name) => ({ name, color: "" })),
    createdAt: "2026-01-01T00:00:00Z",
    comments: 0,
  };
}

function countFor(counts: StatusCount[], role: string): number {
  return counts.find((c) => c.role === role)!.count;
}

describe("countIssuesByRole", () => {
  it("buckets issues by their canonical state role", () => {
    const counts = countIssuesByRole(
      [
        issue(1, ["ready-for-agent"]),
        issue(2, ["ready-for-agent", "bug"]),
        issue(3, ["needs-triage"]),
        issue(4, ["ready-for-human"]),
      ],
      mapping,
    );
    expect(countFor(counts, "ready-for-agent")).toBe(2);
    expect(countFor(counts, "needs-triage")).toBe(1);
    expect(countFor(counts, "ready-for-human")).toBe(1);
  });

  it("counts issues with no recognized triage label as untriaged", () => {
    const counts = countIssuesByRole(
      [issue(1, []), issue(2, ["documentation"]), issue(3, ["needs-info"])],
      mapping,
    );
    expect(countFor(counts, "untriaged")).toBe(2);
    expect(countFor(counts, "needs-info")).toBe(1);
  });

  it("counts a category-only issue toward no state role", () => {
    const counts = countIssuesByRole([issue(1, ["bug"])], mapping);
    for (const { count } of counts) expect(count).toBe(0);
  });

  it("returns every canonical role in order, zeros included", () => {
    const counts = countIssuesByRole([], mapping);
    expect(counts.map((c) => c.role)).toEqual([
      "untriaged",
      "needs-triage",
      "needs-info",
      "ready-for-agent",
      "ready-for-human",
      "wontfix",
    ]);
    expect(counts.every((c) => c.count === 0)).toBe(true);
  });

  it("classifies nothing when the repo has no Mapping", () => {
    const counts = countIssuesByRole(
      [issue(1, ["ready-for-agent"]), issue(2, [])],
      null,
    );
    // no mapping ⇒ no untriaged, no state roles
    expect(counts.every((c) => c.count === 0)).toBe(true);
  });
});
