import {
  CANONICAL_TRIAGE_ROLES,
  parseTriageLabels,
  defaultTriageMapping,
} from "./mapping.ts";

const DOCUMENTED = `# Triage labels

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
  it("parses the documented default table into a role → label mapping", () => {
    const mapping = parseTriageLabels(DOCUMENTED);
    expect(mapping).not.toBeNull();
    for (const role of CANONICAL_TRIAGE_ROLES) {
      expect(mapping!.labelForRole[role]).toBe(role);
    }
  });

  it("builds a reverse label → role lookup", () => {
    const mapping = parseTriageLabels(DOCUMENTED)!;
    expect(mapping.roleForLabel.get("ready-for-agent")).toBe("ready-for-agent");
    expect(mapping.roleForLabel.get("bug")).toBe("bug");
  });

  it("honours a repo that remaps a label string", () => {
    const remapped = DOCUMENTED.replace(
      "| `ready-for-agent` | `ready-for-agent` |",
      "| `ready-for-agent` | `agent-ready` |",
    );
    const mapping = parseTriageLabels(remapped)!;
    expect(mapping.labelForRole["ready-for-agent"]).toBe("agent-ready");
    expect(mapping.roleForLabel.get("agent-ready")).toBe("ready-for-agent");
    // the old default label no longer resolves to a role
    expect(mapping.roleForLabel.get("ready-for-agent")).toBeUndefined();
  });

  it("fills roles the table omits with their default (label == role)", () => {
    const partial = `## State roles

| Role           | Label       |
| -------------- | ----------- |
| \`needs-triage\` | \`triaging\` |
`;
    const mapping = parseTriageLabels(partial)!;
    expect(mapping.labelForRole["needs-triage"]).toBe("triaging");
    // omitted roles keep their identity default
    expect(mapping.labelForRole["ready-for-agent"]).toBe("ready-for-agent");
    expect(mapping.labelForRole.bug).toBe("bug");
  });

  it("ignores rows whose role is not canonical", () => {
    const extra = `${DOCUMENTED}

| Role        | Label       |
| ----------- | ----------- |
| \`nonsense\` | \`nonsense\` |
`;
    const mapping = parseTriageLabels(extra)!;
    expect(mapping.roleForLabel.has("nonsense")).toBe(false);
  });

  it("degrades gracefully when the file is missing (no Mapping)", () => {
    expect(parseTriageLabels(undefined)).toBeNull();
    expect(parseTriageLabels(null)).toBeNull();
    expect(parseTriageLabels("")).toBeNull();
    expect(parseTriageLabels("   \n  ")).toBeNull();
  });

  it("returns a Mapping for a file present but lacking any table (all defaults)", () => {
    const mapping = parseTriageLabels("# Triage labels\n\nSome prose, no table.\n");
    expect(mapping).not.toBeNull();
    expect(mapping!.labelForRole["ready-for-agent"]).toBe("ready-for-agent");
  });
});

describe("defaultTriageMapping", () => {
  it("is the identity mapping over the canonical roles", () => {
    const mapping = defaultTriageMapping();
    for (const role of CANONICAL_TRIAGE_ROLES) {
      expect(mapping.labelForRole[role]).toBe(role);
      expect(mapping.roleForLabel.get(role)).toBe(role);
    }
  });
});
