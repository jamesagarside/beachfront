import { bucketIssuesByRole } from "./kanban.ts";
import { defaultTriageMapping } from "../triage/mapping.ts";
import type { Issue } from "../github/issues.ts";

const mapping = defaultTriageMapping();

function issue(number: number, labels: string[]): Issue {
  return {
    number,
    title: `Issue ${number}`,
    url: `https://github.com/acme/widgets/issues/${number}`,
    labels: labels.map((name) => ({ name, color: "" })),
    createdAt: "2026-06-01T00:00:00Z",
    comments: 0,
  };
}

describe("bucketIssuesByRole", () => {
  it("returns the canonical columns in order", () => {
    const columns = bucketIssuesByRole([], mapping);
    expect(columns.map((c) => c.role)).toEqual([
      "untriaged",
      "needs-triage",
      "needs-info",
      "ready-for-agent",
      "ready-for-human",
      "wontfix",
    ]);
  });

  it("places an issue with no triage label in the untriaged column", () => {
    const columns = bucketIssuesByRole([issue(1, ["documentation"])], mapping);
    const untriaged = columns.find((c) => c.role === "untriaged");
    expect(untriaged?.issues.map((i) => i.number)).toEqual([1]);
  });

  it("places an issue in its state-role column", () => {
    const columns = bucketIssuesByRole(
      [issue(2, ["bug", "ready-for-agent"])],
      mapping,
    );
    const ready = columns.find((c) => c.role === "ready-for-agent");
    expect(ready?.issues.map((i) => i.number)).toEqual([2]);
  });

  it("buckets a category-only issue into the other column", () => {
    const columns = bucketIssuesByRole([issue(3, ["bug"])], mapping);
    const other = columns.find((c) => c.role === "other");
    expect(other?.issues.map((i) => i.number)).toEqual([3]);
  });

  it("puts every issue in the other column when mapping is null", () => {
    const columns = bucketIssuesByRole(
      [issue(4, ["ready-for-agent"]), issue(5, [])],
      null,
    );
    const other = columns.find((c) => c.role === "other");
    expect(other?.issues.map((i) => i.number)).toEqual([4, 5]);
    expect(columns.find((c) => c.role === "untriaged")?.issues).toEqual([]);
  });

  it("omits the other column when nothing lands there", () => {
    const columns = bucketIssuesByRole(
      [issue(6, ["ready-for-human"])],
      mapping,
    );
    expect(columns.some((c) => c.role === "other")).toBe(false);
  });

  it("shows empty state columns rather than hiding them", () => {
    const columns = bucketIssuesByRole(
      [issue(7, ["ready-for-agent"])],
      mapping,
    );
    const needsTriage = columns.find((c) => c.role === "needs-triage");
    expect(needsTriage).toBeDefined();
    expect(needsTriage?.issues).toEqual([]);
  });

  it("gives a human label, spacing hyphenated roles", () => {
    const columns = bucketIssuesByRole([], mapping);
    expect(columns.find((c) => c.role === "ready-for-agent")?.label).toBe(
      "ready for agent",
    );
    expect(columns.find((c) => c.role === "untriaged")?.label).toBe(
      "untriaged",
    );
  });
});
