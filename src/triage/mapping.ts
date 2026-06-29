import { Octokit } from "octokit";
import type { RepoRef } from "../config.ts";

/**
 * The per-repo triage-labels Mapping (#6, ADR-0003). Beachfront adopts Matt
 * Pocock's `triage` vocabulary wholesale: canonical category roles `bug` /
 * `enhancement` and state roles `needs-triage` … `wontfix`. Each Managed repo
 * declares how those roles map to its actual GitHub label strings in
 * `docs/agents/triage-labels.md`. Beachfront *reads* that contract; it never
 * defines or imposes labels.
 *
 * The default is identity — a repo that hasn't remapped uses a label string
 * equal to the role name. We model that as the baseline and let the file
 * override individual roles, so both a defaults file and a remapped one parse
 * to a complete mapping. Repos without the file get no Mapping at all (null),
 * and so render with no classification (ADR-0003 "reduced fidelity").
 */
export const CATEGORY_ROLES = ["bug", "enhancement"] as const;
export const STATE_ROLES = [
  "needs-triage",
  "needs-info",
  "ready-for-agent",
  "ready-for-human",
  "wontfix",
] as const;

export type CategoryRole = (typeof CATEGORY_ROLES)[number];
export type StateRole = (typeof STATE_ROLES)[number];
export type TriageRole = CategoryRole | StateRole;

/** Canonical role → the GitHub label string that repo uses for it. */
export type TriageMapping = Record<TriageRole, string>;

const ALL_ROLES: TriageRole[] = [...CATEGORY_ROLES, ...STATE_ROLES];
const ROLE_SET = new Set<string>(ALL_ROLES);

const CONTRACT_PATH = "docs/agents/triage-labels.md";

/** The identity Mapping: every role maps to a label string equal to its name. */
function defaultMapping(): TriageMapping {
  return Object.fromEntries(
    ALL_ROLES.map((role) => [role, role]),
  ) as TriageMapping;
}

/** Strips a Markdown table cell of surrounding whitespace and code backticks. */
function cell(value: string): string {
  return value.trim().replace(/^`(.*)`$/, "$1").trim();
}

/**
 * Parses the Markdown of a repo's `triage-labels.md` into a complete
 * {@link TriageMapping}. Rows of any Markdown table whose first cell is a
 * canonical role override that role's label; every other role keeps its
 * identity default, so a partial or defaults-only file still yields a full
 * mapping. Unknown roles and table chrome (headers, separators) are ignored.
 */
export function parseTriageLabels(markdown: string): TriageMapping {
  const mapping = defaultMapping();

  for (const line of markdown.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|")) continue;

    const cells = trimmed
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map(cell);
    if (cells.length < 2) continue;

    const [role, label] = cells;
    if (ROLE_SET.has(role) && label) {
      mapping[role as TriageRole] = label;
    }
  }

  return mapping;
}

function decodeContent(content: string): string {
  // GitHub returns file contents base64-encoded (with embedded newlines). The
  // app runs in the browser: atob yields raw bytes, then TextDecoder turns them
  // back into UTF-8 text (the contract prose can contain non-ASCII, e.g. em-dashes).
  const bytes = Uint8Array.from(atob(content.replace(/\n/g, "")), (c) =>
    c.charCodeAt(0),
  );
  return new TextDecoder().decode(bytes);
}

/**
 * Fetches and parses a Managed repo's triage-labels Mapping, browser → GitHub
 * API as the Viewer's token. Returns `null` when the repo has no contract file
 * (a 404), so callers degrade gracefully to no classification. Other errors —
 * including auth failures — propagate unchanged.
 */
export async function fetchTriageMapping(
  token: string,
  { owner, repo }: RepoRef,
): Promise<TriageMapping | null> {
  const octokit = new Octokit({ auth: token });

  try {
    const res = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: CONTRACT_PATH,
    });

    const data = res.data as { content?: string };
    if (typeof data.content !== "string") return null;
    return parseTriageLabels(decodeContent(data.content));
  } catch (err: unknown) {
    if ((err as { status?: number }).status === 404) return null;
    throw err;
  }
}
