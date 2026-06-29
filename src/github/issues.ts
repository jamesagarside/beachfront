import { Octokit } from "octokit";
import type { RepoRef } from "../config.ts";

/**
 * Fetches a single configured repo's open issues, browser → GitHub API, as the
 * Viewer's own token (ADR-0001). Uses Octokit so later slices inherit its
 * pagination, typing, and auth handling. Pull requests (which the issues
 * endpoint also returns) are filtered out — Beachfront aggregates issues.
 */
export interface IssueLabel {
  name: string;
  color: string;
}

export interface Issue {
  number: number;
  title: string;
  url: string;
  labels: IssueLabel[];
  createdAt: string;
}

export class GitHubAuthError extends Error {}

export async function fetchOpenIssues(
  token: string,
  { owner, repo }: RepoRef,
): Promise<Issue[]> {
  const octokit = new Octokit({ auth: token });

  try {
    const res = await octokit.rest.issues.listForRepo({
      owner,
      repo,
      state: "open",
      per_page: 100,
    });

    return res.data
      .filter((item) => !item.pull_request)
      .map((item) => ({
        number: item.number,
        title: item.title,
        url: item.html_url,
        createdAt: item.created_at,
        labels: item.labels.map(normalizeLabel),
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

type RawLabel = string | { name?: string; color?: string | null };

function normalizeLabel(label: RawLabel): IssueLabel {
  if (typeof label === "string") return { name: label, color: "" };
  return { name: label.name ?? "", color: label.color ?? "" };
}
