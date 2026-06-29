import { describe, expect, it } from "vitest";
import { parseRegistryFile } from "../registry/registry";
import {
  LinkError,
  type LinkDeps,
  linkBranch,
  linkRepo,
  parseRepoArg,
  registryFileBody,
  registryPath,
  runCli,
  usage,
} from "./link";

/**
 * A recording fake for the side-effecting dependencies. The link command's
 * value is the *sequence* of gh/git calls it makes and the file it writes, so
 * we assert on those rather than shelling out for real.
 */
function makeDeps(
  options: {
    existing?: string[];
    failOn?: (command: string, args: string[]) => boolean;
  } = {},
) {
  const calls: Array<{ command: string; args: string[] }> = [];
  const files: Record<string, string> = {};
  const dirs: string[] = [];
  const existing = new Set(options.existing ?? []);

  const deps: LinkDeps = {
    exists: (path) => existing.has(path),
    mkdirp: (path) => {
      dirs.push(path);
    },
    writeFile: (path, content) => {
      files[path] = content;
    },
    run: (command, args) => {
      calls.push({ command, args });
      if (options.failOn?.(command, args)) {
        throw new Error(`fake: ${command} ${args.join(" ")} failed`);
      }
      if (command === "gh" && args[0] === "api" && args[1] === "user") {
        return "octocat\n";
      }
      if (command === "gh" && args[0] === "pr" && args[1] === "create") {
        return "https://github.com/jamesagarside/beachfront/pull/99\n";
      }
      return "";
    },
    today: () => "2026-06-29",
    log: () => {},
  };

  const ran = (command: string, sub?: string) =>
    calls.some((c) => c.command === command && (sub === undefined || c.args[0] === sub));

  return { deps, calls, files, dirs, ran };
}

describe("parseRepoArg", () => {
  it("splits a valid owner/repo", () => {
    expect(parseRepoArg("jamesagarside/beachfront")).toEqual({
      owner: "jamesagarside",
      repo: "beachfront",
    });
  });

  it("trims surrounding whitespace and a trailing .git", () => {
    expect(parseRepoArg("  octo-org/My.Repo_1.git ")).toEqual({
      owner: "octo-org",
      repo: "My.Repo_1",
    });
  });

  it("rejects a missing slash", () => {
    expect(() => parseRepoArg("beachfront")).toThrow(LinkError);
  });

  it("rejects empty segments", () => {
    expect(() => parseRepoArg("owner/")).toThrow(LinkError);
    expect(() => parseRepoArg("/repo")).toThrow(LinkError);
  });

  it("rejects extra path segments", () => {
    expect(() => parseRepoArg("owner/repo/extra")).toThrow(LinkError);
  });

  it("rejects illegal characters", () => {
    expect(() => parseRepoArg("ow ner/repo")).toThrow(LinkError);
    expect(() => parseRepoArg("owner/re po")).toThrow(LinkError);
  });
});

describe("path and branch helpers", () => {
  it("builds the canonical registry path", () => {
    expect(registryPath("jamesagarside", "beachfront")).toBe(
      "repos/jamesagarside/beachfront.json",
    );
  });

  it("builds a deterministic branch name", () => {
    expect(linkBranch("jamesagarside", "beachfront")).toBe(
      "link/jamesagarside-beachfront",
    );
  });
});

describe("registryFileBody", () => {
  it("produces a file the registry parser accepts", () => {
    const body = registryFileBody({
      owner: "jamesagarside",
      repo: "beachfront",
      linkedAt: "2026-06-29",
      linkedBy: "octocat",
    });
    expect(body.endsWith("\n")).toBe(true);
    const parsed = parseRegistryFile(
      JSON.parse(body),
      "/repos/jamesagarside/beachfront.json",
    );
    expect(parsed).toEqual({
      owner: "jamesagarside",
      repo: "beachfront",
      linkedAt: "2026-06-29",
      linkedBy: "octocat",
    });
  });

  it("omits linkedBy when it is unknown", () => {
    const body = registryFileBody({
      owner: "o",
      repo: "r",
      linkedAt: "2026-06-29",
    });
    expect(JSON.parse(body)).toEqual({
      owner: "o",
      repo: "r",
      linkedAt: "2026-06-29",
    });
  });
});

