import { AuthPanel } from "./auth/AuthPanel.tsx";
import { useAuthContext } from "./auth/AuthContext.tsx";
import { demoRepos } from "./demo/demo.ts";
import { LinkForm } from "./link/LinkForm.tsx";
import { loadRegistry } from "./registry/registry.ts";
import { RepoDeck } from "./repo/RepoDeck.tsx";
import { useRoute } from "./routing/useRoute.ts";
import { Shell } from "./shell/Shell.tsx";
import { ShorelineHome } from "./shell/ShorelineHome.tsx";

/**
 * The app root. It is always the pane of glass: the persistent sidebar shell
 * (#63) wrapping a routed view — the Shoreline overview (#64) or one repo's
 * mission deck (ADR-0009). The only gate is the data behind it (ADR-0001):
 *
 * - **Signed in** → the Instance's Registry, read live as the Viewer's token.
 * - **No token** → *demo mode* (#27): the baked public snapshot, with a "demo
 *   data" indicator and the sign-in panel pinned in the sidebar. Pasting a token
 *   switches to live fetch.
 * - **A token mid-check (or rejected)** → the calm landing carries the sign-in
 *   state until identity resolves.
 *
 * A repo deep-link that resolves against the active repo set opens its deck;
 * anything unresolved falls back to the Shoreline, never a blank pane.
 */
const registry = loadRegistry();

export function App() {
  const { token, viewer, status } = useAuthContext();
  const route = useRoute();

  const authed = status === "authenticated" && Boolean(token) && Boolean(viewer);

  // A token is present but identity hasn't confirmed yet (checking) or was
  // rejected (error): hold on the landing so the sign-in state is front and
  // centre rather than flashing demo data.
  if (!authed && token) return <Landing />;

  const demo = !authed;
  const repos = demo ? demoRepos() : registry;
  const viewToken = demo ? null : token;

  const repoForRoute =
    route.kind === "repo"
      ? repos.find((r) => r.owner === route.owner && r.repo === route.repo) ??
        null
      : null;

  return (
    <Shell route={route} repos={repos} demo={demo} aside={<AuthPanel />}>
      {repoForRoute ? (
        <RepoDeck token={viewToken} repo={repoForRoute} />
      ) : (
        <ShorelineHome token={viewToken} repos={repos} />
      )}
      {!demo && token && viewer && (
        <div className="mt-12 max-w-sm border-t border-deep-sea/10 pt-8">
          <LinkForm token={token} repos={registry} linkedBy={viewer.login} />
        </div>
      )}
    </Shell>
  );
}

/** The token-in-flight landing — calm, centered, the horizon motif and sign-in. */
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
