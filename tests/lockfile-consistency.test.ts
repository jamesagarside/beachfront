import { readFileSync } from "node:fs";
import { join } from "node:path";

// Regression guard for the Sandcastle CI SyncError (ADR-0011).
//
// The headless Sandcastle loop runs `npm install` on the runner before its
// host-side `git merge` (merge-to-head). If package.json and package-lock.json
// have drifted, that install rewrites the lockfile, dirties the working tree,
// and the merge aborts with "local changes would be overwritten". The drift
// that triggered it in practice was a `bin` field added to package.json (the
// Beachfront CLI, #16) without regenerating the lockfile — a divergence that
// `npm ci` does NOT reject, so normal CI stayed green while the loop broke.
//
// This test fails the moment the root package's metadata in the lockfile stops
// mirroring package.json, catching the drift at PR time instead of in a runner.

const root = process.cwd();
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const lock = JSON.parse(readFileSync(join(root, "package-lock.json"), "utf8"));

describe("package-lock.json mirrors package.json (root package)", () => {
  const rootEntry = lock.packages?.[""];

  it("has a root package entry", () => {
    expect(rootEntry).toBeDefined();
  });

  for (const field of ["bin", "dependencies", "devDependencies"] as const) {
    it(`agrees on \`${field}\``, () => {
      expect(rootEntry?.[field]).toEqual(pkg[field]);
    });
  }
});