describe("usage", () => {
  it("documents the link command", () => {
    expect(usage()).toContain("beachfront link");
  });
});

describe("linkRepo", () => {
  it("checks access, writes the file, and opens a PR", () => {
    const { deps, files, calls, ran } = makeDeps();
    const result = linkRepo("jamesagarside/beachfront", deps);

    // Access is verified before anything is written.
    expect(
      calls.some(
        (c) =>
          c.command === "gh" &&
          c.args[0] === "repo" &&
          c.args[1] === "view" &&
          c.args[2] === "jamesagarside/beachfront",
      ),
    ).toBe(true);

    const path = "repos/jamesagarside/beachfront.json";
    expect(files[path]).toBeDefined();
    const parsed = parseRegistryFile(JSON.parse(files[path]), `/${path}`);
    expect(parsed.owner).toBe("jamesagarside");
    expect(parsed.linkedBy).toBe("octocat");
    expect(parsed.linkedAt).toBe("2026-06-29");

    // A branch is created, committed, pushed, and a PR opened.
    expect(ran("git")).toBe(true);
    expect(
      calls.some((c) => c.command === "gh" && c.args[0] === "pr" && c.args[1] === "create"),
    ).toBe(true);
    expect(result.prUrl).toBe(
      "https://github.com/jamesagarside/beachfront/pull/99",
    );
    expect(result.branch).toBe("link/jamesagarside-beachfront");
  });

  it("refuses a duplicate without writing or pushing", () => {
    const { deps, files, ran } = makeDeps({
      existing: ["repos/jamesagarside/beachfront.json"],
    });
    expect(() => linkRepo("jamesagarside/beachfront", deps)).toThrow(/already linked/);
    expect(files).toEqual({});
    expect(ran("git", "push")).toBe(false);
  });

  it("refuses a repo it cannot access", () => {
    const { deps, files, ran } = makeDeps({
      failOn: (command, args) =>
        command === "gh" && args[0] === "repo" && args[1] === "view",
    });
    expect(() => linkRepo("secret/repo", deps)).toThrow(/access/i);
    expect(files).toEqual({});
    expect(ran("git")).toBe(false);
  });

  it("still links when the viewer login cannot be resolved", () => {
    const { deps, files } = makeDeps({
      failOn: (command, args) =>
        command === "gh" && args[0] === "api" && args[1] === "user",
    });
    const result = linkRepo("o/r", deps);
    const body = JSON.parse(files["repos/o/r.json"]);
    expect(body.linkedBy).toBeUndefined();
    expect(result.prUrl).toContain("/pull/");
  });
});

describe("runCli", () => {
  it("prints usage with no arguments or --help", () => {
    const { deps } = makeDeps();
    expect(runCli([], deps)).toContain("beachfront link");
    expect(runCli(["--help"], deps)).toContain("beachfront link");
  });

  it("links a repo via the link subcommand", () => {
    const { deps, files } = makeDeps();
    const out = runCli(["link", "jamesagarside/beachfront"], deps);
    expect(out).toMatch(/Linked jamesagarside\/beachfront/);
    expect(files["repos/jamesagarside/beachfront.json"]).toBeDefined();
  });

  it("errors with usage when link is missing its argument", () => {
    const { deps } = makeDeps();
    expect(() => runCli(["link"], deps)).toThrow(LinkError);
  });

  it("rejects an unknown command", () => {
    const { deps } = makeDeps();
    expect(() => runCli(["frobnicate"], deps)).toThrow(LinkError);
  });
});
