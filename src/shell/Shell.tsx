import type { Viewer } from "../auth/identity.ts";
import type { RegistryRepo } from "../registry/registry.ts";
import { useRoute } from "../routing/useRoute.ts";
import { NavFrame } from "./NavFrame.tsx";
import { RepoView } from "./RepoView.tsx";
import { Shoreline } from "./Shoreline.tsx";

/**
 * The navigation shell: the persistent glass frame around the routed view. It
 * reads the current hash route and renders the Shoreline home or a per-repo
 * view inside the frame, so the sidebar stays put as the Viewer navigates
 * (ADR-0009). Mounted only once the Viewer is authenticated (ADR-0001).
 */
export function Shell({
  token,
  viewer,
  repos,
  onSignOut,
}: {
  token: string;
  viewer: Viewer;
  repos: RegistryRepo[];
  onSignOut?: () => void;
}) {
  const route = useRoute();

  return (
    <NavFrame
      repos={repos}
      route={route}
      viewer={viewer}
      onSignOut={onSignOut}
    >
      {route.name === "repo" ? (
        <RepoView owner={route.owner} repo={route.repo} repos={repos} />
      ) : (
        <Shoreline token={token} viewer={viewer} repos={repos} />
      )}
    </NavFrame>
  );
}
