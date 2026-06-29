import { vi } from "vitest";
import { fetchAgentRuns, normalizeRunStatus } from "./runs.ts";
import { GitHubAuthError } from "./issues.ts";

const listWorkflowRunsForRepo = vi.fn();

vi.mock("octokit", () => ({
  Octokit: vi.fn().mockImplementation(() => ({
    rest: { actions: { listWorkflowRunsForRepo } },
  })),
}));

const REPO = { owner: "jamesagarside", repo: "beachfront" };

describe("normalizeRunStatus", () => {
  it("maps a completed run that succeeded to succeeded", () => {
    expect(normalizeRunStatus("completed", "success")).toBe("succeeded");
  });

  it("maps a completed run with any other conclusion to failed", () => {
    expect(normalizeRunStatus("completed", "failure")).toBe("failed");
    expect(normalizeRunStatus("completed", "timed_out")).toBe("failed");
    expect(normalizeRunStatus("completed", "cancelled")).toBe("failed");
    expect(normalizeRunStatus("completed", null)).toBe("failed");
  });

  it("maps an in-progress run to running", () => {
    expect(normalizeRunStatus("in_progress", null)).toBe("running");
  });

  it("maps queued/waiting/requested/pending runs to queued", () => {
    expect(normalizeRunStatus("queued", null)).toBe("queued");
    expect(normalizeRunStatus("waiting", null)).toBe("queued");
    expect(normalizeRunStatus("requested", null)).toBe("queued");
    expect(normalizeRunStatus("pending", null)).toBe("queued");
  });
});

// Each test sets its own mock implementation (which overwrites the last), so no
// reset hook is needed — mirroring issues.test.ts to keep the unhandled-rejection
// guard attached for the rejecting cases.
describe("fetchAgentRuns", () => {
  it("requests recent workflow runs for the repo", async () => {
    listWorkflowRunsForRepo.mockResolvedValue({ data: { workflow_runs: [] } });
    await fetchAgentRuns("token", REPO);
    expect(listWorkflowRunsForRepo).toHaveBeenLastCalledWith(
      expect.objectContaining({ owner: "jamesagarside", repo: "beachfront" }),
    );
  });

  it("maps runs to id, name, status, url, branch and age", async () => {
    listWorkflowRunsForRepo.mockResolvedValue({
      data: {
        workflow_runs: [
          {
            id: 99,
            name: "Sandcastle",
            display_title: "RALPH: fix the thing",
            status: "completed",
            conclusion: "success",
            html_url: "https://github.com/o/r/actions/runs/99",
            created_at: "2026-06-01T00:00:00Z",
            head_branch: "ralph/x",
          },
        ],
      },
    });

    const runs = await fetchAgentRuns("token", REPO);

    expect(runs).toEqual([
      {
        id: 99,
        name: "RALPH: fix the thing",
        status: "succeeded",
        url: "https://github.com/o/r/actions/runs/99",
        createdAt: "2026-06-01T00:00:00Z",
        branch: "ralph/x",
      },
    ]);
  });

  it("falls back to the workflow name when a run has no display title", async () => {
    listWorkflowRunsForRepo.mockResolvedValue({
      data: {
        workflow_runs: [
          {
            id: 1,
            name: "Sandcastle",
            display_title: "",
            status: "in_progress",
            conclusion: null,
            html_url: "u",
            created_at: "2026-06-01T00:00:00Z",
            head_branch: null,
          },
        ],
      },
    });

    const [run] = await fetchAgentRuns("token", REPO);
    expect(run.name).toBe("Sandcastle");
    expect(run.status).toBe("running");
    expect(run.branch).toBeNull();
  });

  it("raises a clear auth error on 401/403", async () => {
    listWorkflowRunsForRepo.mockRejectedValue({ status: 401 });
    await expect(fetchAgentRuns("bad", REPO)).rejects.toBeInstanceOf(
      GitHubAuthError,
    );
  });

  it("rethrows other errors unchanged", async () => {
    listWorkflowRunsForRepo.mockRejectedValue(new Error("network down"));
    await expect(fetchAgentRuns("token", REPO)).rejects.toThrow(/network down/);
  });
});
