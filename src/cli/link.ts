/**
 * `beachfront link <owner>/<repo>` — the local-command Linking producer (ADR-0002,
 * producer 2). It adds the canonical Registry file `repos/<owner>/<repo>.json` to
 * the Instance on a branch and opens a PR via `gh`, mirroring the UI Link flow
 * (#15) for terminal use.
 *
 * The documented assumption (ADR-0002) is that the operator already has `gh`
 * access to both the repo being linked and the Instance repo this command runs in;
 * Beachfront brokers no credentials of its own.
 *
 * All side effects (filesystem, `git`, `gh`) are injected via {@link LinkDeps} so
 * the orchestration is unit-testable without shelling out. `src/cli/main.ts` wires
 * the real Node implementations.
 */

/** A user-facing failure: a bad argument, a duplicate, or an inaccessible repo. */
export class LinkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LinkError";
  }
}

/** The injected, side-effecting dependencies the link orchestration needs. */
export interface LinkDeps {
  /** True if a path already exists in the Instance working tree. */
  exists(path: string): boolean;
  /** Ensure a directory (and parents) exists. */
  mkdirp(path: string): void;
  /** Write a file, replacing any existing contents. */
  writeFile(path: string, content: string): void;
  /** Run a command, returning its stdout. Throws on a non-zero exit. */
  run(command: string, args: string[]): string;
  /** Today's date as an ISO `yyyy-mm-dd` string. */
  today(): string;
  /** Emit a line of progress to the operator. */
  log(message: string): void;
}

export interface LinkResult {
  owner: string;
  repo: string;
  path: string;
  branch: string;
  prUrl: string;
  linkedBy?: string;
}

// GitHub owners and repo names allow alphanumerics, hyphen, underscore and dot.
const SEGMENT_RE = /^[A-Za-z0-9._-]+$/;

/**
 * Parse and validate an `owner/repo` argument. Trims surrounding whitespace and a
 * trailing `.git`, and rejects anything that is not exactly two non-empty
 * segments of legal characters.
 */
export function parseRepoArg(arg: string): { owner: string; repo: string } {
  const cleaned = arg.trim().replace(/\.git$/, "");
  const parts = cleaned.split("/");
  if (parts.length !== 2) {
    throw new LinkError(
      `Invalid repo "${arg}". Expected <owner>/<repo>, e.g. octo-org/widgets.`,
    );
  }
  const [owner, repo] = parts;
  if (!SEGMENT_RE.test(owner) || !SEGMENT_RE.test(repo)) {
    throw new LinkError(
      `Invalid repo "${arg}". Expected <owner>/<repo>, e.g. octo-org/widgets.`,
    );
  }
  return { owner, repo };
}

/** The canonical Registry path for a repo (filename is the source of truth). */
export function registryPath(owner: string, repo: string): string {
  return `repos/${owner}/${repo}.json`;
}

/** A deterministic branch name so re-running points at the same linking branch. */
export function linkBranch(owner: string, repo: string): string {
  return `link/${owner}-${repo}`;
}

/**
 * Render a Registry file body matching `docs/registry-schema.md`: pretty-printed
 * JSON with a trailing newline. `linkedBy` is omitted when unknown.
 */
export function registryFileBody(entry: {
  owner: string;
  repo: string;
  linkedAt: string;
  linkedBy?: string;
}): string {
  const body: Record<string, string> = {
    owner: entry.owner,
    repo: entry.repo,
    linkedAt: entry.linkedAt,
  };
  if (entry.linkedBy) body.linkedBy = entry.linkedBy;
  return `${JSON.stringify(body, null, 2)}\n`;
}

/** Best-effort lookup of the operator's GitHub login for `linkedBy`. */
function resolveLogin(deps: LinkDeps): string | undefined {
  try {
    const login = deps.run("gh", ["api", "user", "--jq", ".login"]).trim();
    return login || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Link a repo into the Instance: validate access, refuse duplicates, then write
 * the Registry file on a branch and open a PR via `gh`.
 */
export function linkRepo(repoArg: string, deps: LinkDeps): LinkResult {
  const { owner, repo } = parseRepoArg(repoArg);
  const slug = `${owner}/${repo}`;

  // Validate access to the repo being linked before touching anything (ADR-0002:
  // the Registry is a list of candidates the Viewer's token gates).
  try {
    deps.run("gh", ["repo", "view", slug]);
  } catch {
    throw new LinkError(
      `Cannot access ${slug} with your gh login. Check the name and that you have access.`,
    );
  }

  const path = registryPath(owner, repo);
  if (deps.exists(path)) {
    throw new LinkError(`${slug} is already linked (${path}).`);
  }

  const linkedBy = resolveLogin(deps);
  const branch = linkBranch(owner, repo);
  const body = registryFileBody({
    owner,
    repo,
    linkedAt: deps.today(),
    linkedBy,
  });

  deps.log(`Linking ${slug} — creating ${path} on ${branch}`);
  deps.run("git", ["switch", "-c", branch]);
  deps.mkdirp(`repos/${owner}`);
  deps.writeFile(path, body);
  deps.run("git", ["add", path]);
  deps.run("git", ["commit", "-m", `Link ${slug}`]);
  deps.run("git", ["push", "-u", "origin", branch]);

  const prUrl = deps
    .run("gh", [
      "pr",
      "create",
      "--head",
      branch,
      "--title",
      `Link ${slug}`,
      "--body",
      `Adds the Registry file \`${path}\` to peer ${slug} with this Instance ` +
        `(ADR-0002). Aggregation reads it as the Viewer's own token.`,
    ])
    .trim();

  return { owner, repo, path, branch, prUrl, linkedBy };
}

/** Help text for the CLI. */
export function usage(): string {
  return [
    "beachfront — link a repo into this Instance's Registry",
    "",
    "Usage:",
    "  beachfront link <owner>/<repo>   Add the Registry file and open a PR via gh",
    "  beachfront --help                Show this help",
    "",
    "Linking opens a PR; review and merge it to start aggregating the repo (ADR-0002).",
    "You need gh access to both <owner>/<repo> and this Instance repo.",
  ].join("\n");
}

/** Route argv to a subcommand. Returns the message to print on success. */
export function runCli(argv: string[], deps: LinkDeps): string {
  const [command, ...rest] = argv;
  if (!command || command === "--help" || command === "-h" || command === "help") {
    return usage();
  }
  if (command === "link") {
    const repoArg = rest.find((a) => !a.startsWith("-"));
    if (!repoArg) {
      throw new LinkError(`Missing <owner>/<repo>.\n\n${usage()}`);
    }
    const result = linkRepo(repoArg, deps);
    return `✓ Linked ${result.owner}/${result.repo} — opened PR ${result.prUrl}`;
  }
  throw new LinkError(`Unknown command "${command}".\n\n${usage()}`);
}
