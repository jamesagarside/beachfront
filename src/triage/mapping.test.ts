import { vi } from "vitest";
import {
  parseTriageLabels,
  fetchTriageMapping,
  CATEGORY_ROLES,
  STATE_ROLES,
  type TriageMapping,
} from "./mapping.ts";

const DEFAULTS = `# Triage labels

Canonical triage roles map 1:1 to GitHub label strings (defaults — no remap).

## Category roles

| Role          | Label         |
| ------------- | ------------- |
| \`bug\`         | \`bug\`         |
| \`enhancement\` | \`enhancement\` |

## State roles

| Role              | Label             |
| ----------------- | ----------------- |
| \`needs-triage\`    | \`needs-triage\`    |
| \`needs-info\`      | \`needs-info\`      |
| \`ready-for-agent\` | \`ready-for-agent\` |
| \`ready-for-human\` | \`ready-for-human\` |
| \`wontfix\`         | \`wontfix\`         |

Every triaged issue carries exactly one category role and one state role.
`;

describe("parseTriageLabels", () => {
  it("parses the default file into a full role → label mapping", () => {
    expect(parseTriageLabels(DEFAULTS)).toEqual<TriageMapping>({
      bug: "bug",
      enhancement: "enhancement",
      "needs-triage": "needs-triage",
      "needs-info": "needs-info",
      "ready-for-agent": "ready-for-agent",
      "ready-for-human": "ready-for-human",
      wontfix: "wontfix",
    });
  });

  it("covers every canonical role", () => {
    const mapping = parseTriageLabels(DEFAULTS);
    for (const role of [...CATEGORY_ROLES, ...STATE_ROLES]) {
      expect(mapping[role]).toBeDefined();
    }
  });

  it("honours a repo that remaps a role to a different label string", () => {
    const remapped = DEFAULTS.replace(
      "| `ready-for-agent` | `ready-for-agent` |",
      "| `ready-for-agent` | `agent-ready` |",
    );
    expect(parseTriageLabels(remapped)["ready-for-agent"]).toBe("agent-ready");
  });

  it("defaults any role absent from the file to its own name", () => {
    const partial = `## State roles\n\n| Role | Label |\n| ---- | ----- |\n| \`wontfix\` | \`closed-wontfix\` |\n`;
    const mapping = parseTriageLabels(partial);
    expect(mapping.wontfix).toBe("closed-wontfix");
    // Roles the partial file never mentions still resolve to their default.
    expect(mapping.bug).toBe("bug");
    expect(mapping["ready-for-agent"]).toBe("ready-for-agent");
  });

  it("ignores unknown roles and table chrome", () => {
    const noise = `| Role | Label |\n| ---- | ----- |\n| \`made-up\` | \`whatever\` |\n`;
    expect(parseTriageLabels(noise)).toEqual(parseTriageLabels(""));
  });
});

const getContent = vi.fn();

vi.mock("octokit", () => ({
  Octokit: vi.fn().mockImplementation(() => ({
    rest: { repos: { getContent } },
  })),
}));

const REPO = { owner: "jamesagarside", repo: "beachfront" };

const encode = (s: string) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(s)));

describe("fetchTriageMapping", () => {
  it("reads docs/agents/triage-labels.md and parses it", async () => {
    getContent.mockResolvedValue({
      data: { type: "file", encoding: "base64", content: encode(DEFAULTS) },
    });

    const mapping = await fetchTriageMapping("token", REPO);

    expect(getContent).toHaveBeenLastCalledWith(
      expect.objectContaining({
        owner: "jamesagarside",
        repo: "beachfront",
        path: "docs/agents/triage-labels.md",
      }),
    );
    expect(mapping?.["ready-for-agent"]).toBe("ready-for-agent");
  });

  it("returns null when the contract file does not exist (graceful degradation)", async () => {
    getContent.mockRejectedValue({ status: 404 });
    await expect(fetchTriageMapping("token", REPO)).resolves.toBeNull();
  });

  it("rethrows non-404 errors", async () => {
    getContent.mockRejectedValue(new Error("network down"));
    await expect(fetchTriageMapping("token", REPO)).rejects.toThrow(
      /network down/,
    );
  });
});
