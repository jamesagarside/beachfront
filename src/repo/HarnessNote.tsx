import type { HarnessDrift } from "../core/harnessDrift.ts";

/**
 * The per-repo harness-drift indicator on the mission deck (#115). A repo whose
 * loop harness is `current` says nothing — the calm default. A `behind` repo
 * wears coral and spells out the exact fix a Viewer runs
 * (`scripts/beachfront-update.sh owner/repo`), shown as a copyable code line so
 * the hint is actionable, not just a warning. An `unknown` repo (an older
 * onboard with no `.sandcastle/.beachfront-version` stamp) reads quiet
 * driftwood, never pushing a fix it isn't sure is needed.
 */
export function HarnessNote({ drift }: { drift: HarnessDrift }) {
  if (drift.state === "current") return null;

  if (drift.state === "behind") {
    return (
      <p className="text-sm text-coral">
        <span className="font-medium">Harness behind.</span> Update with{" "}
        <code className="rounded bg-coral/10 px-1.5 py-0.5 font-mono text-xs text-coral">
          {drift.fix}
        </code>
      </p>
    );
  }

  return (
    <p className="text-sm text-driftwood">
      Harness vintage unknown — this repo carries no version stamp.
    </p>
  );
}
