/**
 * The issue-authoring tool (#89, ADR-0010) — lets a Viewer turn a conversation
 * into real issues on a chosen repo without leaving the Claude session and
 * without copy-paste. The conversation drives the breakdown (a `to-issues`-shape
 * set of drafts); this tool is the **single checkpoint before any write**: called
 * without `confirm` it returns the draft for review and touches nothing; called
 * with `confirm` it creates them all in one go via the developer's local `gh`.
 *
 * Kept free of the MCP SDK so it stays unit-testable and the app typecheck (which
 * carries no Node types) covers it; the plugin entry owns the `registerTool`
 * wiring and injects `gh` as {@link RunCommand}. v1 needs no credentials — GitHub
 * access is the local `gh` login (ADR-0010).
 */
import type { RepoRef } from "../config.ts";
import type { RunCommand } from "./ghDataSource.ts";

/** The tool's stable name — what an MCP host calls and a Viewer can say. */
export const CREATE_ISSUES_TOOL_NAME = "beachfront_create_issues";

/** Host-facing metadata for `registerTool`. */
export const createIssuesToolConfig = {
  title: "Beachfront create issues",
  description:
    "Draft a set of issues for a chosen repo and, on a single confirm, create " +
    "them all via local gh. Without confirm it only previews — the one " +
    "checkpoint before any write.",
} as const;

/** One drafted issue, the `to-issues` shape: a title, a body, optional labels. */
export interface IssueDraft {
  title: string;
  body: string;
  labels?: string[];
}

/** An issue that was created, with the URL `gh issue create` printed. */
export interface CreatedIssue {
  title: string;
  url: string;
}

/** The MCP tool-result shape the create tool produces (SDK-agnostic). */
export interface CreateIssuesResult {
  content: { type: "text"; text: string }[];
  structuredContent: {
    /** True only once the issues have actually been written. */
    created: boolean;
    /** The drafts as received — the basis for the preview and the writes. */
    drafts: IssueDraft[];
    /** Present once created; one entry per successfully written issue. */
    issues?: CreatedIssue[];
  };
}

const slug = (repo: RepoRef): string => `${repo.owner}/${repo.repo}`;

/** The labels suffix for a draft, e.g. `  [bug, enhancement]`, or empty. */
function labelsSuffix(labels: string[] | undefined): string {
  return labels && labels.length > 0 ? `  [${labels.join(", ")}]` : "";
}

/** The calm preview text: the drafts numbered, with the confirm instruction. */
function renderPreview(repo: RepoRef, drafts: IssueDraft[]): string {
  const lines = [
    `Draft — ${drafts.length} issue${drafts.length === 1 ? "" : "s"} for ` +
      `${slug(repo)} (nothing created yet):`,
    "",
  ];
  drafts.forEach((draft, i) => {
    lines.push(`${i + 1}. ${draft.title}${labelsSuffix(draft.labels)}`);
  });
  lines.push(
    "",
    `Re-run with confirm: true to create all ${drafts.length} via gh.`,
  );
  return lines.join("\n");
}

/**
 * Runs the create-issues tool. Without `confirm` it returns a preview and makes
 * no `gh` call. With `confirm` it creates each draft via `gh issue create`,
 * capturing the printed URL; a draft that fails is reported but does not abort
 * the rest of the batch, so a transient failure never loses the others.
 */
export async function runCreateIssuesTool(
  run: RunCommand,
  repo: RepoRef,
  drafts: IssueDraft[],
  confirm: boolean,
): Promise<CreateIssuesResult> {
  if (drafts.length === 0) {
    return {
      content: [{ type: "text", text: "No issues to create." }],
      structuredContent: { created: false, drafts },
    };
  }

  if (!confirm) {
    return {
      content: [{ type: "text", text: renderPreview(repo, drafts) }],
      structuredContent: { created: false, drafts },
    };
  }

  const created: CreatedIssue[] = [];
  const failed: { draft: IssueDraft; message: string }[] = [];

  for (const draft of drafts) {
    const args = [
      "issue",
      "create",
      "-R",
      slug(repo),
      "--title",
      draft.title,
      "--body",
      draft.body,
    ];
    for (const label of draft.labels ?? []) args.push("--label", label);
    try {
      const url = run("gh", args).trim();
      created.push({ title: draft.title, url });
    } catch (err: unknown) {
      failed.push({
        draft,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const lines: string[] = [];
  const tally =
    failed.length === 0
      ? `Created ${created.length} issue${created.length === 1 ? "" : "s"}`
      : `Created ${created.length} of ${drafts.length} issues`;
  lines.push(`${tally} in ${slug(repo)}:`);
  for (const issue of created) lines.push(`  ${issue.title}  ${issue.url}`);
  if (failed.length > 0) {
    lines.push("Failed to create:");
    for (const { draft, message } of failed) {
      lines.push(`  ${draft.title} — ${message}`);
    }
  }

  return {
    content: [{ type: "text", text: lines.join("\n") }],
    structuredContent: { created: created.length > 0, drafts, issues: created },
  };
}
