import { afterEach } from "vitest";
import { currentHarnessVersion } from "./harnessVersion.ts";

/**
 * `currentHarnessVersion` is the single source of "which harness vintage did
 * this Beachfront ship from?". It is injected at build time (Vite `define`) or
 * via the environment for the plugin/CLI, with a null floor when neither is set
 * so drift degrades to `unknown` rather than crashing a build that forgot to
 * stamp itself. These tests pin that floor and the env override; the injected
 * `define` constant is exercised end-to-end by the real build.
 */
const ENV_KEY = "BEACHFRONT_HARNESS_VERSION";
const original = process.env[ENV_KEY];

describe("currentHarnessVersion", () => {
  afterEach(() => {
    if (original === undefined) delete process.env[ENV_KEY];
    else process.env[ENV_KEY] = original;
  });

  it("returns the vintage from the environment when set", () => {
    process.env[ENV_KEY] = "deadbee";
    expect(currentHarnessVersion()).toBe("deadbee");
  });

  it("trims a padded environment value to the bare vintage", () => {
    process.env[ENV_KEY] = "  deadbee\n";
    expect(currentHarnessVersion()).toBe("deadbee");
  });

  it("returns null when no vintage was injected (drift degrades to unknown)", () => {
    delete process.env[ENV_KEY];
    // In tests neither the Vite define nor the env var is set.
    expect(currentHarnessVersion()).toBeNull();
  });
});
