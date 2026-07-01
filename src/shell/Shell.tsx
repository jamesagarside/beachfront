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
  demo = false,
  aside,
}: {
  route: Route;
  repos: RepoRef[];
  children: ReactNode;
  /** True in demo mode — surfaces a calm "demo data" indicator (#27). */
  demo?: boolean;
  /** The auth surface, pinned to the foot of the sidebar (sign in / out). */
  aside?: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-sand font-sans text-deep-sea md:flex-row">
      <Sidebar route={route} repos={repos} demo={demo} aside={aside} />
      <main className="min-w-0 flex-1 overflow-x-hidden px-5 py-8 sm:px-10 md:py-12">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}

function Sidebar({
  route,
  repos,
  demo,
  aside,
}: {
  route: Route;
  repos: RepoRef[];
  demo: boolean;
  aside?: ReactNode;
}) {
  return (
    <nav
      aria-label="Beachfront views"
      className="flex shrink-0 flex-col gap-6 border-b border-deep-sea/10 bg-white/40 px-5 py-6 md:sticky md:top-0 md:h-screen md:w-64 md:overflow-y-auto md:border-b-0 md:border-r md:py-8"
    >
      <div>
        <div className="flex items-center gap-2">
          <BrandMark />
          <h1 className="text-2xl font-semibold lowercase tracking-tight">
            beachfront
          </h1>
        </div>
        {demo && (
          <span className="mt-2 inline-block rounded-full bg-sky/50 px-2.5 py-0.5 text-xs font-medium text-deep-sea/80">
            demo data
          </span>
        )}
        {/* Horizon line — the recurring brand motif (sea/sky seam). */}
        <div
          aria-hidden="true"
          className="mt-4 h-px w-full bg-gradient-to-r from-deep-sea/30 to-transparent"
        />
      </div>

      <NavLink
        target={SHORELINE}
        route={route}
        label="Shoreline"
        hint="the whole shore"
      />

      <div className="flex flex-col gap-2">
        <h2 className="px-2.5 text-[11px] font-medium uppercase tracking-[0.12em] text-driftwood">
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

      {aside && (
        <div className="mt-auto border-t border-deep-sea/10 pt-6 text-sm">
          {aside}
        </div>
      )}
    </nav>
  );
}

/** The Beachfront mark (docs/brand.md): a pane framing a horizon, sun on the tide. */
function BrandMark() {
  return (
    <svg
      viewBox="0 0 32 32"
      width="24"
      height="24"
      aria-hidden="true"
      className="shrink-0"
    >
      <rect
        x="1.5"
        y="1.5"
        width="29"
        height="29"
        rx="5"
        fill="#e9dcc3"
        stroke="#0b4f6c"
        strokeWidth="1.5"
      />
      <circle cx="16" cy="19" r="5" fill="#ff8c61" />
      <line x1="4" y1="19" x2="28" y2="19" stroke="#0b4f6c" strokeWidth="1.5" />
    </svg>
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
      className={`block rounded-md border-l-2 px-2.5 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tide-teal ${
        active
          ? "border-tide-teal bg-tide-teal/10 font-medium text-tide-teal"
          : "border-transparent text-deep-sea/80 hover:bg-deep-sea/5 hover:text-deep-sea"
      }`}
    >
      {label}
      {hint && <span className="block text-xs text-driftwood">{hint}</span>}
    </a>
  );
}
