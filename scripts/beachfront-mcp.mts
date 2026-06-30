#!/usr/bin/env -S npx tsx
/**
 * Entry point for the Beachfront MCP server — the plugin's walking skeleton
 * (#86, ADR-0010). It wires the real Node side effects (`fs` for the local
 * Registry, `gh` for GitHub reads, stdio for the MCP transport) into the
 * testable, SDK-free orchestration in `src/mcp/*`.
 *
 * Like the other `scripts/*.mts` entries it runs via tsx and lives outside the
 * app tsconfig, so the typechecked SPA build needs no Node or MCP-SDK types.
 *
 * v1 handles no credentials (ADR-0010): model access comes from the developer's
 * local Claude, GitHub access from their local `gh`. The server registers one
 * tool — the estate aggregation — and speaks over stdio, so it works in any MCP
 * host including the terminal.
 */
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import type { RepoRef } from "../src/config.ts";
import { ghDataSource, type RunCommand } from "../src/mcp/ghDataSource.ts";
import {
  ESTATE_TOOL_NAME,
  estateToolConfig,
  runEstateTool,
} from "../src/mcp/estateTool.ts";
import {
  REPO_DECK_TOOL_NAME,
  repoDeckToolConfig,
  runRepoDeckTool,
} from "../src/mcp/repoDeckTool.ts";
import {
  CREATE_ISSUES_TOOL_NAME,
  createIssuesToolConfig,
  runCreateIssuesTool,
} from "../src/mcp/authorIssues.ts";
import {
  runSetTriageRoleTool,
  SET_TRIAGE_ROLE_TOOL_NAME,
  setTriageRoleToolConfig,
} from "../src/mcp/triageRole.ts";
import { CANONICAL_STATE_ROLES } from "../src/triage/mapping.ts";
import { parseRegistry } from "../src/registry/registry.ts";

/**
 * Reads the Instance's `repos/` Registry from the local filesystem — the plugin
 * runs inside the Instance repo, so the Registry the web build globs at bundle
 * time is just files on disk here. Keys are prefixed with `/` so they match the
 * canonical `repos/<owner>/<repo>.json` shape `parseRegistry` expects.
 */
function loadRegistryFromDisk(root: string): RepoRef[] {
  const files: Record<string, unknown> = {};
  let owners: string[];
  try {
    owners = readdirSync(join(root, "repos"));
  } catch {
    return []; // No Registry yet — nothing linked.
  }
  for (const owner of owners) {
    let entries: string[];
    try {
      entries = readdirSync(join(root, "repos", owner));
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.endsWith(".json")) continue;
      const abs = join(root, "repos", owner, entry);
      files[`/repos/${owner}/${entry}`] = JSON.parse(readFileSync(abs, "utf8"));
    }
  }
  return parseRegistry(files).map(({ owner, repo }) => ({ owner, repo }));
}

const run: RunCommand = (command, args) =>
  execFileSync(command, args, { encoding: "utf8" });

const repos = loadRegistryFromDisk(process.cwd());
const source = ghDataSource(run, repos);

const server = new McpServer({ name: "beachfront", version: "0.0.0" });

server.registerTool(ESTATE_TOOL_NAME, estateToolConfig, async () => {
  // The text content is the floor that works in every host (ADR-0010); the
  // structured view-model lands once the UI-resource slices (#87/#88) add the
  // matching output schema the protocol needs to carry it.
  const { content } = await runEstateTool(source);
  return { content };
});

// The per-repo deck (#88): given a Registry repo, return its Kanban board as an
// MCP App UI resource (the embedded `text/html`) with a calm text fallback. The
// embedded resource carries the rendered board, so rich hosts draw the deck and
// the terminal still reads it — no separate output schema needed.
server.registerTool(
  REPO_DECK_TOOL_NAME,
  {
    ...repoDeckToolConfig,
    inputSchema: { owner: z.string(), repo: z.string() },
  },
  async ({ owner, repo }) => {
    const { content } = await runRepoDeckTool(source, { owner, repo });
    return { content };
  },
);

// Author issues (#89): the conversation drafts a `to-issues`-shape breakdown,
// this tool is the single checkpoint — called without `confirm` it previews and
// writes nothing; with `confirm` it creates all the drafts via local `gh`.
server.registerTool(
  CREATE_ISSUES_TOOL_NAME,
  {
    ...createIssuesToolConfig,
    inputSchema: {
      owner: z.string(),
      repo: z.string(),
      drafts: z
        .array(
          z.object({
            title: z.string(),
            body: z.string(),
            labels: z.array(z.string()).optional(),
          }),
        )
        .describe("The issues to create — the to-issues breakdown."),
      confirm: z
        .boolean()
        .optional()
        .describe("Set true to create all the drafts. Omit to preview only."),
    },
  },
  async ({ owner, repo, drafts, confirm }) => {
    const { content } = await runCreateIssuesTool(
      run,
      { owner, repo },
      drafts,
      confirm === true,
    );
    return { content };
  },
);

// Triage an issue (#89): write the repo's mapped label (#6) for a canonical
// state role via local `gh`, reconciling the state column the same way the web
// view does.
server.registerTool(
  SET_TRIAGE_ROLE_TOOL_NAME,
  {
    ...setTriageRoleToolConfig,
    inputSchema: {
      owner: z.string(),
      repo: z.string(),
      issue: z.number().int().describe("The issue number to move."),
      role: z.enum(CANONICAL_STATE_ROLES).describe("The target triage state role."),
    },
  },
  async ({ owner, repo, issue, role }) => {
    const { content } = await runSetTriageRoleTool(
      run,
      source,
      { owner, repo },
      issue,
      role,
    );
    return { content };
  },
);

await server.connect(new StdioServerTransport());
