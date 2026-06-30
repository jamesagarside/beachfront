import { screen, within } from "@testing-library/react";
import { vi } from "vitest";
import { renderWithProviders } from "../test/render.tsx";
import { RunningAgentsSummary } from "./RunningAgentsSummary.tsx";
import type { RepoRef } from "../config.ts";

const fetchAgentRuns = vi.fn();
vi.mock("./runs.ts", async () => {
  const actual = await vi.importActual<typeof import("./runs.ts")>("./runs.ts");
  return { ...actual, fetchAgentRuns: (...a: unknown[]) => fetchAgentRuns(...a) };
});

const REPOS: RepoRef[] = [
  { owner: "alpha", repo: "one" },
  { owner: "beta", repo: "two" },
];

function run(id: number, status: string) {
  return {
    id,
    name: `Run ${id}`,
    status,
    url: `https://github.com/o/r/actions/runs/${id}`,
    branch: null,
    createdAt: "2026-06-01T00:00:00Z",
  };
}

function tile(name: RegExp) {
  // dt + dd live in the same flex column; find the dt then read its sibling dd.
  return screen.getByText(name).parentElement as HTMLElement;
}

describe("RunningAgentsSummary", () => {
  beforeEach(() => fetchAgentRuns.mockReset());

  it("sums running, queued and failed counts across all repos", async () => {
    fetchAgentRuns.mockImplementation((_t: string, repo?: RepoRef) =>
      repo?.repo === "two"
        ? Promise.resolve([run(4, "running"), run(5, "succeeded")])
        : Promise.resolve([
            run(1, "running"),
            run(2, "queued"),
            run(3, "failed"),
          ]),
    );

    renderWithProviders(<RunningAgentsSummary token="t" repos={REPOS} />);

    await screen.findByText(/^running$/i);
    expect(within(tile(/^running$/i)).getByText("2")).toBeInTheDocument();
    expect(within(tile(/^queued$/i)).getByText("1")).toBeInTheDocument();
    expect(within(tile(/recently failed/i)).getByText("1")).toBeInTheDocument();
  });

  it("states calmly when no agents are active anywhere", async () => {
    fetchAgentRuns.mockResolvedValue([run(1, "succeeded")]);

    renderWithProviders(
      <RunningAgentsSummary token="t" repos={[{ owner: "alpha", repo: "one" }]} />,
    );

    expect(
      await screen.findByText(/no agents running anywhere/i),
    ).toBeInTheDocument();
  });

  it("surfaces a failed run prominently even when nothing is running", async () => {
    fetchAgentRuns.mockResolvedValue([run(1, "failed")]);

    renderWithProviders(
      <RunningAgentsSummary token="t" repos={[{ owner: "alpha", repo: "one" }]} />,
    );

    await screen.findByText(/recently failed/i);
    const failed = tile(/recently failed/i);
    expect(within(failed).getByText("1")).toBeInTheDocument();
    // Plainly coloured, not alarm-styled (coral text, no red background block).
    expect(within(failed).getByText("1").className).toMatch(/text-coral/);
  });
});
