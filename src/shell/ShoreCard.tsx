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
 */
export function ShoreCard({ health }: { health: RepoHealth }) {
  const { repo, openIssues, attention, running } = health;

  return (
    <a
      href={repoHash(repo)}
      className="block rounded border border-deep-sea/15 bg-white/50 px-4 py-3 transition-colors hover:border-deep-sea/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tide-teal"
    >
      <span className="block text-deep-sea">
        <span className="text-deep-sea/50">{repo.owner}/</span>
        <span className="font-medium">{repo.repo}</span>
      </span>

      <span className="mt-2 flex flex-wrap items-baseline gap-x-2 text-xs">
        <span className="text-deep-sea/70">
          {openIssues} open
        </span>

        {attention > 0 && (
          <>
            <span aria-hidden="true" className="text-driftwood">
              ·
            </span>
            <span className="text-coral">{attention} need you</span>
          </>
        )}

        <span aria-hidden="true" className="text-driftwood">
          ·
        </span>
        <span className={running > 0 ? "text-tide-teal" : "text-driftwood"}>
          {running} {running === 1 ? "agent" : "agents"} running
        </span>
      </span>
    </a>
  );
}
