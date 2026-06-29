import { useState } from "react";
import { configuredRepo, type RepoRef } from "../config.ts";
import type { RegistryRepo } from "../registry/registry.ts";
import { openLinkPr } from "./openLink.ts";
import { validateLink } from "./validateLink.ts";

/**
 * The UI Link flow (ADR-0002, the "UI (pull)" producer). The Viewer types an
 * `owner/repo`; Beachfront first confirms — using the Viewer's own token — that
 * it's well-formed, not already linked, and accessible (#14), then opens the
 * linking PR against the Instance with that same token (#15). A read-only token
 * passes validation but is told clearly at the open-PR step that linking needs
 * write scope.
 */
type Phase =
  | { kind: "idle" }
  | { kind: "validating" }
  | { kind: "valid"; ref: RepoRef }
  | { kind: "linking"; ref: RepoRef }
  | { kind: "linked"; ref: RepoRef; url: string }
  | { kind: "error"; message: string };

export function LinkForm({
  token,
  repos,
  linkedBy,
  instance = configuredRepo(),
}: {
  token: string;
  repos: RegistryRepo[];
  /** The Viewer's login, recorded as who opened the link. */
  linkedBy: string;
  /** Instance the PR targets; defaults to the configured Instance repo. */
  instance?: RepoRef;
}) {
  const [slug, setSlug] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = slug.trim();
    if (!trimmed) return;
    setPhase({ kind: "validating" });
    try {
      const ref = await validateLink(token, trimmed, repos);
      setPhase({ kind: "valid", ref });
    } catch (err: unknown) {
      setPhase({
        kind: "error",
        message: err instanceof Error ? err.message : "Couldn't validate that repo.",
      });
    }
  }

  async function handleLink(ref: RepoRef) {
    setPhase({ kind: "linking", ref });
    try {
      const { url } = await openLinkPr(token, ref, instance, { linkedBy });
      setPhase({ kind: "linked", ref, url });
    } catch (err: unknown) {
      setPhase({
        kind: "error",
        message:
          err instanceof Error ? err.message : "Couldn't open the linking PR.",
      });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 text-left">
      <label htmlFor="link-repo" className="text-deep-sea">
        Link a repo — enter its <strong>owner/repo</strong>.
      </label>
      <input
        id="link-repo"
        type="text"
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        value={slug}
        onChange={(e) => {
          setSlug(e.target.value);
          if (phase.kind === "valid" || phase.kind === "error" || phase.kind === "linked") {
            setPhase({ kind: "idle" });
          }
        }}
        placeholder="owner/repo"
        className="rounded border border-deep-sea/30 bg-white/60 px-3 py-2 text-deep-sea outline-none focus:border-deep-sea"
      />
      <button
        type="submit"
        disabled={phase.kind === "validating"}
        className="self-start rounded bg-tide-teal px-4 py-2 text-white disabled:opacity-60"
      >
        {phase.kind === "validating" ? "Validating…" : "Validate"}
      </button>
      {(phase.kind === "valid" || phase.kind === "linking") && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-tide-teal">
            Ready to link <strong>{phase.ref.owner}/{phase.ref.repo}</strong>.
          </p>
          <button
            type="button"
            disabled={phase.kind === "linking"}
            onClick={() => handleLink(phase.ref)}
            className="self-start rounded bg-tide-teal px-4 py-2 text-white disabled:opacity-60"
          >
            {phase.kind === "linking" ? "Opening PR…" : "Link — open PR"}
          </button>
        </div>
      )}
      {phase.kind === "linked" && (
        <p className="text-sm text-tide-teal">
          Linking PR opened for{" "}
          <strong>{phase.ref.owner}/{phase.ref.repo}</strong>.{" "}
          <a
            href={phase.url}
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            View the pull request
          </a>
          .
        </p>
      )}
      {phase.kind === "error" && (
        <p role="alert" className="text-sm text-coral">
          {phase.message}
        </p>
      )}
    </form>
  );
}
