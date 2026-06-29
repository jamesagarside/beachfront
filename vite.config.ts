/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Project Pages are served from /<repo>/, so the build must be base-pathed.
// In dev/preview we keep root-relative paths.
export default defineConfig(({ command }) => ({
  base: command === "build" ? "/beachfront/" : "/",
  plugins: [react(), tailwindcss()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts",
  },
}));
