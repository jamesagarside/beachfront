import { parseRegistryFile, parseRegistry } from "./registry.ts";

describe("parseRegistryFile", () => {
  const PATH = "/repos/jamesagarside/beachfront.json";

  it("derives owner and repo from the file path", () => {
    expect(parseRegistryFile({}, PATH)).toEqual({
      owner: "jamesagarside",
      repo: "beachfront",
    });
  });

  it("carries optional link metadata through", () => {
    expect(
      parseRegistryFile(
        { linkedAt: "2026-06-29", linkedBy: "jamesagarside" },
        PATH,
      ),
    ).toEqual({
      owner: "jamesagarside",
      repo: "beachfront",
      linkedAt: "2026-06-29",
      linkedBy: "jamesagarside",
    });
  });

  it("accepts a body whose owner/repo match the path", () => {
    expect(
      parseRegistryFile({ owner: "jamesagarside", repo: "beachfront" }, PATH),
    ).toEqual({ owner: "jamesagarside", repo: "beachfront" });
  });

  it("rejects a body whose owner/repo conflict with the path", () => {
    expect(() =>
      parseRegistryFile({ owner: "someone", repo: "else" }, PATH),
    ).toThrow(/conflict/i);
  });

  it("rejects a path that is not repos/<owner>/<repo>.json", () => {
    expect(() => parseRegistryFile({}, "/repos/beachfront.json")).toThrow(
      /<owner>\/<repo>/i,
    );
  });

  it("rejects a non-object body", () => {
    expect(() => parseRegistryFile("nope", PATH)).toThrow(/object/i);
  });
});

describe("parseRegistry", () => {
  it("reads every file into a typed list, sorted by owner then repo", () => {
    const repos = parseRegistry({
      "/repos/zeta/one.json": {},
      "/repos/alpha/two.json": {},
      "/repos/alpha/one.json": {},
    });
    expect(repos).toEqual([
      { owner: "alpha", repo: "one" },
      { owner: "alpha", repo: "two" },
      { owner: "zeta", repo: "one" },
    ]);
  });

  it("is empty when the registry has no files", () => {
    expect(parseRegistry({})).toEqual([]);
  });
});
