import { webDataSource } from "./webDataSource.ts";

const REPOS = [
  { owner: "alpha", repo: "one" },
  { owner: "beta", repo: "two" },
];

describe("webDataSource", () => {
  it("satisfies the EstateDataSource interface and lists the given repos", async () => {
    const source = webDataSource("tok", REPOS);
    expect(await source.listRepos()).toEqual(REPOS);
  });
});
