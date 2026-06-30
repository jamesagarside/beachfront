import { parseRoute, repoHash, SHORELINE_HASH } from "./route.ts";

describe("parseRoute", () => {
  it("resolves the root hash to the Shoreline", () => {
    expect(parseRoute("#/")).toEqual({ name: "shoreline" });
    expect(parseRoute("#")).toEqual({ name: "shoreline" });
    expect(parseRoute("")).toEqual({ name: "shoreline" });
  });

  it("resolves a per-repo hash to its canonical owner/repo", () => {
    expect(parseRoute("#/repo/alpha/one")).toEqual({
      name: "repo",
      owner: "alpha",
      repo: "one",
    });
  });

  it("percent-decodes owner/repo segments", () => {
    expect(parseRoute(repoHash("a-team", "my.repo"))).toEqual({
      name: "repo",
      owner: "a-team",
      repo: "my.repo",
    });
  });

  it("falls back to the Shoreline for an unknown shape", () => {
    expect(parseRoute("#/repo/onlyowner")).toEqual({ name: "shoreline" });
    expect(parseRoute("#/repo/a/b/c")).toEqual({ name: "shoreline" });
    expect(parseRoute("#/nonsense")).toEqual({ name: "shoreline" });
  });
});

describe("repoHash", () => {
  it("builds a deep-linkable per-repo hash round-tripped by parseRoute", () => {
    const hash = repoHash("alpha", "one");
    expect(hash).toBe("#/repo/alpha/one");
    expect(parseRoute(hash)).toEqual({ name: "repo", owner: "alpha", repo: "one" });
  });

  it("exposes the Shoreline hash", () => {
    expect(SHORELINE_HASH).toBe("#/");
  });
});
