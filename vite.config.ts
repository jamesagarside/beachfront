/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

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
  plugins: [react(), tailwindcss()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts",
  },
}));
