import { AuthPanel } from "./auth/AuthPanel.tsx";
import { useAuthContext } from "./auth/AuthContext.tsx";
import { LinkForm } from "./link/LinkForm.tsx";
import { loadRegistry } from "./registry/registry.ts";
import { RepoDeck } from "./repo/RepoDeck.tsx";
import { useRoute } from "./routing/useRoute.ts";
import { Shell } from "./shell/Shell.tsx";
import { ShorelineHome } from "./shell/ShorelineHome.tsx";

/**
 * The app root. Until the Viewer is authenticated it's a calm landing — the
 * wordmark, the promise, and the sign-in path (ADR-0001). Once a token is in
 * hand it becomes the pane of glass: the persistent sidebar shell (#63) wrapping
 * a routed view — the Shoreline overview (#64) or one repo's mission deck
 * (ADR-0009). A repo deep-link that resolves against the Registry opens its
 * deck; anything unresolved falls back to the Shoreline, never a blank pane.
 */
const registry = loadRegistry();

export function App() {
  const { token, viewer, status } = useAuthContext();
  const route = useRoute();

  if (status !== "authenticated" || !token || !viewer) {
    return <Landing />;
  }

  const repoForRoute =
    route.kind === "repo"
      ? registry.find(
          (r) => r.owner === route.owner && r.repo === route.repo,
        ) ?? null
      : null;

  return (
    <Shell route={route} repos={registry}>
      {repoForRoute ? (
        <RepoDeck token={token} repo={repoForRoute} />
      ) : (
        <ShorelineHome token={token} repos={registry} />
      )}
      <div className="mt-12 max-w-sm border-t border-deep-sea/10 pt-8">
        <LinkForm token={token} repos={registry} linkedBy={viewer.login} />
      </div>
    </Shell>
  );
}

/** The pre-auth landing — calm, centered, the horizon motif and the sign-in. */
function Landing() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-sand p-8 font-sans text-deep-sea">
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
