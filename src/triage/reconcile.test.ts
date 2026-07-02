import { describe, expect, it } from "vitest";
import { defaultTriageMapping, parseTriageLabels } from "./mapping.ts";
import { reconcileStateRole } from "./reconcile.ts";

const mapping = defaultTriageMapping();

describe("reconcileStateRole", () => {
  it("adds the target and removes any other state-role label", () => {
    const plan = reconcileStateRole(
      ["enhancement", "needs-triage"],
      mapping,
      "ready-for-agent",
    );
    expect(plan).toEqual({
      target: "ready-for-agent",
      add: "ready-for-agent",
      remove: ["needs-triage"],
    });
  });

  it("is a no-op add when the issue already carries the target role", () => {
    const plan = reconcileStateRole(
      ["enhancement", "ready-for-agent"],
      mapping,
      "ready-for-agent",
    );
    expect(plan).toEqual({
      target: "ready-for-agent",
      add: null,
      remove: [],
    });
  });

  it("leaves category labels and non-triage labels untouched", () => {
    const plan = reconcileStateRole(
      ["bug", "docs", "wontfix"],
      mapping,
      "needs-info",
    );
    expect(plan.remove).toEqual(["wontfix"]);
    expect(plan.add).toBe("needs-info");
  });

  it("honours a repo's remapped labels", () => {
    const remapped = parseTriageLabels(
      "| ready-for-agent | agent-ready |\n| needs-triage | triage |",
    );
    const plan = reconcileStateRole(["triage"], remapped, "ready-for-agent");
    expect(plan).toEqual({
      target: "agent-ready",
      add: "agent-ready",
      remove: ["triage"],
    });
  });

  it("falls back to the default Mapping when the repo ships none", () => {
    const plan = reconcileStateRole(["needs-triage"], null, "ready-for-agent");
    expect(plan).toEqual({
      target: "ready-for-agent",
      add: "ready-for-agent",
      remove: ["needs-triage"],
    });
  });
});
