import { parseRepoRef, type RepoRef } from "../config.ts";
import type { RegistryRepo } from "../registry/registry.ts";

/**
 * Capture-and-validate for the UI Link flow (ADR-0002): before Beachfront opens
 * the onboarding PR (#15), it confirms the Viewer typed a real `owner/repo`,
 * that the repo isn't already in the Registry, and that the Viewer's own token
 * can actually see it (GitHub access is the gate, ADR-0001). All three failures
 * surface as a {@link LinkValidationError} with a message safe to show a Viewer.
 */
export class LinkValidationError extends Error {}

/**
 * Finds an existing Registry entry for `ref`, matching owner/repo
 * case-insensitively (GitHub treats them so). Returns it, or undefined when the
 * repo is not yet linked.
 */
export function findExistingLink(
  ref: RepoRef,
  repos: RegistryRepo[],
): RegistryRepo | undefined {
  return repos.find(
    (r) =>
      r.owner.toLowerCase() === ref.owner.toLowerCase() &&
      r.repo.toLowerCase() === ref.repo.toLowerCase(),
  );
}

/**
 * Confirms the Viewer's token can read `owner/repo` by fetching the repo as
 * that token. GitHub returns 404 for repos you can't see (it doesn't reveal
 * private repos exist), so a missing repo and a no-access repo collapse into one
 * message — both mean "this Viewer can't link it."
 */
async function checkRepoAccess(token: string, ref: RepoRef): Promise<void> {
  const res = await fetch(
    `https://api.github.com/repos/${ref.owner}/${ref.repo}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
    },
  );

  if (res.status === 404) {
    throw new LinkValidationError(
      `Can't find ${ref.owner}/${ref.repo}, or your token can't access it. ` +
        `Check the name and that the token can read the repo.`,
    );
  }
  if (res.status === 401 || res.status === 403) {
    throw new LinkValidationError(
      "GitHub rejected that token. Check it hasn't expired and can read the repo.",
    );
  }
  if (!res.ok) {
    throw new LinkValidationError(`GitHub API error (${res.status}).`);
  }
}

/**
 * Validates a candidate link end to end and returns the parsed {@link RepoRef}
 * ready for the PR-opening step. Throws a {@link LinkValidationError} when the
 * slug is malformed, the repo is already linked, or the Viewer can't access it.
 * Duplicates are checked before the network call so an already-linked repo
 * fails fast and quietly.
 */
export async function validateLink(
  token: string,
  slug: string,
  repos: RegistryRepo[],
): Promise<RepoRef> {
  let ref: RepoRef;
  try {
    ref = parseRepoRef(slug);
  } catch (err: unknown) {
    throw new LinkValidationError(
      err instanceof Error ? err.message : "Invalid repo.",
    );
  }

  if (findExistingLink(ref, repos)) {
    throw new LinkValidationError(
      `${ref.owner}/${ref.repo} is already linked.`,
    );
  }

  await checkRepoAccess(token, ref);
  return ref;
}
