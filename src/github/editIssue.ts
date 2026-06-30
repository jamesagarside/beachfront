import { Octokit } from "octokit";
import type { RepoRef } from "../config.ts";
import {
  CANONICAL_STATE_ROLES,
  type TriageMapping,
  type TriageStateRole,
} from "../triage/mapping.ts";

/**
 * Issue writes for the per-repo view (#17): changing an issue's canonical triage
 * role and posting a comment, browser → GitHub API as the Viewer's own token.
 * Token scope is the capability gate (ADR-0001/0004) — a read-only token can't
 * write, so 401/403 surfaces as an {@link IssueWriteError} the UI shows calmly
 * before pivoting the Viewer out to edit on GitHub.
 */
export class IssueWriteError extends Error {}

const WRITE_SCOPE_MESSAGE =
  "Your token can't write to this repo. Editing an issue needs a token with " +
  "write (repo / public_repo) scope — or edit it on GitHub instead.";

function wrapWriteError(err: unknown): never {
  if (err instanceof IssueWriteError) throw err;
  const status = (err as { status?: number }).status;
  if (status === 401 || status === 403) {
    throw new IssueWriteError(WRITE_SCOPE_MESSAGE);
  }
  throw err;
}

/**
 * Moves an issue to a single canonical state role by reconciling the repo's
 * mapped state-role labels: removes any *other* state-role label currently on
 * the issue and adds the one mapped to `nextRole`. Category labels (`bug` /
 * `enhancement`) and any label outside the triage vocabulary are left
 * untouched, so this only ever changes the state column. Returns the issue's
 * labels after the change.
 */
export async function setIssueStateRole(
  token: string,
  { owner, repo }: RepoRef,
  issueNumber: number,
  currentLabels: string[],
  mapping: TriageMapping,
  nextRole: TriageStateRole,
): Promise<string[]> {
  const octokit = new Octokit({ auth: token });
  const stateLabels = new Set(
    CANONICAL_STATE_ROLES.map((role) => mapping.labelForRole[role]),
  );
  const target = mapping.labelForRole[nextRole];

  try {
    const toRemove = currentLabels.filter(
      (label) => stateLabels.has(label) && label !== target,
    );
    for (const name of toRemove) {
      await octokit.rest.issues.removeLabel({
        owner,
        repo,
        issue_number: issueNumber,
        name,
      });
    }

    const alreadyPresent = currentLabels.includes(target);
    if (!alreadyPresent) {
      await octokit.rest.issues.addLabels({
        owner,
        repo,
        issue_number: issueNumber,
        labels: [target],
      });
    }

    const kept = currentLabels.filter((label) => !toRemove.includes(label));
    return alreadyPresent ? kept : [...kept, target];
  } catch (err: unknown) {
    wrapWriteError(err);
  }
}

/**
 * Posts a comment on the issue as the Viewer, returning the new comment's web
 * URL so the UI can link the Viewer to it.
 */
export async function postIssueComment(
  token: string,
  { owner, repo }: RepoRef,
  issueNumber: number,
  body: string,
): Promise<string> {
  const octokit = new Octokit({ auth: token });
  try {
    const res = await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body,
    });
    return res.data.html_url;
  } catch (err: unknown) {
    wrapWriteError(err);
  }
}

/**
 * Whether the Viewer's token can write to the repo, read from the repo's
 * `permissions.push` flag. This is the capability gate (ADR-0001/0004): a
 * read-only token yields a read-only pane (pivot-to-GitHub), a write token
 * unlocks in-app editing.
 */
export async function fetchRepoCapability(
  token: string,
  { owner, repo }: RepoRef,
): Promise<boolean> {
  const octokit = new Octokit({ auth: token });
  const res = await octokit.rest.repos.get({ owner, repo });
  return res.data.permissions?.push === true;
}
