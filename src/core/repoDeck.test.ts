import { buildRepoDeck, DECK_COLUMN_ORDER } from "./repoDeck.ts";
import { makeIssue, makeRun } from "./testSource.ts";
import { defaultTriageMapping } from "../triage/mapping.ts";
import type { RepoEstate } from "./estate.ts";
import type { AgentRun } from "../github/runs.ts";
import type { Issue } from "../github/issues.ts";

const REPO = { owner: "alpha", repo: "one" };
const mapping = defaultTriageMapping();

function label(name: string) {
  return { name, color: "" };
}

function estate(issues: Issue[], runs: AgentRun[] = []): RepoEstate {
  return { repo: REPO, issues, mapping, runs };
}

describe("buildRepoDeck — kanban", () => {
  it("orders columns by lifecycle, untriaged first", () => {
    const deck = buildRepoDeck(estate([]));
    expect(deck.columns.map((c) => c.role)).toEqual([
      "untriaged",
      "needs-triage",
      "needs-info",
      "ready-for-agent",
      "ready-for-human",
      "wontfix",
    ]);
    expect(DECK_COLUMN_ORDER[0]).toBe("untriaged");
  });

  it("buckets each issue into its canonical state-role column", () => {
    const deck = buildRepoDeck(
      estate([
        makeIssue({ number: 1, labels: [label("ready-for-agent")] }),
        makeIssue({ number: 2, labels: [label("needs-triage")] }),
      ]),
    );

    const column = (role: string) =>
      deck.columns.find((c) => c.role === role)!.issues.map((i) => i.number);
    expect(column("ready-for-agent")).toEqual([1]);
    expect(column("needs-triage")).toEqual([2]);
  });

  it("drops an issue with no recognized state role into untriaged", () => {
    const deck = buildRepoDeck(
      estate([makeIssue({ number: 1, labels: [] })]),
    );
    expect(
      deck.columns.find((c) => c.role === "untriaged")!.issues.map((i) => i.number),
    ).toEqual([1]);
  });

  it("reports per-column counts", () => {
    const deck = buildRepoDeck(
      estate([
        makeIssue({ number: 1, labels: [label("ready-for-agent")] }),
        makeIssue({ number: 2, labels: [label("ready-for-agent")] }),
        makeIssue({ number: 3, labels: [] }),
      ]),
    );
    expect(deck.counts["ready-for-agent"]).toBe(2);
    expect(deck.counts.untriaged).toBe(1);
    expect(deck.counts["needs-info"]).toBe(0);
  });

  it("can't classify a repo with no mapping — everything lands in untriaged", () => {
    const deck = buildRepoDeck({
      repo: REPO,
      mapping: null,
      runs: [],
      issues: [makeIssue({ number: 1, labels: [label("ready-for-agent")] })],
    });
    expect(deck.counts.untriaged).toBe(1);
    expect(deck.counts["ready-for-agent"]).toBe(0);
  });
});

describe("buildRepoDeck — run summary", () => {
  it("counts runs per status", () => {
    const deck = buildRepoDeck(
      estate([], [
        makeRun({ id: 1, status: "running" }),
        makeRun({ id: 2, status: "queued" }),
        makeRun({ id: 3, status: "succeeded" }),
        makeRun({ id: 4, status: "succeeded" }),
        makeRun({ id: 5, status: "failed" }),
      ]),
    );
    expect(deck.runs).toMatchObject({
      total: 5,
      running: 1,
      queued: 1,
      succeeded: 2,
      failed: 1,
    });
  });

  it("computes success rate over finished runs only", () => {
    const deck = buildRepoDeck(
      estate([], [
        makeRun({ id: 1, status: "succeeded" }),
        makeRun({ id: 2, status: "failed" }),
        makeRun({ id: 3, status: "failed" }),
        makeRun({ id: 4, status: "running" }),
      ]),
    );
    expect(deck.runs.successRate).toBeCloseTo(1 / 3);
  });

  it("leaves success rate null when no run has finished", () => {
    const deck = buildRepoDeck(
      estate([], [makeRun({ id: 1, status: "running" })]),
    );
    expect(deck.runs.successRate).toBeNull();
  });
});
