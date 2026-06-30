/**
 * The set-triage-role tool (#89, ADR-0010) — the plugin's second write tool. It
 * changes an open issue's triage role by writing the repo's *mapped* label for
 * that role (per its `docs/agents/triage-labels.md` contract, #6) via local
 * `gh`, and removes any other label of the same kind so the issue keeps exactly
 * one category and one state role (the `triage` state machine's invariant, #7).
 *
 * The read of the Mapping reuses the shared estate data source, so the plugin
 * and web SPA resolve labels identically; only the actually-present sibling
 * labels are removed (`gh` errors on removing a label an issue doesn't carry).
 * SDK-free for the same reasons as the other tools: testable, app-typechecked.
 */
import { parseRepoRef, type RepoRef } from "../config.ts";
import {
  CANONICAL_CATEGORY_ROLES,
  CANONICAL_STATE_ROLES,
  CANONICAL_TRIAGE_ROLES,
  defaultTriageMapping,
  type TriageMapping,
  type TriageRole,
} from "../triage/mapping.ts";
import type { RunCommand } from "./ghDataSource.ts";

/** The tool's stable name — what an MCP host calls and a Viewer can say. */
export const SET_ROLE_TOOL_NAME = "beachfront_set_triage_role";

/** Host-facing metadata for `registerTool`. */
export const setRoleToolConfig = {
  title: "Set triage role",
  description:
    "Change an open issue's triage role by writing the repo's mapped label " +
    "for that role (per its triage-labels contract) via local `gh`, replacing " +
    "any other label of the same kind.",
} as const;

/** Input to the set-role tool. */
export interface SetTriageRoleInput {
  /** Target repo as `owner/repo`. */
  repo: string;
  /** The open issue's number. */
  issue: number;
  /** The canonical triage role to set (category or state). */
  role: TriageRole;
}

/** The set-role tool's serialisable view-model. */
export interface SetTriageRoleView {
  repo: string;
  issue: number;
  role: TriageRole;
  /** The repo's label string written for the role (per its Mapping). */
  label: string;
  /** Same-kind labels removed to keep one role of this kind. */
  removed: string[];
  /** True when the issue already had exactly this role (no write needed). */
  unchanged: boolean;
}

/** The MCP tool-result shape the set-role tool produces (SDK-agnostic). */
export interface SetTriageRoleResult {
  content: { type: "text"; text: string }[];
  structuredContent: SetTriageRoleView;
}

/** What the tool needs: the shared Mapping read and a `gh`-shelling command. */
export interface SetTriageRoleDeps {
  fetchTriageMapping(repo: RepoRef): Promise<TriageMapping | null>;
  run: RunCommand;
}

const CATEGORY_SET: ReadonlySet<string> = new Set(CANONICAL_CATEGORY_ROLES);

/** Reads an issue's current label names via `gh issue view --json labels`. */
function currentLabels(run: RunCommand, slug: string, issue: number): string[] {
  const json = run("gh", [
    "issue",
    "view",
    String(issue),
    "-R",
    slug,
    "--json",
    "labels",
  ]);
  const parsed = JSON.parse(json) as { labels?: { name?: string }[] };
  return (parsed.labels ?? []).map((l) => l.name ?? "").filter(Boolean);
}

/**
 * Sets an issue's triage role: writes the mapped label and removes the sibling
 * label of the same kind if present. A no-op (and no write) when the issue
 * already carries exactly that label.
 */
export async function runSetTriageRole(
  deps: SetTriageRoleDeps,
  input: SetTriageRoleInput,
): Promise<SetTriageRoleResult> {
  if (!(CANONICAL_TRIAGE_ROLES as readonly string[]).includes(input.role)) {
    throw new Error(
      `Unknown triage role "${input.role}". Expected one of: ${CANONICAL_TRIAGE_ROLES.join(", ")}.`,
    );
  }
  const { owner, repo } = parseRepoRef(input.repo);
  const slug = `${owner}/${repo}`;

  // No contract ⇒ fall back to identity labels so the canonical name is written.
  const mapping =
    (await deps.fetchTriageMapping({ owner, repo })) ?? defaultTriageMapping();
  const label = mapping.labelForRole[input.role];

  // Sibling roles of the same kind — only one category and one state at a time.
  const siblingRoles = CATEGORY_SET.has(input.role)
    ? CANONICAL_CATEGORY_ROLES
    : CANONICAL_STATE_ROLES;
  const siblingLabels = siblingRoles.map((r) => mapping.labelForRole[r]);

  // `gh` errors on removing a label the issue lacks, so only remove present ones.
  const present = new Set(currentLabels(deps.run, slug, input.issue));
  const removed = siblingLabels.filter((l) => l !== label && present.has(l));
  const unchanged = present.has(label) && removed.length === 0;

  if (!unchanged) {
    const args = [
      "issue",
      "edit",
      String(input.issue),
      "-R",
      slug,
      "--add-label",
      label,
    ];
    for (const l of removed) args.push("--remove-label", l);
    deps.run("gh", args);
  }

  const ref = `${slug} #${input.issue}`;
  const text = unchanged
    ? `${ref} is already ${input.role} — no change.`
    : removed.length > 0
      ? `${ref} → ${input.role} (label "${label}"). Removed: ${removed.join(", ")}.`
      : `${ref} → ${input.role} (label "${label}").`;

  return {
    content: [{ type: "text", text }],
    structuredContent: {
      repo: slug,
      issue: input.issue,
      role: input.role,
      label,
      removed,
      unchanged,
    },
  };
}
