import { Octokit } from "octokit";
import type { RepoRef } from "../config.ts";
import { GitHubAuthError } from "./issues.ts";

/**
 * Fetches a Managed repo's recent GitHub Actions workflow runs — the Agent runs
 * a Viewer watches per repo (CONTEXT.md "Agent run") — browser → GitHub API, as
 * the Viewer's own token (ADR-0001). Reuses Octokit and the same calm auth-error
 * handling as {@link fetchOpenIssues} so the two reads behave alike.
 */
export type RunStatus = "queued" | "running" | "succeeded" | "failed";

export interface AgentRun {
  id: number;
  /** Workflow name, falling back to the run's display title. */
  name: string;
  status: RunStatus;
  url: string;
  branch: string | null;
  createdAt: string;
}

export async function fetchAgentRuns(
  token: string,
  { owner, repo }: RepoRef,
  limit = 10,
): Promise<AgentRun[]> {
  const octokit = new Octokit({ auth: token });

  try {
    const res = await octokit.rest.actions.listWorkflowRunsForRepo({
      owner,
      repo,
      per_page: limit,
    });

    return res.data.workflow_runs.map((run) => ({
      id: run.id,
      name: run.name || run.display_title || "Agent run",
      status: normalizeRunStatus(run.status, run.conclusion),
      url: run.html_url,
      branch: run.head_branch ?? null,
      createdAt: run.created_at,
    }));
  } catch (err: unknown) {
    const status = (err as { status?: number }).status;
    if (status === 401 || status === 403) {
      throw new GitHubAuthError(
        "GitHub rejected that token for this repo. Check it hasn't expired and can read the repo.",
      );
    }
    throw err;
  }
}

/**
 * Collapses GitHub's two-field run state (status + conclusion) into the four
 * states a Viewer cares about. A completed run is succeeded only on a clean
 * success; every other conclusion (failure, cancelled, timed out) reads as
 * failed so nothing broken hides behind a green light.
 *
 * Exported so the MCP plugin's local-`gh` data source (#86) collapses run state
 * identically — GitHub's `gh run list` reports the same status/conclusion pair —
 * keeping the two surfaces from drifting on what counts as a success.
 */
export function normalizeRunStatus(
  status: string | null,
  conclusion: string | null,
): RunStatus {
  if (status === "completed") {
    return conclusion === "success" ? "succeeded" : "failed";
  }
  if (status === "in_progress") return "running";
  return "queued";
}
