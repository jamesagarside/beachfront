import { render, screen } from "@testing-library/react";
import { RunMetricsPanel } from "./RunMetricsPanel.tsx";
import type { AgentRun, RunStatus } from "../github/runs.ts";

function run(id: number, status: RunStatus, createdAt = "2026-06-01T00:00:00Z"): AgentRun {
  return {
    id,
    name: `Run ${id}`,
    status,
    url: `https://github.com/o/r/actions/runs/${id}`,
    branch: null,
    createdAt,
  };
}

describe("RunMetricsPanel", () => {
  it("shows success and failure counts and the settled success rate", () => {
    render(
      <RunMetricsPanel
        runs={[
          run(1, "succeeded"),
          run(2, "succeeded"),
          run(3, "succeeded"),
          run(4, "failed"),
        ]}
      />,
    );

    // Succeeded tile = 3, Failed tile = 1, rate = 75%.
    expect(screen.getByText("Succeeded")).toBeTruthy();
    expect(screen.getByText("Failed")).toBeTruthy();
    expect(screen.getByText("Success rate")).toBeTruthy();
    expect(screen.getByText("75%")).toBeTruthy();
  });

  it("renders the recent throughput total for the window", () => {
    render(
      <RunMetricsPanel
        runs={[run(1, "running"), run(2, "succeeded"), run(3, "failed")]}
      />,
    );

    expect(screen.getByText("Runs in window")).toBeTruthy();
    // The total tile reads 3.
    const total = screen.getByText("Runs in window").parentElement;
    expect(total?.textContent).toContain("3");
  });

  it("shows '—' for the success rate when nothing has settled", () => {
    render(<RunMetricsPanel runs={[run(1, "running"), run(2, "queued")]} />);

    expect(screen.getByText("—")).toBeTruthy();
  });

  it("renders the not-yet-populated token-usage slot (ADR-0009)", () => {
    render(<RunMetricsPanel runs={[run(1, "succeeded")]} />);

    expect(screen.getByText("Token usage")).toBeTruthy();
    expect(screen.getByText("not yet reported")).toBeTruthy();
  });

  it("renders a calm empty state when there are no runs", () => {
    render(<RunMetricsPanel runs={[]} />);

    expect(screen.getByText("No agent runs yet — all quiet.")).toBeTruthy();
    expect(screen.queryByText("Success rate")).toBeNull();
  });
});
