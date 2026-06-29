import { Octokit } from "octokit";
import type { RepoRef } from "../config.ts";

/**
 * Opens the linking PR for the UI Link flow (ADR-0002, the "UI (pull)"
 * producer). Using the Viewer's own token it adds `repos/<owner>/<repo>.json`
 * to the Instance on a fresh branch and opens a PR back to the Instance's
 * default branch. The Registry is never hand-edited — only Linking writes it —
 * so this is the one place the SPA mutates the Instance.
 *
 * Writing needs a token with write scope on the Instance repo; a read-only
 * token surfaces as a {@link LinkWriteError} with a message safe to show a
 * Viewer, kept distinct from an unexpected API failure.
 */
export class LinkWriteError extends Error {}

export interface OpenedLink {
  /** Web URL of the opened PR, to link the Viewer back to their request. */
  url: string;
  /** Branch the Registry file was committed to. */
  branch: string;
}

export interface LinkMeta {
  /** GitHub login opening the link, recorded in the Registry file and PR body. */
  linkedBy: string;
  /** ISO date the repo was linked; defaults to today (registry-schema.md). */
  linkedAt?: string;
}

function registryPath({ owner, repo }: RepoRef): string {
  return `repos/${owner}/${repo}.json`;
}

function branchName({ owner, repo }: RepoRef): string {
  return `beachfront/link-${owner}-${repo}`;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Registry file body written by the UI producer (registry-schema.md). */
function registryFile(ref: RepoRef, meta: Required<LinkMeta>): string {
  return (
    JSON.stringify(
      {
        owner: ref.owner,
        repo: ref.repo,
        linkedAt: meta.linkedAt,
        linkedBy: meta.linkedBy,
      },
      null,
      2,
    ) + "\n"
  );
}

/** Encodes UTF-8 text as base64, the form GitHub's contents API expects. */
function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/**
 * Adds the Registry file for `ref` to `instance` and opens the linking PR,
 * returning the PR's web URL. Throws a {@link LinkWriteError} when the token
 * can't write (read-only scope) or a link is already in progress; other API
 * failures propagate unchanged.
 */
export async function openLinkPr(
  token: string,
  ref: RepoRef,
  instance: RepoRef,
  meta: LinkMeta,
): Promise<OpenedLink> {
  const octokit = new Octokit({ auth: token });
  const branch = branchName(ref);
  const filled: Required<LinkMeta> = {
    linkedBy: meta.linkedBy,
    linkedAt: meta.linkedAt ?? today(),
  };

  try {
    // Branch from the Instance's current default-branch head.
    const repoRes = await octokit.rest.repos.get({
      owner: instance.owner,
      repo: instance.repo,
    });
    const base = repoRes.data.default_branch;

    const refRes = await octokit.rest.git.getRef({
      owner: instance.owner,
      repo: instance.repo,
      ref: `heads/${base}`,
    });

    await octokit.rest.git.createRef({
      owner: instance.owner,
      repo: instance.repo,
      ref: `refs/heads/${branch}`,
      sha: refRes.data.object.sha,
    });

    await octokit.rest.repos.createOrUpdateFileContents({
      owner: instance.owner,
      repo: instance.repo,
      path: registryPath(ref),
      branch,
      message: `Link ${ref.owner}/${ref.repo}`,
      content: toBase64(registryFile(ref, filled)),
    });

    const prRes = await octokit.rest.pulls.create({
      owner: instance.owner,
      repo: instance.repo,
      base,
      head: branch,
      title: `Link ${ref.owner}/${ref.repo}`,
      body:
        `Adds \`${registryPath(ref)}\` to the Registry, linking ` +
        `${ref.owner}/${ref.repo} for aggregation (ADR-0002).\n\n` +
        `Requested by @${filled.linkedBy} via the Beachfront UI.`,
    });

    return { url: prRes.data.html_url, branch };
  } catch (err: unknown) {
    if (err instanceof LinkWriteError) throw err;
    const status = (err as { status?: number }).status;
    if (status === 401 || status === 403) {
      throw new LinkWriteError(
        "Your token can't write to the Instance. Linking opens a PR, which " +
          "needs a token with write (repo / public_repo) scope.",
      );
    }
    if (status === 422) {
      throw new LinkWriteError(
        `A link for ${ref.owner}/${ref.repo} is already in progress ` +
          `(branch ${branch} exists). Finish or close that PR first.`,
      );
    }
    throw err;
  }
}
