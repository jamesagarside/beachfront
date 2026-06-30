import type { RegistryRepo } from "../registry/registry.ts";
import { SHORELINE_HASH } from "../routing/route.ts";

/**
 * The per-repo view (ADR-0009). A deep-link resolves against the bundled
 * Registry: a Managed repo renders its mission-control deck (a placeholder here
 * — the Kanban board, agent overlay, and metrics are later slices). An
 * unrecognised owner/repo is an honest state with a way back to the Shoreline,
 * never a blank pane.
 */
export function RepoView({
  owner,
  repo,
  repos,
}: {
  owner: string;
  repo: string;
  repos: RegistryRepo[];
}) {
  const managed = repos.find((r) => r.owner === owner && r.repo === repo);

  if (!managed) {
    return (
      <section aria-label="Unknown repo" className="mx-auto max-w-xl text-center">
        <h2 className="text-2xl font-semibold lowercase tracking-tight">
          off the map
        </h2>
        <p className="mt-2 text-deep-sea/80">
          <span className="font-mono">
            {owner}/{repo}
          </span>{" "}
          isn’t a Managed repo on this shore.
        </p>
        <a
          href={SHORELINE_HASH}
          className="mt-6 inline-block text-tide-teal underline"
        >
          Back to the shore
        </a>
      </section>
    );
  }

  return (
    <section
      aria-label={`${managed.owner}/${managed.repo}`}
      className="mx-auto max-w-2xl"
    >
      <header>
        <h2 className="text-2xl font-semibold tracking-tight">
          {managed.owner}/{managed.repo}
        </h2>
        <p className="mt-2 text-deep-sea/80">
          The mission deck for this repo — its agent runs, issue board, and
          metrics — lands in later slices.
        </p>
      </header>
    </section>
  );
}
