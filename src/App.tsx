import { AuthPanel } from "./auth/AuthPanel.tsx";
import { useAuthContext } from "./auth/AuthContext.tsx";
import { AgentRuns } from "./github/AgentRuns.tsx";
import { AttentionQueue } from "./github/AttentionQueue.tsx";
import { ReadyForAgentPool } from "./github/ReadyForAgentPool.tsx";
import { RegistryIssues } from "./github/RegistryIssues.tsx";
import { LinkForm } from "./link/LinkForm.tsx";
import { loadRegistry } from "./registry/registry.ts";

/**
 * Walking-skeleton shell. It composes the cross-repo panes — the Attention
 * queue (#8), the ready-for-agent pool (#9), per-repo Agent runs (#10), and the
 * grouped open-issue list (#5) — over every Registry repo, gated on the Viewer's
 * identity (ADR-0001).
 */
const registry = loadRegistry();

export function App() {
  const { token, viewer, status } = useAuthContext();

  return (
    <main className="min-h-screen bg-sand text-deep-sea font-sans flex items-center justify-center p-8">
      <div className="w-full max-w-xl text-center">
        <h1 className="text-5xl font-semibold lowercase tracking-tight">
          beachfront
        </h1>
        {/* Horizon line — the recurring brand motif (sea/sky seam). */}
        <div
          aria-hidden="true"
          className="mx-auto my-6 h-px w-40 bg-deep-sea/40"
        />
        <p className="text-lg text-deep-sea/80">
          The lookout over the whole shore — every Sandcastle-enabled repo, its
          attention queue, and its running agents, in one calm pane.
        </p>
        <div className="mx-auto mt-10 max-w-sm text-left">
          <AuthPanel />
        </div>
        {status === "authenticated" && token && viewer && (
          <>
            <div className="mx-auto mt-10 max-w-md">
              <AttentionQueue token={token} repos={registry} />
            </div>
            <div className="mx-auto mt-10 max-w-md">
              <ReadyForAgentPool token={token} repos={registry} />
            </div>
            <div className="mx-auto mt-10 max-w-md">
              <RegistryIssues token={token} repos={registry} />
            </div>
            <div className="mx-auto mt-10 flex max-w-md flex-col gap-8">
              {registry.map((repo) => (
                <AgentRuns
                  key={`${repo.owner}/${repo.repo}`}
                  token={token}
                  repo={repo}
                />
              ))}
            </div>
            <div className="mx-auto mt-10 max-w-sm">
              <LinkForm token={token} repos={registry} linkedBy={viewer.login} />
            </div>
          </>
        )}
      </div>
    </main>
  );
}
