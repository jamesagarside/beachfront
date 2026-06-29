#!/usr/bin/env -S npx tsx
/**
 * Entry point for the `beachfront` CLI. Wires the real Node side effects
 * (`fs`, `git`, `gh`) into the testable orchestration in `src/cli/link.ts`.
 *
 * Like `.sandcastle/main.mts`, this is run via tsx and lives outside the app
 * tsconfig so it needs no @types/node in the typechecked SPA build.
 *
 * Run via `npm run beachfront -- link <owner>/<repo>` (or, when installed on the
 * PATH, `beachfront link <owner>/<repo>`).
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { LinkError, type LinkDeps, runCli } from "../src/cli/link.ts";

const deps: LinkDeps = {
  exists: (path) => existsSync(path),
  mkdirp: (path) => mkdirSync(path, { recursive: true }),
  writeFile: (path, content) => writeFileSync(path, content),
  run: (command, args) => execFileSync(command, args, { encoding: "utf8" }),
  today: () => new Date().toISOString().slice(0, 10),
  log: (message) => console.error(`▸ ${message}`),
};

try {
  console.log(runCli(process.argv.slice(2), deps));
} catch (error) {
  if (error instanceof LinkError) {
    console.error(`✗ ${error.message}`);
    process.exit(1);
  }
  throw error;
}
