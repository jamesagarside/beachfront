import { AuthPanel } from "./auth/AuthPanel.tsx";
import { useAuthContext } from "./auth/AuthContext.tsx";
import { loadRegistry } from "./registry/registry.ts";
import { Shell } from "./shell/Shell.tsx";

/**
 * The app root. Until the Viewer is authenticated (ADR-0001) it shows the auth
 * path — the wordmark and the token panel. Once authenticated it mounts the
 * navigation shell (ADR-0009): a persistent glass frame around the Shoreline
 * home and the per-repo views, routed by hash.
 */
const registry = loadRegistry();

export function App() {
  const { token, viewer, status, signOut } = useAuthContext();

  if (status === "authenticated" && token && viewer) {
    return (
      <Shell
        token={token}
        viewer={viewer}
        repos={registry}
        onSignOut={signOut}
      />
    );
  }

  return (
    <main className="min-h-screen bg-sand text-deep-sea font-sans flex items-center justify-center p-8">
      <div className="w-full max-w-xl text-center">
        <h1 className="text-5xl font-semibold lowercase tracking-tight">
          beachfront
        </h1>
        {/* Horizon line — the recurring brand motif (sea/sky seam). */}
        <div aria-hidden="true" className="mx-auto my-6 h-px w-40 bg-deep-sea/40" />
        <p className="text-lg text-deep-sea/80">
          The lookout over the whole shore — every Sandcastle-enabled repo, its
          attention queue, and its running agents, in one calm pane.
        </p>
        <div className="mx-auto mt-10 max-w-sm text-left">
          <AuthPanel />
        </div>
      </div>
    </main>
  );
}
