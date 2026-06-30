import type { Viewer } from "../auth/identity.ts";
import type { RegistryRepo } from "../registry/registry.ts";
import { AgentRuns } from "../github/AgentRuns.tsx";
import { AttentionQueue } from "../github/AttentionQueue.tsx";
import { ReadyForAgentPool } from "../github/ReadyForAgentPool.tsx";
import { RegistryIssues } from "../github/RegistryIssues.tsx";
import { LinkForm } from "../link/LinkForm.tsx";

/**
 * The Shoreline home (ADR-0009): the cross-repo overview. It carries the lenses
 * that span every Managed repo — the Attention queue (#8), the ready-for-agent
 * pool (#9), the grouped open-issue list (#5), and per-repo Agent runs (#10) —
 * plus the Link flow. The richer tide-line summary and repo grid are later
 * slices that layer onto this home; for now it composes the panes that exist.
 */
export function Shoreline({
  token,
  viewer,
  repos,
}: {
  token: string;
  viewer: Viewer;
  repos: RegistryRepo[];
}) {
  return (
    <section aria-label="Shoreline" className="mx-auto max-w-2xl">
      <header className="text-center">
        <h2 className="text-2xl font-semibold lowercase tracking-tight">
          the shore
        </h2>
        <p className="mt-2 text-deep-sea/80">
          Every Sandcastle-enabled repo, what needs you now, and what its agents
          are doing — in one calm pane.
        </p>
      </header>
      <div className="mt-10">
        <AttentionQueue token={token} repos={repos} />
      </div>
      <div className="mt-10">
        <ReadyForAgentPool token={token} repos={repos} />
      </div>
      <div className="mt-10">
        <RegistryIssues token={token} repos={repos} />
      </div>
      <div className="mt-10 flex flex-col gap-8">
        {repos.map((repo) => (
          <AgentRuns
            key={`${repo.owner}/${repo.repo}`}
            token={token}
            repo={repo}
          />
        ))}
      </div>
      <div className="mx-auto mt-10 max-w-sm">
        <LinkForm token={token} repos={repos} linkedBy={viewer.login} />
      </div>
    </section>
  );
}
