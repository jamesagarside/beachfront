import { repoHash } from "../routing/route.ts";
import type { RepoHealth } from "./shoreSummary.ts";

/**
 * One Managed repo's at-a-glance health on the Shoreline home grid (ADR-0009,
 * #64). The whole card is a single internal hash link into that repo's mission
 * deck — one focusable target, no nested controls — so a Viewer can scan the
 * shore and step into any castle with one click or one Tab+Enter.
 *
 * The three signals carry the brand's semantic colour, not decoration: open
 * issues read in neutral deep-sea; "needs you" wears coral and appears ONLY when
 * something actually needs a human, since coral's scarcity is what makes
 * attention scannable across the shore; running agents wear tide-teal when in
 * flight and fade to driftwood when idle. A fully calm repo (nothing needing a
 * human, no agents running) reads quiet driftwood — never loud.
 *
 * A fourth, quieter signal (#115): a harness-drift note. It appears ONLY when a
 * repo is behind the current loop harness (coral, carrying the exact
 * `beachfront-update.sh` fix as its hover/tooltip text) or when its vintage is
 * unknown (driftwood — an older onboard with no version stamp). A current repo
 * says nothing, keeping the card calm.
 */
export function ShoreCard({ health }: { health: RepoHealth }) {
  const { repo, openIssues, attention, running, harness } = health;

  // The card's top seam is its horizon line; it warms to coral only when the
  // repo needs a human, so a scan of the shore reads by colour alone.
  const seam =
    attention > 0
      ? "border-t-coral"
      : running > 0
        ? "border-t-tide-teal"
        : "border-t-deep-sea/15";

  return (
    <a
      href={repoHash(repo)}
      className={`block rounded-lg border-t-2 ${seam} bg-white/60 px-4 py-3.5 shadow-sm ring-1 ring-deep-sea/10 transition hover:bg-white/80 hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tide-teal`}
    >
      <span className="block truncate text-deep-sea">
        <span className="text-sm text-deep-sea/50">{repo.owner}/</span>
        <span className="font-semibold">{repo.repo}</span>
      </span>

      <span className="mt-2.5 flex flex-wrap items-baseline gap-x-2 text-xs">
        <span className="text-deep-sea/70">
          {openIssues} open
        </span>

        {attention > 0 && (
          <>
            <span aria-hidden="true" className="text-driftwood">
              ·
            </span>
            <span className="font-medium text-coral">{attention} need you</span>
          </>
        )}

        <span aria-hidden="true" className="text-driftwood">
          ·
        </span>
        <span className={running > 0 ? "font-medium text-tide-teal" : "text-driftwood"}>
          {running} {running === 1 ? "agent" : "agents"} running
        </span>
      </span>

      {/* Harness drift — silent when current; coral behind, driftwood unknown. */}
      {harness.state === "behind" && (
        <span
          title={`Update with: ${harness.fix}`}
          className="mt-1.5 block text-xs font-medium text-coral"
        >
          harness behind
        </span>
      )}
      {harness.state === "unknown" && (
        <span className="mt-1.5 block text-xs text-driftwood">
          harness vintage unknown
        </span>
      )}
    </a>
  );
}
