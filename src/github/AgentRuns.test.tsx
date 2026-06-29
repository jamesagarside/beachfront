import { screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { renderWithProviders } from "../test/render.tsx";
import { AgentRuns } from "./AgentRuns.tsx";
import { GitHubAuthError } from "./issues.ts";

const fetchAgentRuns = vi.fn();
vi.mock("./runs.ts", async () => {
  const actual = await vi.importActual<typeof import("./runs.ts")>("./runs.ts");
  return { ...actual, fetchAgentRuns: (...a: unknown[]) => fetchAgentRuns(...a) };
});

const REPO = { owner: "jamesagarside", repo: "beachfront" };

function run(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    name: "Sandcastle",
    status: "running",
    url: "https://github.com/o/r/actions/runs/1",
    branch: "ralph/work",
    createdAt: "2026-06-28T00:00:00Z",
    ...overrides,
  };
}

describe("AgentRuns", () => {
  it("renders each run's name, status, branch, age and link", async () => {
    fetchAgentRuns.mockResolvedValue([run()]);

    renderWithProviders(<AgentRuns token="t" repo={REPO} />);

    const link = await screen.findByRole("link", { name: /sandcastle/i });
    expect(link).toHaveAttribute(
      "href",
      "https://github.com/o/r/actions/runs/1",
    );
    expect(screen.getByText("running")).toBeInTheDocument();
    expect(screen.getByText(/ralph\/work/)).toBeInTheDocument();
    expect(screen.getByText(/started/i)).toBeInTheDocument();
  });

  it("renders the distinct run states", async () => {
    fetchAgentRuns.mockResolvedValue([
      run({ id: 1, status: "queued" }),
      run({ id: 2, status: "running" }),
      run({ id: 3, status: "succeeded" }),
      run({ id: 4, status: "failed" }),
    ]);

    renderWithProviders(<AgentRuns token="t" repo={REPO} />);

    expect(await screen.findByText("queued")).toBeInTheDocument();
    expect(screen.getByText("running")).toBeInTheDocument();
    expect(screen.getByText("succeeded")).toBeInTheDocument();
    expect(screen.getByText("failed")).toBeInTheDocument();
  });

  it("shows a calm empty state when there are no runs", async () => {
    fetchAgentRuns.mockResolvedValue([]);
    renderWithProviders(<AgentRuns token="t" repo={REPO} />);
    expect(await screen.findByText(/all quiet/i)).toBeInTheDocument();
  });

  it("surfaces a rejected token clearly", async () => {
    fetchAgentRuns.mockRejectedValue(new GitHubAuthError("token rejected"));
    renderWithProviders(<AgentRuns token="bad" repo={REPO} />);
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/token rejected/i),
    );
  });
});
