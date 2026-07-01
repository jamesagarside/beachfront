import { Octokit } from "octokit";
import type { RepoRef } from "../config.ts";

/**
 * Fetches a single configured repo's open issues, browser → GitHub API, as the
 * Viewer's own token (ADR-0001). Uses Octokit's paginator so a repo with more
 * than a page of open issues is read in full, not truncated at 100. Pull
 * requests (which the issues endpoint also returns) are filtered out —
 * Beachfront aggregates issues.
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
  /** Comment count — the cheap proxy for reporter activity on `needs-info`. */
  comments: number;
}

export class GitHubAuthError extends Error {}

/**
 * A rate-limited request, not a bad token — the same Viewer succeeds once the
 * quota resets, so surfaces can (and do) word it differently. Extends
 * {@link GitHubAuthError} so existing error displays show its message as-is.
 */
export class GitHubRateLimitError extends GitHubAuthError {}

/**
 * GitHub reports rate limiting as a 403/429 whose headers say the quota is
 * spent (`x-ratelimit-remaining: 0`) or ask us to wait (`retry-after`) —
 * distinct from a 401/403 that genuinely rejects the token.
 */
export function isRateLimitError(err: unknown): boolean {
  const { status, response } = err as {
    status?: number;
    response?: { headers?: Record<string, string | undefined> };
  };
  if (status !== 403 && status !== 429) return false;
  const headers = response?.headers ?? {};
  return (
    headers["x-ratelimit-remaining"] === "0" ||
    headers["retry-after"] !== undefined
  );
}

export const RATE_LIMIT_MESSAGE =
  "GitHub is rate-limiting this token — try again shortly.";

export async function fetchOpenIssues(
  token: string,
  { owner, repo }: RepoRef,
): Promise<Issue[]> {
  const octokit = new Octokit({ auth: token });

  try {
    const data = await octokit.paginate(octokit.rest.issues.listForRepo, {
      owner,
      repo,
      state: "open",
      per_page: 100,
    });

    return data
      .filter((item) => !item.pull_request)
      .map((item) => ({
        number: item.number,
        title: item.title,
        url: item.html_url,
        createdAt: item.created_at,
        labels: item.labels.map(normalizeLabel),
        comments: item.comments ?? 0,
      }));
  } catch (err: unknown) {
    if (isRateLimitError(err)) {
      throw new GitHubRateLimitError(RATE_LIMIT_MESSAGE);
    }
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
