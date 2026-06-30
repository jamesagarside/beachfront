import { QueryClient } from "@tanstack/react-query";
import type { AgentRun } from "../github/runs.ts";
import type { Issue } from "../github/issues.ts";
import type { TriageMapping } from "../triage/mapping.ts";
import { DEMO_BAKED_AT, demoRepos, seedDemoCache } from "./demo.ts";

describe("demo data", () => {
  it("exposes a baked timestamp and at least one repo", () => {
    expect(typeof DEMO_BAKED_AT).toBe("string");
    expect(DEMO_BAKED_AT.length).toBeGreaterThan(0);
    expect(demoRepos().length).toBeGreaterThan(0);
    for (const repo of demoRepos()) {
      expect(repo.owner).toBeTruthy();
      expect(repo.repo).toBeTruthy();
    }
  });

  it("seeds issues, runs, and a triage mapping under the live hooks' keys", () => {
    const qc = new QueryClient();
    seedDemoCache(qc);

    for (const { owner, repo } of demoRepos()) {
      const issues = qc.getQueryData<Issue[]>(["issues", owner, repo]);
      expect(Array.isArray(issues)).toBe(true);
      expect(issues!.length).toBeGreaterThan(0);
      // Each baked issue has the live Issue shape.
      for (const issue of issues!) {
        expect(typeof issue.number).toBe("number");
        expect(typeof issue.title).toBe("string");
        expect(Array.isArray(issue.labels)).toBe(true);
      }

      const runs = qc.getQueryData<AgentRun[]>(["runs", owner, repo]);
      expect(Array.isArray(runs)).toBe(true);
      // Run status is collapsed to the four canonical states (not raw GitHub
      // status/conclusion), matching the live fetch.
      for (const run of runs!) {
        expect(["queued", "running", "succeeded", "failed"]).toContain(
          run.status,
        );
      }

      // The mapping key is always set (the value may be null for a repo with no
      // contract, but the demo repo ships one).
      expect(
        qc.getQueryState(["triage-mapping", owner, repo]),
      ).toBeDefined();
    }
  });

  it("seeds a usable triage mapping for the primary demo repo", () => {
    const qc = new QueryClient();
    seedDemoCache(qc);
    const { owner, repo } = demoRepos()[0];
    const mapping = qc.getQueryData<TriageMapping | null>([
      "triage-mapping",
      owner,
      repo,
    ]);
    expect(mapping).not.toBeNull();
    expect(mapping!.roleForLabel.size).toBeGreaterThan(0);
  });
});
