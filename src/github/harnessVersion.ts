import { Octokit } from "octokit";
import type { RepoRef } from "../config.ts";

/**
 * Fetches a Managed repo's installed harness vintage (#115) — the first line of
 * its `.sandcastle/.beachfront-version` stamp, the Tool-repo short SHA the loop
 * harness was onboarded from — browser → GitHub API, as the Viewer's own token
 * (ADR-0001). A repo that carries no stamp (404 — an older onboard) or one we
 * simply can't read yields `null`: the drift indicator degrades to `unknown`
 * rather than failing the view. Mirrors {@link fetchTriageMapping}, which reads
 * a repo contract the same way.
 */
export const HARNESS_VERSION_PATH = ".sandcastle/.beachfront-version";

/**
 * The vintage from a stamp file's contents: its first non-empty line, trimmed.
 * Trailing lines are human notes the onboarder may add; only the first line is
 * the vintage. Empty/whitespace-only content reads as no stamp (`null`).
 */
export function firstLine(content: string): string | null {
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed !== "") return trimmed;
  }
  return null;
}

export async function fetchHarnessVersion(
  token: string,
  { owner, repo }: RepoRef,
): Promise<string | null> {
  const octokit = new Octokit({ auth: token });

  try {
    const res = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: HARNESS_VERSION_PATH,
    });

    const data = res.data;
    if (Array.isArray(data) || data.type !== "file") return null;
    return firstLine(fromBase64(data.content));
  } catch {
    // Absent stamp (404) or an unreadable repo: no vintage, degrade calmly.
    return null;
  }
}

/** Decodes GitHub's base64 file payload (it arrives line-wrapped) to text. */
function fromBase64(content: string): string {
  const binary = atob(content.replace(/\n/g, ""));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
