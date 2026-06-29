import { vi } from "vitest";
import { fetchAgentRuns, classifyRunState } from "./runs.ts";
import { GitHubAuthError } from "./issues.ts";

const listWorkflowRunsForRepo = vi.fn();

vi.mock("octokit", () => ({
  Octokit: vi.fn().mockImplementation(() => ({
    rest: { actions: { listWorkflowRunsForRepo } },
  })),
}));

const REPO = { owner: "jamesagarside", repo: "beachfront" };

// Each test sets its own mock implementation (mirroring issues.test.ts) so no
// reset hook is needed and a rejected-promise mock keeps vitest's guard intact.
describe("classifyRunState", () => {
  it("maps an in-progress run to running", () => {
    expect(classifyRunState("in_progress", null)).toBe("running");
  });

  it("maps queued/waiting/requested/pending to queued", () => {
    for (const status of ["queued", "waiting", "requested", "pending"]) {
      expect(classifyRunState(status, null)).toBe("queued");
    }
  });

  it("maps a completed success to succeeded", () => {
    expect(classifyRunState("completed", "success")).toBe("succeeded");
  });

  it("maps a completed failure/timeout/startup_failure to failed", () => {
    for (const c of ["failure", "timed_out", "startup_failure"]) {
      expect(classifyRunState("completed", c)).toBe("failed");
    }
  });

  it("maps a cancelled/skipped/neutral completion to other", () => {
    for (const c of ["cancelled", "skipped", "neutral"]) {
      expect(classifyRunState("completed", c)).toBe("other");
    }
  });
});

describe("fetchAgentRuns", () => {
  it("requests recent workflow runs for the configured repo", async () => {
    listWorkflowRunsForRepo.mockResolvedValue({ data: { workflow_runs: [] } });
    await fetchAgentRuns("token", REPO);
    expect(listWorkflowRunsForRepo).toHaveBeenLastCalledWith(
      expect.objectContaining({
        owner: "jamesagarside",
        repo: "beachfront",
      }),
    );
  });

  it("maps runs to name, state, url, branch and age", async () => {
    listWorkflowRunsForRepo.mockResolvedValue({
      data: {
        workflow_runs: [
          {
            id: 7,
            name: "Sandcastle",
            display_title: "RALPH: do the thing",
            status: "completed",
            conclusion: "success",
            html_url: "https://github.com/o/r/actions/runs/7",
            created_at: "2026-06-20T00:00:00Z",
            head_branch: "ralph/work",
          },
        ],
      },
    });

    const runs = await fetchAgentRuns("token", REPO);

    expect(runs).toEqual([
      {
        id: 7,
        name: "RALPH: do the thing",
        state: "succeeded",
        url: "https://github.com/o/r/actions/runs/7",
        createdAt: "2026-06-20T00:00:00Z",
        branch: "ralph/work",
      },
    ]);
  });

  it("falls back to the workflow name when there is no display title", async () => {
    listWorkflowRunsForRepo.mockResolvedValue({
      data: {
        workflow_runs: [
          {
            id: 1,
            name: "CI",
            display_title: "",
            status: "queued",
            conclusion: null,
            html_url: "u",
            created_at: "2026-06-20T00:00:00Z",
            head_branch: null,
          },
        ],
      },
    });

    const [run] = await fetchAgentRuns("token", REPO);
    expect(run.name).toBe("CI");
    expect(run.branch).toBeNull();
    expect(run.state).toBe("queued");
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
