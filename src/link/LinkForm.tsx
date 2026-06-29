import { useState } from "react";
import type { RepoRef } from "../config.ts";
import type { RegistryRepo } from "../registry/registry.ts";
import { validateLink } from "./validateLink.ts";

/**
 * Capture-and-validate step of the UI Link flow (#14, ADR-0002): the Viewer
 * types an `owner/repo`, and Beachfront confirms — using the Viewer's own token
 * — that it's well-formed, not already linked, and actually accessible before
 * the PR-opening step (#15) takes over. A validated repo surfaces a "ready to
 * link" state that the next slice hangs the open-PR action off; for now it just
 * proves the candidate is sound.
 */
type Phase =
  | { kind: "idle" }
  | { kind: "validating" }
  | { kind: "valid"; ref: RepoRef }
  | { kind: "error"; message: string };

export function LinkForm({
  token,
  repos,
}: {
  token: string;
  repos: RegistryRepo[];
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
          if (phase.kind !== "idle" && phase.kind !== "validating") {
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
      {phase.kind === "valid" && (
        <p className="text-sm text-tide-teal">
          Ready to link <strong>{phase.ref.owner}/{phase.ref.repo}</strong>.
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
