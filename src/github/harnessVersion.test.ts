import { firstLine, HARNESS_VERSION_PATH } from "./harnessVersion.ts";

/**
 * The web harness-version fetcher itself hits Octokit, so like `triageMapping`
 * it is exercised end-to-end by the data-source tests; here we pin the pure
 * pieces both surfaces share: the stamp path and the first-line extraction (the
 * stamp's first line is the vintage; anything after it is human notes).
 */
describe("HARNESS_VERSION_PATH", () => {
  it("points at the onboarder's stamp file", () => {
    expect(HARNESS_VERSION_PATH).toBe(".sandcastle/.beachfront-version");
  });
});

describe("firstLine", () => {
  it("takes the first line and trims it", () => {
    expect(firstLine("abc1234\n")).toBe("abc1234");
    expect(firstLine("  abc1234  \n")).toBe("abc1234");
  });

  it("ignores trailing human notes after the vintage line", () => {
    expect(firstLine("abc1234\n# installed 2026-07-02 by onboarder\n")).toBe(
      "abc1234",
    );
  });

  it("returns null for empty or whitespace-only content", () => {
    expect(firstLine("")).toBeNull();
    expect(firstLine("   \n  ")).toBeNull();
  });
});
