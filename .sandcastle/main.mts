import { run, claudeCode } from "@ai-hero/sandcastle";
import { docker } from "@ai-hero/sandcastle/sandboxes/docker";

// Simple loop: an agent that picks open issues one by one and closes them.
// Run this with: npx tsx .sandcastle/main.mts
// Or add to package.json scripts: "sandcastle": "npx tsx .sandcastle/main.mts"

await run({
  // A name for this run, shown as a prefix in log output.
  name: "worker",

  // Sandbox provider — runs the agent inside an isolated container.
  sandbox: docker(),

  // The agent provider. Pass a model string to claudeCode() — sonnet balances
  // capability and speed for most tasks. Switch to claude-haiku-4-5-20251001 for
  // speed. claude-opus-4-8 is the strongest for the early architectural slices.
  agent: claudeCode("claude-opus-4-8"),

  // Path to the prompt file. Shell expressions inside are evaluated inside the
  // sandbox at the start of each iteration, so the agent always sees fresh data.
  promptFile: "./.sandcastle/prompt.md",

  // Maximum number of iterations (agent invocations) to run in a session.
  // Each iteration works on a single issue. Set to 1 for a cautious first run —
  // review the result, then raise this to grind through more ready-for-agent issues.
  maxIterations: 1,

  // Branch strategy — merge-to-head creates a temporary worker branch for the
  // agent to work on, then merges the result back onto HEAD when the run
  // completes. That merge-back is a host-side `git merge` run against the
  // checked-out repo, so it REQUIRES A CLEAN HOST WORKING TREE: if any tracked
  // file is dirty when the merge runs, git aborts with "local changes would be
  // overwritten by merge" and the loop dies with a SyncError. Headless in CI,
  // the runner's `npm install` step can dirty package-lock.json (a lockfile
  // that has drifted from package.json), which is exactly what broke every run
  // — see docs/adr/0011 and .github/workflows/sandcastle.yml, which keeps the
  // host tree pristine before this merge.
  branchStrategy: { type: "merge-to-head" },

  // Lifecycle hooks — commands grouped by where they run (host or sandbox).
  hooks: {
    sandbox: {
      // onSandboxReady runs once after the sandbox is initialised and the repo is
      // synced in, before the agent starts. `npm install --no-audit` is a no-op
      // until a package.json exists, then installs deps on later iterations.
      onSandboxReady: [{ command: "npm install --no-audit || true" }],
    },
  },
});
