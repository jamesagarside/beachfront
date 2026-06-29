import { AuthPanel } from "./auth/AuthPanel.tsx";
import { useAuthContext } from "./auth/AuthContext.tsx";
import { configuredRepo } from "./config.ts";
import { IssueList } from "./github/IssueList.tsx";

/**
 * Walking-skeleton shell. The full panes (Attention queue, ready-for-agent pool,
 * Agent runs) arrive in later slices; this slice adds the first aggregation —
 * one configured repo's open issues — gated on the Viewer's identity (ADR-0001).
 */
export function App() {
  const { token, status } = useAuthContext();

  return (
    <main className="min-h-screen bg-sand text-deep-sea font-sans flex items-center justify-center p-8">
      <div className="w-full max-w-xl text-center">
        <h1 className="text-5xl font-semibold lowercase tracking-tight">
          beachfront
        </h1>
        {/* Horizon line — the recurring brand motif (sea/sky seam). */}
        <div
          aria-hidden="true"
          className="mx-auto my-6 h-px w-40 bg-deep-sea/40"
        />
        <p className="text-lg text-deep-sea/80">
          The lookout over the whole shore — every Sandcastle-enabled repo, its
          attention queue, and its running agents, in one calm pane.
        </p>
        <div className="mx-auto mt-10 max-w-sm text-left">
          <AuthPanel />
        </div>
        {status === "authenticated" && (
          <div className="mx-auto mt-10 max-w-md">
            <IssueList token={token} repo={configuredRepo()} />
          </div>
        )}
      </div>
    </main>
  );
}
