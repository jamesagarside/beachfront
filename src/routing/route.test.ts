import {
  hashFor,
  parseHash,
  repoHash,
  sameRoute,
  SHORELINE,
  type Route,
} from "./route.ts";

describe("parseHash", () => {
  it("treats empty and #/ as the Shoreline", () => {
    expect(parseHash("")).toEqual({ kind: "shoreline" });
    expect(parseHash("#")).toEqual({ kind: "shoreline" });
    expect(parseHash("#/")).toEqual({ kind: "shoreline" });
  });

  it("parses a repo deep-link into its owner/repo", () => {
    expect(parseHash("#/repo/jamesagarside/beachfront")).toEqual({
      kind: "repo",
      owner: "jamesagarside",
      repo: "beachfront",
    });
  });

  it("tolerates a trailing slash on a repo route", () => {
    expect(parseHash("#/repo/acme/widgets/")).toEqual({
      kind: "repo",
      owner: "acme",
      repo: "widgets",
    });
  });

  it("decodes percent-encoded segments", () => {
    expect(parseHash("#/repo/a%2Fb/c")).toMatchObject({ owner: "a/b" });
  });

  it("falls back to the Shoreline for unknown or malformed routes", () => {
    expect(parseHash("#/repo/onlyowner")).toEqual({ kind: "shoreline" });
    expect(parseHash("#/repo//beachfront")).toEqual({ kind: "shoreline" });
    expect(parseHash("#/somewhere/else")).toEqual({ kind: "shoreline" });
  });
});

describe("hashFor / repoHash round-trip", () => {
  it("serializes the Shoreline to #/", () => {
    expect(hashFor(SHORELINE)).toBe("#/");
  });

  it("round-trips a repo route through its hash", () => {
    const route: Route = {
      kind: "repo",
      owner: "jamesagarside",
      repo: "beachfront",
    };
    expect(hashFor(route)).toBe("#/repo/jamesagarside/beachfront");
    expect(parseHash(hashFor(route))).toEqual(route);
  });

  it("repoHash builds the canonical key hash", () => {
    expect(repoHash({ owner: "acme", repo: "widgets" })).toBe(
      "#/repo/acme/widgets",
    );
  });
});

describe("sameRoute", () => {
  it("matches two Shoreline routes", () => {
    expect(sameRoute(SHORELINE, { kind: "shoreline" })).toBe(true);
  });

  it("matches identical repo routes and rejects different ones", () => {
    const a: Route = { kind: "repo", owner: "o", repo: "r" };
    expect(sameRoute(a, { kind: "repo", owner: "o", repo: "r" })).toBe(true);
    expect(sameRoute(a, { kind: "repo", owner: "o", repo: "other" })).toBe(
      false,
    );
    expect(sameRoute(a, SHORELINE)).toBe(false);
  });
});
