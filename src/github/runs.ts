import { Octokit } from "octokit";
import type { RepoRef } from "../config.ts";
import { GitHubAuthError } from "./issues.ts";

/**
 * Fetches a Managed repo's recent GitHub Actions workflow runs — the Agent runs
 * a Viewer watches per repo (CONTEXT.md "Agent run") — as the Viewer's own token
 * (ADR-0001). GitHub's two-field status model (a `status` plus, once finished, a
 * `conclusion`) is collapsed into one canonical {@link RunState} so the UI maps
 * to a small, clear set of visual states.
 */
export type RunState = "queued" | "running" | "succeeded" | "failed" | "other";

export interface AgentRun {
  id: number;
  /** The run's display title, falling back to the workflow name. */
  name: string;
  state: RunState;
  url: string;
  createdAt: string;
  /** The branch the run is on, when reported. */
  branch: string | null;
}

const QUEUED = new Set(["queued", "waiting", "requested", "pending"]);
const FAILED = new Set(["failure", "timed_out", "startup_failure"]);

/**
 * Collapses GitHub's `status` (+ `conclusion` once `completed`) into one
 * canonical run state. Anything terminal that is neither a clean success nor a
 * recognised failure (cancelled, skipped, neutral, …) is "other" — surfaced
 * calmly rather than alarmingly.
 */
export function classifyRunState(
  status: string | null,
  conclusion: string | null,
): RunState {
  if (status === "completed") {
    if (conclusion === "success") return "succeeded";
    if (conclusion && FAILED.has(conclusion)) return "failed";
    return "other";
  }
  if (status === "in_progress") return "running";
  if (status && QUEUED.has(status)) return "queued";
  return "other";
}

interface RawRun {
  id: number;
  name?: string | null;
  display_title?: string | null;
  status: string | null;
  conclusion: string | null;
  html_url: string;
  created_at: string;
  head_branch?: string | null;
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

    return (res.data.workflow_runs as RawRun[]).map((run) => ({
      id: run.id,
      name: run.display_title || run.name || "Workflow run",
      state: classifyRunState(run.status, run.conclusion),
      url: run.html_url,
      createdAt: run.created_at,
      branch: run.head_branch ?? null,
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
