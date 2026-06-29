import { screen, within } from "@testing-library/react";
import { vi } from "vitest";
import { renderWithProviders } from "../test/render.tsx";
import { ReadyForAgentPool } from "./ReadyForAgentPool.tsx";
import type { RepoRef } from "../config.ts";

const fetchOpenIssues = vi.fn();
vi.mock("./issues.ts", async () => {
  const actual = await vi.importActual<typeof import("./issues.ts")>(
    "./issues.ts",
  );
  return {
    ...actual,
    fetchOpenIssues: (...a: unknown[]) => fetchOpenIssues(...a),
  };
});

const fetchTriageMapping = vi.fn();
vi.mock("./triageMapping.ts", async () => {
  const actual = await vi.importActual<typeof import("./triageMapping.ts")>(
    "./triageMapping.ts",
  );
  return {
    ...actual,
    fetchTriageMapping: (...a: unknown[]) => fetchTriageMapping(...a),
  };
});

const REPOS: RepoRef[] = [
  { owner: "alpha", repo: "one" },
  { owner: "beta", repo: "two" },
];

function issue(number: number, title: string, labels: string[]) {
  return {
    number,
    title,
    url: `https://github.com/o/r/issues/${number}`,
    createdAt: "2026-06-01T00:00:00Z",
    labels: labels.map((name) => ({ name, color: "" })),
    comments: 0,
  };
}

describe("ReadyForAgentPool", () => {
  beforeEach(async () => {
    fetchOpenIssues.mockReset();
    fetchTriageMapping.mockReset();
    const { defaultTriageMapping } = await vi.importActual<
      typeof import("../triage/mapping.ts")
    >("../triage/mapping.ts");
    fetchTriageMapping.mockResolvedValue(defaultTriageMapping());
  });

  it("lists every ready-for-agent issue across repos with its repo and title", async () => {
    fetchOpenIssues.mockImplementation((_t: string, repo?: RepoRef) =>
      repo?.repo === "two"
        ? Promise.resolve([issue(20, "Wire the worker", ["ready-for-agent"])])
        : Promise.resolve([
            issue(10, "Bake the JSON", ["ready-for-agent"]),
            issue(11, "Awaiting decision", ["needs-triage"]),
          ]),
    );

    renderWithProviders(<ReadyForAgentPool token="t" repos={REPOS} />);

    await screen.findByRole("link", { name: /bake the json/i });
    const pool = screen.getByRole("region", {
      name: /ready for an agent/i,
    });
    expect(
      within(pool).getByRole("link", { name: /wire the worker/i }),
    ).toBeInTheDocument();
    expect(within(pool).getByText(/alpha\/one/i)).toBeInTheDocument();
    expect(within(pool).getByText(/beta\/two/i)).toBeInTheDocument();
    // Other states are not the agent pool's concern.
    expect(
      within(pool).queryByRole("link", { name: /awaiting decision/i }),
    ).toBeNull();
  });

  it("shows a total count of agent-ready work", async () => {
    fetchOpenIssues.mockResolvedValue([
      issue(1, "One", ["ready-for-agent"]),
      issue(2, "Two", ["ready-for-agent"]),
      issue(3, "Three", ["needs-triage"]),
    ]);

    renderWithProviders(
      <ReadyForAgentPool token="t" repos={[{ owner: "alpha", repo: "one" }]} />,
    );

    await screen.findByRole("link", { name: /#1 one/i });
    const pool = screen.getByRole("region", {
      name: /ready for an agent/i,
    });
    expect(within(pool).getByText("2")).toBeInTheDocument();
  });

  it("calmly states when no agent-ready work exists", async () => {
    fetchOpenIssues.mockResolvedValue([issue(1, "Awaiting", ["needs-triage"])]);

    renderWithProviders(
      <ReadyForAgentPool token="t" repos={[{ owner: "alpha", repo: "one" }]} />,
    );

    expect(
      await screen.findByText(/no agent-ready work right now/i),
    ).toBeInTheDocument();
  });
});
