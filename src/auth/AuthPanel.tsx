import { useState } from "react";
import { GENERATE_TOKEN_URL } from "./token.ts";
import { useAuthContext } from "./AuthContext.tsx";
import { useOAuthLogin } from "./useOAuthLogin.ts";

/**
 * The Viewer's sign-in surface. PAT mode is always available (ADR-0001): paste
 * a read-only fine-grained token, confirm identity, persist it. When an OAuth
 * Worker is configured (#25), a "Login with GitHub" button is also offered and
 * the resulting token is stored exactly as a PAT.
 */
export function AuthPanel() {
  const { viewer, status, error, signIn, signOut } = useAuthContext();
  const oauth = useOAuthLogin(signIn);
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
        className="rounded border border-deep-sea/30 bg-white/60 px-3 py-2 text-deep-sea outline-none focus:border-deep-sea"
      />
      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={status === "checking"}
          className="rounded bg-tide-teal px-4 py-2 text-white disabled:opacity-60"
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
      {oauth.enabled && (
        <>
          <div className="flex items-center gap-3 text-xs text-deep-sea/50">
            <span aria-hidden="true" className="h-px flex-1 bg-deep-sea/20" />
            or
            <span aria-hidden="true" className="h-px flex-1 bg-deep-sea/20" />
          </div>
          <button
            type="button"
            onClick={oauth.startLogin}
            disabled={oauth.status === "exchanging"}
            className="rounded border border-deep-sea/30 px-4 py-2 text-deep-sea hover:bg-white/60 disabled:opacity-60"
          >
            {oauth.status === "exchanging"
              ? "Completing sign-in…"
              : "Login with GitHub"}
          </button>
          {oauth.status === "error" && oauth.error && (
            <p role="alert" className="text-sm text-coral">
              {oauth.error}
            </p>
          )}
        </>
      )}
    </form>
  );
}
