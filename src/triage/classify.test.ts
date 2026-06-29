import { classify } from "./classify.ts";
import { parseTriageLabels, defaultTriageMapping } from "./mapping.ts";

const mapping = defaultTriageMapping();

describe("classify", () => {
  it("tags an issue with its canonical state and category role", () => {
    const result = classify(["bug", "ready-for-agent"], mapping);
    expect(result.categoryRole).toBe("bug");
    expect(result.stateRole).toBe("ready-for-agent");
    expect(result.untriaged).toBe(false);
    expect(result.conflict).toBe(false);
  });

  it("classifies an issue with no triage labels as untriaged", () => {
    const result = classify([], mapping);
    expect(result.untriaged).toBe(true);
    expect(result.categoryRole).toBeNull();
    expect(result.stateRole).toBeNull();
  });

  it("treats labels that map to no role as untriaged", () => {
    const result = classify(["documentation", "good first issue"], mapping);
    expect(result.untriaged).toBe(true);
    expect(result.categoryRole).toBeNull();
    expect(result.stateRole).toBeNull();
  });

  it("flags an issue whose labels resolve to two state roles", () => {
    const result = classify(["ready-for-agent", "needs-triage"], mapping);
    expect(result.conflict).toBe(true);
    expect(result.stateRole).toBeNull();
    expect(result.stateRoles).toEqual(
      expect.arrayContaining(["ready-for-agent", "needs-triage"]),
    );
    // a conflicted issue is not untriaged — it carries triage labels
    expect(result.untriaged).toBe(false);
  });

  it("flags conflicting category roles too", () => {
    const result = classify(["bug", "enhancement"], mapping);
    expect(result.conflict).toBe(true);
    expect(result.categoryRole).toBeNull();
    expect(result.categoryRoles).toEqual(
      expect.arrayContaining(["bug", "enhancement"]),
    );
  });

  it("resolves a role through a repo's remapped label string", () => {
    const remapped = parseTriageLabels(
      "| `ready-for-agent` | `agent-ready` |\n",
    )!;
    const result = classify(["agent-ready"], remapped);
    expect(result.stateRole).toBe("ready-for-agent");
    expect(classify(["ready-for-agent"], remapped).untriaged).toBe(true);
  });

  it("dedupes a role reached by repeated labels", () => {
    const result = classify(["bug", "bug"], mapping);
    expect(result.categoryRoles).toEqual(["bug"]);
    expect(result.conflict).toBe(false);
    expect(result.categoryRole).toBe("bug");
  });

  it("offers no classification when the repo has no Mapping", () => {
    const result = classify(["bug", "ready-for-agent"], null);
    expect(result.categoryRole).toBeNull();
    expect(result.stateRole).toBeNull();
    expect(result.untriaged).toBe(false);
    expect(result.conflict).toBe(false);
  });
});
