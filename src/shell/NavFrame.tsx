import type { ReactNode } from "react";
import type { Viewer } from "../auth/identity.ts";
import type { RegistryRepo } from "../registry/registry.ts";
import type { Route } from "../routing/route.ts";
import { repoHash, SHORELINE_HASH } from "../routing/route.ts";

function isActiveRepo(route: Route, repo: RegistryRepo): boolean {
  return (
    route.name === "repo" &&
    route.owner === repo.owner &&
    route.repo === repo.repo
  );
}

/**
 * The persistent glass frame (ADR-0009): a lean sidebar that wraps every view.
 * It holds the Shoreline (home) and the list of Managed repos the Viewer can
 * reach — and nothing else; the cross-repo lenses live on the Shoreline, not as
 * their own entries. The routed view renders as `children` in the main pane, so
 * the frame stays put as the Viewer moves between the shore and a repo.
 */
export function NavFrame({
  repos,
  route,
  viewer,
  onSignOut,
  children,
}: {
  repos: RegistryRepo[];
  route: Route;
  viewer: Viewer;
  onSignOut?: () => void;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-sand text-deep-sea font-sans">
      <aside
        aria-label="Navigation"
        className="w-64 shrink-0 border-r border-deep-sea/15 p-6"
      >
        <a
          href={SHORELINE_HASH}
          aria-current={route.name === "shoreline" ? "page" : undefined}
          className="block text-2xl font-semibold lowercase tracking-tight"
        >
          beachfront
        </a>
        <div aria-hidden="true" className="my-4 h-px w-full bg-deep-sea/20" />
        <nav aria-label="Shoreline">
          <a
            href={SHORELINE_HASH}
            aria-current={route.name === "shoreline" ? "page" : undefined}
            className="block rounded px-2 py-1 hover:bg-deep-sea/10 aria-[current=page]:font-semibold"
          >
            Shoreline
          </a>
        </nav>
        <nav aria-label="Managed repos" className="mt-4">
          <p className="px-2 text-xs uppercase tracking-wide text-driftwood">
            Repos
          </p>
          {repos.length === 0 ? (
            <p className="mt-1 px-2 text-sm text-deep-sea/70">
              No repos linked yet.
            </p>
          ) : (
            <ul className="mt-1">
              {repos.map((repo) => (
                <li key={`${repo.owner}/${repo.repo}`}>
                  <a
                    href={repoHash(repo.owner, repo.repo)}
                    aria-current={isActiveRepo(route, repo) ? "page" : undefined}
                    className="block truncate rounded px-2 py-1 text-sm hover:bg-deep-sea/10 aria-[current=page]:font-semibold"
                  >
                    {repo.owner}/{repo.repo}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </nav>
        <div className="mt-8 text-sm text-deep-sea/70">
          <span>@{viewer.login}</span>
          {onSignOut && (
            <button
              type="button"
              onClick={onSignOut}
              className="mt-1 block text-tide-teal underline"
            >
              Sign out
            </button>
          )}
        </div>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
