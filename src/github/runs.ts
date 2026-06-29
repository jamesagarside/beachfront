import { Octokit } from "octokit";
import type { RepoRef } from "../config.ts";
import { GitHubAuthError } from "./issues.ts";

/**
 * Fetches a Managed repo's recent Agent runs (#10) — GitHub Actions workflow
 * runs, browser → GitHub API, as the Viewer's own token (ADR-0001). An Agent
 * run is one execution of Sandcastle observed as a workflow run (see
 * CONTEXT.md). GitHub's two-field status (`status` + `conclusion`) is folded
 * into the four canonical states a Viewer watches.
 */
export type RunStatus = "queued" | "running" | "succeeded" | "failed";

export interface AgentRun {
  id: number;
  name: string;
  status: RunStatus;
  url: string;
  createdAt: string;
  /** The run's head branch, if any — the branch the agent worked on. */
  branch: string | null;
}

/**
 * Collapses GitHub Actions' `status`/`conclusion` pair into one canonical
 * {@link RunStatus}. A finished run is succeeded only on a `success`
 * conclusion; every other conclusion (failure, timed_out, cancelled, …) reads
 * as failed. Anything not yet started counts as queued.
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

export async function fetchAgentRuns(
  token: string,
  { owner, repo }: RepoRef,
): Promise<AgentRun[]> {
  const octokit = new Octokit({ auth: token });

  try {
    const res = await octokit.rest.actions.listWorkflowRunsForRepo({
      owner,
      repo,
      per_page: 10,
    });

    return res.data.workflow_runs.map((run) => ({
      id: run.id,
      name: run.display_title || run.name || "Agent run",
      status: normalizeRunStatus(run.status, run.conclusion),
      url: run.html_url,
      createdAt: run.created_at,
      branch: run.head_branch ?? null,
    }));
  } catch (err: unknown) {
    const status = (err as { status?: number }).status;
    if (status === 401 || status === 403) {
      throw new GitHubAuthError(
        "GitHub rejected that token for this repo's Actions. Check it hasn't expired and can read the repo.",
      );
    }
    throw err;
  }
}
