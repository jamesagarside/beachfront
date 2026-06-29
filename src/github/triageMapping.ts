import { Octokit } from "octokit";
import type { RepoRef } from "../config.ts";
import { parseTriageLabels, type TriageMapping } from "../triage/mapping.ts";

/**
 * Fetches a Managed repo's triage Mapping — its `docs/agents/triage-labels.md`
 * contract (ADR-0003) — browser → GitHub API, as the Viewer's own token. The
 * file is parsed into a {@link TriageMapping} so issues can be classified into
 * canonical roles. A repo that ships no contract (404), or one we simply can't
 * read, yields `null`: classification degrades to raw labels rather than
 * failing the view.
 */
export const TRIAGE_LABELS_PATH = "docs/agents/triage-labels.md";

export async function fetchTriageMapping(
  token: string,
  { owner, repo }: RepoRef,
): Promise<TriageMapping | null> {
  const octokit = new Octokit({ auth: token });

  try {
    const res = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: TRIAGE_LABELS_PATH,
    });

    const data = res.data;
    if (Array.isArray(data) || data.type !== "file") return null;
    return parseTriageLabels(fromBase64(data.content));
  } catch {
    // Absent contract (404) or an unreadable repo: no Mapping, degrade calmly.
    return null;
  }
}

/** Decodes GitHub's base64 file payload (it arrives line-wrapped) to text. */
function fromBase64(content: string): string {
  const binary = atob(content.replace(/\n/g, ""));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
