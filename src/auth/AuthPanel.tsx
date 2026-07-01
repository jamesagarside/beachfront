import { useState } from "react";
import { GENERATE_TOKEN_URL } from "./token.ts";
import { useAuthContext } from "./AuthContext.tsx";

/**
 * The Viewer's sign-in surface. PAT mode is always available (ADR-0001): paste
 * a read-only fine-grained token, confirm identity, persist it. OAuth login is
 * a later, opt-in slice.
 */
export function AuthPanel() {
  const { viewer, status, error, signIn, signOut } = useAuthContext();
  const [draft, setDraft] = useState("");

  if (status === "authenticated" && viewer) {
    return (
      <div className="flex items-center gap-3">
        <img
          src={viewer.avatarUrl}
          alt=""
          aria-hidden="true"
          className="h-8 w-8 rounded-full ring-1 ring-deep-sea/20"
        />
        <span className="text-deep-sea">
          Signed in as <strong>{viewer.login}</strong>
        </span>
        <button
          type="button"
          onClick={signOut}
          className="text-sm text-deep-sea/70 underline underline-offset-2 hover:text-deep-sea"
        >
          Sign out
        </button>
      </div>
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) return;
    signIn(trimmed);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label htmlFor="token" className="text-deep-sea">
        Paste a GitHub token to see your repos.
      </label>
      <input
        id="token"
        type="password"
        autoComplete="off"
        spellCheck={false}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="github_pat_…"
        className="rounded-md bg-white/70 px-3 py-2 text-deep-sea shadow-sm ring-1 ring-deep-sea/20 outline-none placeholder:text-deep-sea/35 focus:ring-2 focus:ring-tide-teal"
      />
      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={status === "checking"}
          className="rounded-md bg-tide-teal px-4 py-2 font-medium text-white shadow-sm transition hover:bg-tide-teal/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tide-teal focus-visible:ring-offset-2 disabled:opacity-60"
        >
          {status === "checking" ? "Checking…" : "Sign in"}
        </button>
        <a
          href={GENERATE_TOKEN_URL}
          target="_blank"
          rel="noreferrer"
          className="text-sm text-deep-sea/70 underline underline-offset-2 hover:text-deep-sea"
        >
          Generate a token
        </a>
      </div>
      {status === "error" && error && (
        <p role="alert" className="text-sm text-coral">
          {error}
        </p>
      )}
    </form>
  );
}
