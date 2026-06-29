/**
 * The triage Mapping: each Managed repo's `docs/agents/triage-labels.md`
 * translated into canonical role → label-string pairs (ADR-0003). Beachfront
 * adopts Matt Pocock's `triage` vocabulary wholesale and imposes no labels of
 * its own — it reads this per-repo contract and classifies issues by it.
 *
 * The file documents two markdown tables (category roles, state roles) whose
 * first column is the canonical role and second column the repo's label string.
 * Defaults are 1:1 (label == role); a repo may remap any label. We parse all
 * table rows uniformly: a row counts when its first cell is a canonical role.
 */
export const CANONICAL_CATEGORY_ROLES = ["bug", "enhancement"] as const;

export const CANONICAL_STATE_ROLES = [
  "needs-triage",
  "needs-info",
  "ready-for-agent",
  "ready-for-human",
  "wontfix",
] as const;

export const CANONICAL_TRIAGE_ROLES = [
  ...CANONICAL_CATEGORY_ROLES,
  ...CANONICAL_STATE_ROLES,
] as const;

export type TriageCategoryRole = (typeof CANONICAL_CATEGORY_ROLES)[number];
export type TriageStateRole = (typeof CANONICAL_STATE_ROLES)[number];
export type TriageRole = (typeof CANONICAL_TRIAGE_ROLES)[number];

const ROLE_SET: ReadonlySet<string> = new Set(CANONICAL_TRIAGE_ROLES);

function isTriageRole(value: string): value is TriageRole {
  return ROLE_SET.has(value);
}

export interface TriageMapping {
  /** Canonical role → this repo's label string. Every role is present. */
  labelForRole: Record<TriageRole, string>;
  /** This repo's label string → canonical role, for classifying issues. */
  roleForLabel: Map<string, TriageRole>;
}

/**
 * The identity Mapping (every role's label is its own name). Used as the base
 * that a parsed file overrides, so a repo that remaps only some roles still
 * yields a complete Mapping and the "label == role" default is always handled.
 */
export function defaultTriageMapping(): TriageMapping {
  const labelForRole = {} as Record<TriageRole, string>;
  for (const role of CANONICAL_TRIAGE_ROLES) labelForRole[role] = role;
  return mappingFromLabels(labelForRole);
}

function mappingFromLabels(
  labelForRole: Record<TriageRole, string>,
): TriageMapping {
  const roleForLabel = new Map<string, TriageRole>();
  for (const role of CANONICAL_TRIAGE_ROLES) {
    roleForLabel.set(labelForRole[role], role);
  }
  return { labelForRole, roleForLabel };
}

/** Splits a markdown table row into trimmed, de-backticked cell strings. */
function parseTableRow(line: string): string[] | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|")) return null;
  return trimmed
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim().replace(/^`|`$/g, "").trim());
}

/**
 * Parses a repo's `triage-labels.md` contents into a {@link TriageMapping}.
 *
 * Returns `null` when the file is absent or effectively empty — the repo then
 * degrades gracefully with no classification (ADR-0003). When content exists we
 * start from the identity default and override each role the tables remap, so
 * omitted roles keep their default label.
 */
export function parseTriageLabels(
  markdown: string | null | undefined,
): TriageMapping | null {
  if (markdown == null || markdown.trim() === "") return null;

  const labelForRole = { ...defaultTriageMapping().labelForRole };
  for (const line of markdown.split("\n")) {
    const cells = parseTableRow(line);
    if (!cells || cells.length < 2) continue;
    const [role, label] = cells;
    if (isTriageRole(role) && label !== "") {
      labelForRole[role] = label;
    }
  }
  return mappingFromLabels(labelForRole);
}
