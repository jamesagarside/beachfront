import type { ReactNode } from "react";
import type { RepoRef } from "../config.ts";
import { hashFor, sameRoute, SHORELINE, type Route } from "../routing/route.ts";

/**
 * The persistent glass frame (#63, ADR-0009): a lean sidebar — the Shoreline
 * (home) and the list of Managed repos the Viewer can reach, and nothing else —
 * wrapping a routed content pane. The cross-repo lenses (Attention queue,
 * ready-for-agent pool) deliberately live *on* the Shoreline, not as their own
 * sidebar entries, so the frame stays calm and matches how the owner navigates.
 *
 * Nav items are plain `#/…` anchors: clicking sets the hash, the browser fires
 * `hashchange`, and {@link useRoute} re-renders the content — so back/forward and
 * deep-links work for free, with no router dependency.
 */
export function Shell({
  route,
  repos,
  children,
}: {
  route: Route;
  repos: RepoRef[];
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-sand font-sans text-deep-sea">
      <Sidebar route={route} repos={repos} />
      <main className="flex-1 overflow-x-hidden px-6 py-8 sm:px-10">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}

function Sidebar({ route, repos }: { route: Route; repos: RepoRef[] }) {
  return (
    <nav
      aria-label="Beachfront views"
      className="flex w-60 shrink-0 flex-col gap-6 border-r border-deep-sea/10 bg-white/30 px-5 py-8"
    >
      <div>
        <h1 className="text-2xl font-semibold lowercase tracking-tight">
          beachfront
        </h1>
        {/* Horizon line — the recurring brand motif (sea/sky seam). */}
        <div aria-hidden="true" className="mt-4 h-px w-full bg-deep-sea/20" />
      </div>

      <NavLink
        target={SHORELINE}
        route={route}
        label="Shoreline"
        hint="the whole shore"
      />

      <div className="flex flex-col gap-2">
        <h2 className="px-2 text-xs uppercase tracking-wide text-driftwood">
          Managed repos
        </h2>
        {repos.length === 0 ? (
          <p className="px-2 text-sm text-deep-sea/50">None linked yet.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {repos.map((repo) => (
              <li key={`${repo.owner}/${repo.repo}`}>
                <NavLink
                  target={{ kind: "repo", owner: repo.owner, repo: repo.repo }}
                  route={route}
                  label={repo.repo}
                  hint={repo.owner}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </nav>
  );
}

function NavLink({
  target,
  route,
  label,
  hint,
}: {
  target: Route;
  route: Route;
  label: string;
  hint?: string;
}) {
  const active = sameRoute(route, target);
  return (
    <a
      href={hashFor(target)}
      aria-current={active ? "page" : undefined}
      className={`block rounded px-2 py-1.5 text-sm transition-colors ${
        active
          ? "bg-tide-teal/10 font-medium text-tide-teal"
          : "text-deep-sea/80 hover:bg-deep-sea/5"
      }`}
    >
      {label}
      {hint && <span className="block text-xs text-driftwood">{hint}</span>}
    </a>
  );
}
