/**
 * The triage-role tool (#89, ADR-0010) — moves an issue to a single canonical
 * triage **state** role from the Claude session, writing the repo's *mapped*
 * label (#6) via the developer's local `gh`. It is the plugin sibling of the web
 * surface's {@link setIssueStateRole}: same reconcile-the-state-column logic, but
 * shelling out to `gh` instead of Octokit, and reading the repo's Mapping through
 * the shared-core data source so the plugin and the SPA can't drift.
 *
 * Kept free of the MCP SDK so it stays unit-testable and the app typecheck (no
 * Node types) covers it; the plugin entry owns the `registerTool` wiring and
 * injects both the `gh` runner ({@link RunCommand}) and the data source.
 */
import type { RepoRef } from "../config.ts";
import type { EstateDataSource } from "../core/dataSource.ts";
import type { RunCommand } from "./ghDataSource.ts";
import { type TriageStateRole } from "../triage/mapping.ts";
import { reconcileStateRole } from "../triage/reconcile.ts";

/** The tool's stable name — what an MCP host calls and a Viewer can say. */
export const SET_TRIAGE_ROLE_TOOL_NAME = "beachfront_set_triage_role";

/** Host-facing metadata for `registerTool`. */
export const setTriageRoleToolConfig = {
  title: "Beachfront set triage role",
  description:
    "Move an issue to a canonical triage state role by writing the repo's " +
    "mapped label via local gh — the same state-column reconcile the web view does.",
} as const;

/** The MCP tool-result shape the triage-role tool produces (SDK-agnostic). */
export interface SetTriageRoleResult {
  content: { type: "text"; text: string }[];
  structuredContent: {
    issue: number;
    role: TriageStateRole;
    /** The repo's label string for the target role (per the Mapping). */
    label: string;
    /** Whether the target label was added (false when already present). */
    added: boolean;
    /** Other state-role labels removed to leave exactly one state label. */
    removed: string[];
  };
}

const slug = (repo: RepoRef): string => `${repo.owner}/${repo.repo}`;

/** Reads an issue's current label names via `gh issue view --json labels`. */
function readLabels(run: RunCommand, repo: RepoRef, issue: number): string[] {
  const json = run("gh", [
    "issue",
    "view",
    String(issue),
    "-R",
    slug(repo),
    "--json",
    "labels",
  ]);
  const parsed = JSON.parse(json) as { labels?: { name?: string }[] };
  return (parsed.labels ?? []).map((l) => l.name ?? "").filter(Boolean);
}

/**
 * Runs the triage-role tool: resolves the repo's Mapping (#6, identity default
 * when the repo ships none), then reconciles the state column on the issue —
 * removing any *other* state-role label and adding the one mapped to `nextRole`.
 * Category labels (`bug`/`enhancement`) and anything outside the triage
 * vocabulary are left untouched. When the issue already holds exactly the target
 * role it writes nothing.
 */
export async function runSetTriageRoleTool(
  run: RunCommand,
  source: EstateDataSource,
  repo: RepoRef,
  issueNumber: number,
  nextRole: TriageStateRole,
): Promise<SetTriageRoleResult> {
  const mapping = await source.fetchTriageMapping(repo);
  const current = readLabels(run, repo, issueNumber);
  const { target, add, remove: removed } = reconcileStateRole(
    current,
    mapping,
    nextRole,
  );
  const added = add !== null;

  if (added || removed.length > 0) {
    const args = ["issue", "edit", String(issueNumber), "-R", slug(repo)];
    if (added) args.push("--add-label", target);
    for (const label of removed) args.push("--remove-label", label);
    run("gh", args);
  }

  const text =
    !added && removed.length === 0
      ? `#${issueNumber} is already ${nextRole} (label \`${target}\`).`
      : `Moved #${issueNumber} to ${nextRole} — added \`${target}\`` +
        (removed.length > 0 ? `, removed ${removed.map((l) => `\`${l}\``).join(", ")}` : "") +
        ".";

  return {
    content: [{ type: "text", text }],
    structuredContent: {
      issue: issueNumber,
      role: nextRole,
      label: target,
      added,
      removed,
    },
  };
}
