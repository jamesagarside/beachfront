import { screen, waitFor, within } from "@testing-library/react";
import { vi } from "vitest";
import { renderWithProviders } from "../test/render.tsx";
import { RegistryRuns } from "./RegistryRuns.tsx";
import { GitHubAuthError } from "./issues.ts";
import type { AgentRun, RunState } from "./runs.ts";
import type { RepoRef } from "../config.ts";

const fetchAgentRuns = vi.fn();
vi.mock("./runs.ts", async () => {
  const actual = await vi.importActual<typeof import("./runs.ts")>("./runs.ts");
  return {
    ...actual,
    fetchAgentRuns: (...a: unknown[]) => fetchAgentRuns(...a),
  };
});

const REPOS: RepoRef[] = [
  { owner: "alpha", repo: "one" },
  { owner: "beta", repo: "two" },
];

function run(id: number, name: string, state: RunState): AgentRun {
  return {
    id,
    name,
    state,
    url: `https://github.com/o/r/actions/runs/${id}`,
    createdAt: "2026-06-20T00:00:00Z",
    branch: "ralph/work",
  };
}

describe("RegistryRuns", () => {
  beforeEach(() => fetchAgentRuns.mockReset());

  it("renders recent runs from every accessible repo, grouped by repo, with status and link", async () => {
    fetchAgentRuns.mockImplementation((_token: string, repo?: RepoRef) =>
      repo?.repo === "two"
        ? Promise.resolve([run(2, "Second run", "running")])
        : Promise.resolve([run(1, "First run", "succeeded")]),
    );

    renderWithProviders(<RegistryRuns token="t" repos={REPOS} />);

    const alpha = await screen.findByRole("region", { name: /alpha\/one/i });
    const link = within(alpha).getByRole("link", { name: /first run/i });
    expect(link).toHaveAttribute(
      "href",
      "https://github.com/o/r/actions/runs/1",
    );
    expect(within(alpha).getByText(/succeeded/i)).toBeInTheDocument();

    const beta = screen.getByRole("region", { name: /beta\/two/i });
    expect(within(beta).getByText(/running/i)).toBeInTheDocument();
  });

  it("skips an inaccessible repo without breaking the rest of the view", async () => {
    fetchAgentRuns.mockImplementation((_token: string, repo?: RepoRef) =>
      repo?.repo === "two"
        ? Promise.reject(new GitHubAuthError("no access"))
        : Promise.resolve([run(1, "Visible run", "running")]),
    );

    renderWithProviders(<RegistryRuns token="t" repos={REPOS} />);

    expect(
      await screen.findByRole("link", { name: /visible run/i }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /beta\/two/i })).toBeNull();
    await waitFor(() =>
      expect(screen.getByText(/skipped 1 repo/i)).toBeInTheDocument(),
    );
  });

  it("shows a calm empty state for a repo with no runs", async () => {
    fetchAgentRuns.mockResolvedValue([]);
    renderWithProviders(
      <RegistryRuns token="t" repos={[{ owner: "alpha", repo: "one" }]} />,
    );
    expect(await screen.findByText(/no agent runs yet/i)).toBeInTheDocument();
  });
});
