/**
 * The Registry: the source of truth for which repos an Instance aggregates
 * (ADR-0002). It is a `repos/` directory with one file per peered repo at
 * `repos/<owner>/<repo>.json`. One file per repo keeps onboarding PRs
 * conflict-free; the directory is maintained only by Linking, never hand-edited.
 *
 * Beachfront is a static SPA, so the directory is read at build time via Vite's
 * `import.meta.glob`. The filename is the canonical owner/repo; a file body may
 * carry optional link metadata (and may restate owner/repo, which must match).
 *
 * See `docs/registry-schema.md` for the file shape.
 */
export interface RegistryRepo {
  owner: string;
  repo: string;
  /** ISO date the repo was linked, if recorded by the Linking producer. */
  linkedAt?: string;
  /** GitHub login that opened the linking PR, if recorded. */
  linkedBy?: string;
}

const PATH_RE = /\/repos\/([^/]+)\/([^/]+)\.json$/;

function ownerRepoFromPath(path: string): { owner: string; repo: string } {
  const match = PATH_RE.exec(path);
  if (!match) {
    throw new Error(
      `Invalid Registry path "${path}". Expected repos/<owner>/<repo>.json.`,
    );
  }
  return { owner: match[1], repo: match[2] };
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/**
 * Parses one Registry file's contents (already JSON-decoded) plus its path into
 * a typed {@link RegistryRepo}. The path is canonical; if the body restates
 * owner/repo they must match, so a misfiled entry fails loudly.
 */
export function parseRegistryFile(raw: unknown, path: string): RegistryRepo {
  const { owner, repo } = ownerRepoFromPath(path);

  if (raw === null || typeof raw !== "object") {
    throw new Error(`Registry file "${path}" must contain a JSON object.`);
  }
  const body = raw as Record<string, unknown>;

  const bodyOwner = optionalString(body.owner);
  const bodyRepo = optionalString(body.repo);
  if (
    (bodyOwner !== undefined && bodyOwner !== owner) ||
    (bodyRepo !== undefined && bodyRepo !== repo)
  ) {
    throw new Error(
      `Registry file "${path}" owner/repo conflict with its path ` +
        `(${bodyOwner ?? owner}/${bodyRepo ?? repo} vs ${owner}/${repo}).`,
    );
  }

  const entry: RegistryRepo = { owner, repo };
  const linkedAt = optionalString(body.linkedAt);
  const linkedBy = optionalString(body.linkedBy);
  if (linkedAt !== undefined) entry.linkedAt = linkedAt;
  if (linkedBy !== undefined) entry.linkedBy = linkedBy;
  return entry;
}

/**
 * Parses a map of Registry file path → decoded contents into a typed list of
 * Managed repos, sorted by owner then repo for a stable render order.
 */
export function parseRegistry(
  files: Record<string, unknown>,
): RegistryRepo[] {
  return Object.entries(files)
    .map(([path, raw]) => parseRegistryFile(raw, path))
    .sort((a, b) =>
      a.owner === b.owner
        ? a.repo.localeCompare(b.repo)
        : a.owner.localeCompare(b.owner),
    );
}

/**
 * Reads the Instance's `repos/` Registry at build time. Eager glob import means
 * the files are bundled into the SPA — no runtime fetch — matching the
 * static-hosting model (ADR-0005).
 */
export function loadRegistry(): RegistryRepo[] {
  const files = import.meta.glob("/repos/**/*.json", {
    eager: true,
    import: "default",
  });
  return parseRegistry(files);
}
