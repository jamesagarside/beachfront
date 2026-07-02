/// <reference types="vitest/config" />
import { execFileSync } from "node:child_process";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// The harness vintage this SPA build ships from (#115): the Tool-repo short git
// SHA, baked in so the static bundle can judge each Managed repo's
// `.sandcastle/.beachfront-version` stamp without a runtime git call. Actions
// exposes it as GITHUB_SHA (truncated to git's 7-char short form); local builds
// read it from git; a build with neither leaves it "" so drift degrades to
// "unknown" rather than a false "behind".
function harnessVersion(): string {
  const fromCi = process.env.GITHUB_SHA?.slice(0, 7);
  if (fromCi) return fromCi;
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], {
      encoding: "utf8",
    }).trim();
  } catch {
    return "";
  }
}

// Project Pages serve an Instance from /<repo-name>/, so production builds must
// be base-pathed per Instance — a template Instance named anything other than
// "beachfront" would otherwise ship asset URLs that 404 into a blank page. In
// Actions the name comes from GITHUB_REPOSITORY; BEACHFRONT_BASE overrides for
// non-Pages hosting (e.g. "/" for a custom domain). Dev stays root-relative,
// and preview uses the build base so it serves what was actually built.
const repoName = process.env.GITHUB_REPOSITORY?.split("/")[1];
const buildBase =
  process.env.BEACHFRONT_BASE ?? (repoName ? `/${repoName}/` : "/beachfront/");

export default defineConfig(({ command, isPreview }) => ({
  base: command === "build" || isPreview ? buildBase : "/",
  // Bake the build's harness vintage in for the real SPA, but NOT under vitest:
  // leaving the global undefined in tests lets `currentHarnessVersion()` fall to
  // its env/null path, so the module's own resolution stays testable while the
  // drift comparison takes the vintage as an injected parameter regardless.
  define: process.env.VITEST
    ? {}
    : { __BEACHFRONT_HARNESS_VERSION__: JSON.stringify(harnessVersion()) },
  plugins: [react(), tailwindcss()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts",
  },
}));
