/**
 * The issue-authoring tool (#89, ADR-0010) — the plugin's first *write* tool.
 * It lets the Viewer turn a `to-issues`-style breakdown (which the conversation
 * produces) into real GitHub issues for a chosen repo, with **exactly one
 * checkpoint** before anything is written: called without `confirm` it returns
 * the drafts for review and writes nothing; called with `confirm: true` it
 * creates them all via local `gh`. No copy-paste — the conversation drives it.
 *
 * Like the estate tool the handler is kept free of the MCP SDK so it stays
 * unit-testable and the app typecheck covers it; the plugin entry owns the SDK
 * wiring and supplies the `gh`-shelling {@link RunCommand}.
 */
import { parseRepoRef } from "../config.ts";
import type { RunCommand } from "./ghDataSource.ts";

/** The tool's stable name — what an MCP host calls and a Viewer can say. */
export const AUTHOR_TOOL_NAME = "beachfront_author_issues";

/** Host-facing metadata for `registerTool`. */
export const authorToolConfig = {
  title: "Author issues",
  description:
    "Draft a set of issues (a to-issues breakdown) for a chosen repo and " +
    "create them all on a single confirm, via local `gh`. Called without " +
    "confirm it returns the drafts for review — the one checkpoint before any " +
    "write — so nothing is created until the Viewer confirms.",
} as const;

/** One issue in the breakdown — the `to-issues` shape: a title and a body. */
export interface IssueDraft {
  title: string;
  body: string;
  /** Optional labels to apply on creation (e.g. `ready-for-agent`). */
  labels?: string[];
}

/** Input to the author tool. */
export interface AuthorIssuesInput {
  /** Target repo as `owner/repo`. */
  repo: string;
  /** The issue breakdown to draft (and, on confirm, create). */
  issues: IssueDraft[];
  /** Set true to create all drafts; omit/false to preview them first. */
  confirm?: boolean;
}

/** An issue that was opened on GitHub. */
export interface CreatedIssue {
  title: string;
  url: string;
}

/** The author tool's serialisable view-model (preview or created). */
export interface AuthorIssuesView {
  repo: string;
  /** True when the drafts were created; false for a preview (no writes). */
  created: boolean;
  drafts: IssueDraft[];
  /** The opened issues — present (and non-empty) only once created. */
  issues: CreatedIssue[];
}

/** The MCP tool-result shape the author tool produces (SDK-agnostic). */
export interface AuthorIssuesResult {
  content: { type: "text"; text: string }[];
  structuredContent: AuthorIssuesView;
}

/** `gh issue create` prints progress then the URL; take the last URL line. */
function urlFrom(stdout: string): string {
  const lines = stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const url = lines.reverse().find((line) => line.startsWith("http"));
  return url ?? lines[lines.length - 1] ?? "";
}

function previewText(slug: string, drafts: IssueDraft[]): string {
  const lines = [
    `Drafting ${drafts.length} issue${drafts.length === 1 ? "" : "s"} for ${slug} — reply with confirm to create all:`,
    "",
  ];
  drafts.forEach((draft, i) => lines.push(`${i + 1}. ${draft.title}`));
  lines.push("", "Nothing has been created yet.");
  return lines.join("\n");
}

function createdText(slug: string, issues: CreatedIssue[]): string {
  const lines = [
    `Created ${issues.length} issue${issues.length === 1 ? "" : "s"} in ${slug}:`,
    "",
  ];
  for (const issue of issues) lines.push(`- ${issue.title} — ${issue.url}`);
  return lines.join("\n");
}

/**
 * Drafts (and, on confirm, creates) a breakdown of issues for a repo. The flow
 * is the single checkpoint #89 requires: no `confirm` ⇒ a preview with no
 * writes; `confirm: true` ⇒ one `gh issue create` per draft, all in one call.
 */
export function runAuthorIssues(
  run: RunCommand,
  input: AuthorIssuesInput,
): AuthorIssuesResult {
  const { owner, repo } = parseRepoRef(input.repo);
  const slug = `${owner}/${repo}`;
  const drafts = input.issues ?? [];

  if (drafts.length === 0) {
    return {
      content: [
        { type: "text", text: `No issue drafts to author for ${slug}.` },
      ],
      structuredContent: { repo: slug, created: false, drafts, issues: [] },
    };
  }

  if (input.confirm !== true) {
    return {
      content: [{ type: "text", text: previewText(slug, drafts) }],
      structuredContent: { repo: slug, created: false, drafts, issues: [] },
    };
  }

  const issues: CreatedIssue[] = drafts.map((draft) => {
    const args = [
      "issue",
      "create",
      "-R",
      slug,
      "--title",
      draft.title,
      "--body",
      draft.body,
    ];
    for (const label of draft.labels ?? []) args.push("--label", label);
    return { title: draft.title, url: urlFrom(run("gh", args)) };
  });

  return {
    content: [{ type: "text", text: createdText(slug, issues) }],
    structuredContent: { repo: slug, created: true, drafts, issues },
  };
}
