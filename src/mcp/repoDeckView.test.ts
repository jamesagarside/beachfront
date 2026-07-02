import { aggregateEstate } from "../core/estate.ts";
import { makeIssue, makeRun, mockDataSource } from "../core/testSource.ts";
import { DECK_COLUMN_ORDER } from "../core/repoDeck.ts";
import { defaultTriageMapping } from "../triage/mapping.ts";
import { buildRepoDeckView, renderRepoDeckText } from "./repoDeckView.ts";

const REPO = { owner: "octo", repo: "alpha" };

async function deckFor(
  fixture: Parameters<typeof mockDataSource>[0][number],
  current: string | null = "cur1234",
) {
  const estate = await aggregateEstate(mockDataSource([fixture]));
  return buildRepoDeckView(estate.repos[0], current);
}

describe("buildRepoDeckView", () => {
  it("buckets issues into board columns by triage role, in board order", async () => {
    const view = await deckFor({
      repo: REPO,
      mapping: defaultTriageMapping(),
      issues: [
        makeIssue({ number: 1, labels: [{ name: "needs-triage", color: "" }] }),
        makeIssue({ number: 2, labels: [{ name: "ready-for-agent", color: "" }] }),
        makeIssue({ number: 3, labels: [{ name: "ready-for-agent", color: "" }] }),
        makeIssue({ number: 4, labels: [] }), // no role → untriaged
      ],
    });

    expect(view.owner).toBe("octo");
    expect(view.repo).toBe("alpha");
    // Every canonical column is present, in board order, even when empty.
    expect(view.columns.map((c) => c.role)).toEqual([...DECK_COLUMN_ORDER]);

    const byRole = Object.fromEntries(view.columns.map((c) => [c.role, c.cards]));
    expect(byRole["untriaged"].map((c) => c.number)).toEqual([4]);
    expect(byRole["needs-triage"].map((c) => c.number)).toEqual([1]);
    expect(byRole["ready-for-agent"].map((c) => c.number)).toEqual([2, 3]);
    expect(byRole["needs-info"]).toEqual([]);
  });

  it("carries each card's number, title and GitHub link, and per-column counts", async () => {
    const view = await deckFor({
      repo: REPO,
      mapping: defaultTriageMapping(),
      issues: [
        makeIssue({
          number: 7,
          title: "Fix the tide chart",
          url: "https://github.com/octo/alpha/issues/7",
          labels: [{ name: "ready-for-agent", color: "" }],
        }),
      ],
    });

    const card = view.columns.find((c) => c.role === "ready-for-agent")!.cards[0];
    expect(card).toEqual({
      number: 7,
      title: "Fix the tide chart",
      url: "https://github.com/octo/alpha/issues/7",
    });
    expect(view.counts["ready-for-agent"]).toBe(1);
    expect(view.counts["untriaged"]).toBe(0);
  });

  it("summarises the repo's Agent runs as the pinned metrics strip", async () => {
    const view = await deckFor({
      repo: REPO,
      issues: [],
      runs: [
        makeRun({ id: 1, status: "running" }),
        makeRun({ id: 2, status: "succeeded" }),
        makeRun({ id: 3, status: "succeeded" }),
        makeRun({ id: 4, status: "failed" }),
      ],
    });

    expect(view.runs.running).toBe(1);
    expect(view.runs.succeeded).toBe(2);
    expect(view.runs.failed).toBe(1);
    expect(view.runs.successRate).toBeCloseTo(2 / 3);
  });
});

describe("renderRepoDeckText", () => {
  it("renders a calm per-role summary and run strip for non-UI hosts", async () => {
    const view = await deckFor({
      repo: REPO,
      mapping: defaultTriageMapping(),
      issues: [
        makeIssue({
          number: 2,
          title: "Hand off backlog",
          labels: [{ name: "ready-for-agent", color: "" }],
        }),
      ],
      runs: [makeRun({ id: 1, status: "running" })],
    });

    const text = renderRepoDeckText(view);
    expect(text).toContain("octo/alpha");
    // Only non-empty roles appear in the headline summary, in board order.
    expect(text).toContain("1 ready-for-agent");
    expect(text).not.toContain("0 needs-info");
    // The run strip is pinned at the top.
    expect(text).toMatch(/1 running/);
    // Cards list the issue with its number and a link.
    expect(text).toContain("#2");
    expect(text).toContain("Hand off backlog");
  });

  it("reads honestly when the repo has no open issues and no runs", async () => {
    const view = await deckFor({ repo: REPO, issues: [], runs: [] });
    const text = renderRepoDeckText(view);
    expect(text.toLowerCase()).toContain("no open issues");
    expect(text.toLowerCase()).toContain("no runs yet");
  });

  it("names the harness fix for a behind repo (#115)", async () => {
    const view = await deckFor(
      { repo: REPO, issues: [], runs: [], harnessVersion: "old9999" },
      "cur1234",
    );
    const text = renderRepoDeckText(view);
    expect(text.toLowerCase()).toContain("harness — behind");
    expect(text).toContain("scripts/beachfront-update.sh octo/alpha");
  });

  it("stays silent about the harness when the repo is current", async () => {
    const view = await deckFor(
      { repo: REPO, issues: [], runs: [], harnessVersion: "cur1234" },
      "cur1234",
    );
    expect(renderRepoDeckText(view).toLowerCase()).not.toContain("harness");
  });

  it("notes an unknown vintage for an unstamped repo without pushing a fix", async () => {
    const view = await deckFor({ repo: REPO, issues: [], runs: [] }, "cur1234");
    const text = renderRepoDeckText(view);
    expect(text.toLowerCase()).toContain("vintage unknown");
    expect(text).not.toContain("beachfront-update.sh");
  });
});

describe("buildRepoDeckView — harness drift (#115)", () => {
  it("carries the drift state onto the view", async () => {
    const behind = await deckFor(
      { repo: REPO, issues: [], harnessVersion: "old9999" },
      "cur1234",
    );
    expect(behind.harness.state).toBe("behind");
    expect(behind.harness.fix).toBe("scripts/beachfront-update.sh octo/alpha");

    const current = await deckFor(
      { repo: REPO, issues: [], harnessVersion: "cur1234" },
      "cur1234",
    );
    expect(current.harness.state).toBe("current");
  });
});
