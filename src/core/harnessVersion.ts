/**
 * The running Beachfront's own harness vintage (#115): the Tool-repo short git
 * SHA this build was cut from, the yardstick every Managed repo's stamp is
 * measured against. Design choice — a build-time/injectable constant, not a live
 * git call: the web SPA is a static bundle with no git at runtime, and the MCP
 * plugin/CLI run from a checkout that may not be the Tool repo, so the vintage
 * has to be baked in when the artifact is produced.
 *
 * Two injection points, one answer:
 *   • the web build: Vite `define`s `__BEACHFRONT_HARNESS_VERSION__` (see
 *     vite.config.ts), read from `git rev-parse --short HEAD` at build time;
 *   • the plugin/CLI and any Node context: the `BEACHFRONT_HARNESS_VERSION`
 *     environment variable.
 * When neither is set (e.g. a bare `vitest` run, or a build that forgot to
 * stamp itself) this returns null, and {@link computeHarnessDrift} degrades to
 * `unknown` — an honest "can't tell", never a false `behind`.
 *
 * The comparison itself takes this value as a parameter, so tests drive drift
 * with any vintage without touching the build.
 */

/** The Vite-injected build vintage; `undefined` outside a Vite build. */
declare const __BEACHFRONT_HARNESS_VERSION__: string | undefined;

/** Normalise a raw vintage (a file line or env value) to null-or-bare-SHA. */
function normalise(raw: string | undefined): string | null {
  if (raw === undefined) return null;
  const trimmed = raw.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * The harness vintage this Beachfront was built from, or null when no vintage
 * was injected. Prefers the Vite `define` (web build), then the environment
 * (plugin / CLI / Node).
 */
export function currentHarnessVersion(): string | null {
  const injected =
    typeof __BEACHFRONT_HARNESS_VERSION__ === "string"
      ? __BEACHFRONT_HARNESS_VERSION__
      : undefined;
  const fromEnv =
    typeof process !== "undefined" ? process.env?.BEACHFRONT_HARNESS_VERSION : undefined;
  return normalise(injected) ?? normalise(fromEnv);
}
