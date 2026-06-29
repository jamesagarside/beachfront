import { parseRepoRef } from "./config.ts";

describe("parseRepoRef", () => {
  it("splits an owner/repo slug", () => {
    expect(parseRepoRef("jamesagarside/beachfront")).toEqual({
      owner: "jamesagarside",
      repo: "beachfront",
    });
  });

  it("tolerates surrounding whitespace", () => {
    expect(parseRepoRef("  octocat/hello-world  ")).toEqual({
      owner: "octocat",
      repo: "hello-world",
    });
  });

  it("rejects a slug without a slash", () => {
    expect(() => parseRepoRef("beachfront")).toThrow(/owner\/repo/i);
  });
});
