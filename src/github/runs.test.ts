import { vi } from "vitest";
import { fetchAgentRuns } from "./runs.ts";
import { GitHubAuthError } from "./issues.ts";

const listWorkflowRunsForRepo = vi.fn();

vi.mock("octokit", () => ({
  Octokit: vi.fn().mockImplementation(() => ({
    rest: { actions: { listWorkflowRunsForRepo } },
  })),
}));

const REPO = { owner: "jamesagarside", repo: "beachfront" };

function run(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    name: "Sandcastle",
    display_title: "Drain backlog",
    status: "completed",
    conclusion: "success",
    html_url: "https://github.com/o/r/actions/runs/1",
    head_branch: "ralph/work",
    created_at: "2026-06-01T00:00:00Z",
    ...overrides,
  };
}

// Each test sets its own mock implementation, mirroring issues.test.ts — no
// reset hook, so a rejected promise keeps vitest's unhandled-rejection guard.
describe("fetchAgentRuns", () => {
  it("requests recent workflow runs for the configured repo", async () => {
    listWorkflowRunsForRepo.mockResolvedValue({ data: { workflow_runs: [] } });
    await fetchAgentRuns("token", REPO);
    expect(listWorkflowRunsForRepo).toHaveBeenLastCalledWith(
      expect.objectContaining({ owner: "jamesagarside", repo: "beachfront" }),
    );
  });

  it("maps a run to name, status, url, branch and age", async () => {
    listWorkflowRunsForRepo.mockResolvedValue({
      data: { workflow_runs: [run()] },
    });

    const runs = await fetchAgentRuns("token", REPO);

    expect(runs).toEqual([
      {
        id: 1,
        name: "Sandcastle",
        status: "succeeded",
        url: "https://github.com/o/r/actions/runs/1",
        branch: "ralph/work",
        createdAt: "2026-06-01T00:00:00Z",
      },
    ]);
  });

  it("normalizes the GitHub status/conclusion pair into clear states", async () => {
    listWorkflowRunsForRepo.mockResolvedValue({
      data: {
        workflow_runs: [
          run({ id: 1, status: "queued", conclusion: null }),
          run({ id: 2, status: "in_progress", conclusion: null }),
          run({ id: 3, status: "completed", conclusion: "success" }),
          run({ id: 4, status: "completed", conclusion: "failure" }),
          run({ id: 5, status: "completed", conclusion: "cancelled" }),
        ],
      },
    });

    const runs = await fetchAgentRuns("token", REPO);
    expect(runs.map((r) => r.status)).toEqual([
      "queued",
      "running",
      "succeeded",
      "failed",
      "failed",
    ]);
  });

  it("falls back to the display title when a run has no workflow name", async () => {
    listWorkflowRunsForRepo.mockResolvedValue({
      data: { workflow_runs: [run({ name: "", display_title: "Fallback" })] },
    });
    const runs = await fetchAgentRuns("token", REPO);
    expect(runs[0].name).toBe("Fallback");
  });

  it("raises a clear auth error on 401/403", async () => {
    listWorkflowRunsForRepo.mockRejectedValue({ status: 403 });
    await expect(fetchAgentRuns("bad", REPO)).rejects.toBeInstanceOf(
      GitHubAuthError,
    );
  });

  it("rethrows other errors unchanged", async () => {
    listWorkflowRunsForRepo.mockRejectedValue(new Error("network down"));
    await expect(fetchAgentRuns("token", REPO)).rejects.toThrow(/network down/);
  });
});
