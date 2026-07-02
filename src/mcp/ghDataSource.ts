/**
 * The MCP plugin's {@link EstateDataSource} (#86, ADR-0010): the sibling to the
 * web surface's {@link webDataSource}, satisfying the same shared-core interface
 * but backed by the developer's **local `gh`** instead of an in-browser token.
 * v1 handles no credentials — model access comes from local Claude, GitHub access
 * from `gh` — so each read is just a `gh` invocation whose JSON we parse into the
 * core's types. Both surfaces drive the same aggregation and view builders, so
 * the plugin and the SPA cannot diverge.
 *
 * The shelling-out itself is injected as {@link RunCommand} (mirroring the CLI's
 * `LinkDeps.run`) so the orchestration is unit-testable without a real `gh`; the
 * plugin entry script wires `execFileSync`.
 */
import type { RepoRef } from "../config.ts";
import type { EstateDataSource } from "../core/dataSource.ts";
import { firstLine, HARNESS_VERSION_PATH } from "../github/harnessVersion.ts";
import type { Issue } from "../github/issues.ts";
import { type AgentRun, normalizeRunStatus } from "../github/runs.ts";
import { TRIAGE_LABELS_PATH } from "../github/triageMapping.ts";
import { parseTriageLabels } from "../triage/mapping.ts";

/** Run a command, returning its stdout. Throws on a non-zero exit. */
export type RunCommand = (command: string, args: string[]) => string;

/** Shape of one issue as `gh issue list --json` reports it. */
interface GhIssue {
  number: number;
  title: string;
  url: string;
  createdAt: string;
  labels?: { name?: string; color?: string | null }[];
  /** `gh` returns the comments as an array of objects, not a count. */
  comments?: unknown[];
}

/** Shape of one run as `gh run list --json` reports it. */
interface GhRun {
  databaseId: number;
  name?: string;
  status: string | null;
  conclusion: string | null;
  url: string;
  headBranch?: string | null;
  createdAt: string;
}

const slug = (repo: RepoRef): string => `${repo.owner}/${repo.repo}`;

function parseIssues(json: string): Issue[] {
  return (JSON.parse(json) as GhIssue[]).map((raw) => ({
    number: raw.number,
    title: raw.title,
    url: raw.url,
    createdAt: raw.createdAt,
    labels: (raw.labels ?? []).map((label) => ({
      name: label.name ?? "",
      color: label.color ?? "",
    })),
    comments: Array.isArray(raw.comments) ? raw.comments.length : 0,
  }));
}

function parseRuns(json: string): AgentRun[] {
  return (JSON.parse(json) as GhRun[]).map((raw) => ({
    id: raw.databaseId,
    name: raw.name || "Agent run",
    status: normalizeRunStatus(raw.status, raw.conclusion),
    url: raw.url,
    branch: raw.headBranch || null,
    createdAt: raw.createdAt,
  }));
}

/** Decodes GitHub's base64 contents payload (it arrives line-wrapped) to text. */
function decodeBase64(content: string): string {
  const binary = atob(content.replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/**
 * Builds the local-`gh` data source over the given Registry repos. `listRepos`
 * returns them verbatim — the plugin entry resolves the Registry from the local
 * filesystem, exactly as the web build resolves it at bundle time — and the
 * per-repo reads shell out to `gh`.
 */
export function ghDataSource(
  run: RunCommand,
  repos: RepoRef[],
): EstateDataSource {
  return {
    listRepos: () => Promise.resolve(repos),

    // A throw here (private/inaccessible repo) becomes a rejection, which the
    // aggregator turns into a calmly `skipped` repo rather than a failed estate.
    fetchOpenIssues: async (repo) =>
      parseIssues(
        run("gh", [
          "issue",
          "list",
          "-R",
          slug(repo),
          "--state",
          "open",
          "--limit",
          "100",
          "--json",
          "number,title,url,labels,createdAt,comments",
        ]),
      ),

    // A repo that ships no triage contract returns a 404 from `gh api`; degrade
    // to null so classification falls back to raw labels (ADR-0003).
    fetchTriageMapping: async (repo) => {
      let content: string;
      try {
        content = run("gh", [
          "api",
          `repos/${repo.owner}/${repo.repo}/contents/${TRIAGE_LABELS_PATH}`,
          "--jq",
          ".content",
        ]);
      } catch {
        return null;
      }
      return parseTriageLabels(decodeBase64(content));
    },

    fetchAgentRuns: async (repo) =>
      parseRuns(
        run("gh", [
          "run",
          "list",
          "-R",
          slug(repo),
          "--limit",
          "10",
          "--json",
          "databaseId,name,status,conclusion,url,headBranch,createdAt",
        ]),
      ),

    // A repo with no version stamp returns a 404 from `gh api`; degrade to null
    // so the drift indicator reads "unknown" rather than failing (#115).
    fetchHarnessVersion: async (repo) => {
      let content: string;
      try {
        content = run("gh", [
          "api",
          `repos/${repo.owner}/${repo.repo}/contents/${HARNESS_VERSION_PATH}`,
          "--jq",
          ".content",
        ]);
      } catch {
        return null;
      }
      return firstLine(decodeBase64(content));
    },
  };
}
