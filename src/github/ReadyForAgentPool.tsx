import type { RepoRef } from "../config.ts";
import { formatAge } from "./IssueList.tsx";
import { buildReadyForAgentPool, type PoolItem } from "./readyForAgentPool.ts";
import { useRegistryIssues } from "./useRegistryIssues.ts";

/**
 * The ready-for-agent pool (#9): a single cross-repo list of every issue that's
 * fed and waiting for an agent, with repo + title and a total count, oldest
 * first. `ready-for-agent` is a handled state, so it wears tide teal — the
 * brand's "fed / in hand" colour — not coral.
 */
export function ReadyForAgentPool({
  token,
  repos,
}: {
  token: string | null;
  repos: RepoRef[];
}) {
  const { loaded, isPending } = useRegistryIssues(token, repos);
  const pool = buildReadyForAgentPool(loaded);

  return (
    <section aria-labelledby="ready-pool-heading" className="text-left">
      <h2
        id="ready-pool-heading"
        className="flex items-baseline gap-2 text-sm text-deep-sea/70"
      >
        <span>Ready for an agent</span>
        {pool.length > 0 && (
          <span className="rounded-full bg-tide-teal/10 px-2 text-xs text-tide-teal">
            {pool.length}
          </span>
        )}
      </h2>

      {isPending && loaded.length === 0 && (
        <p className="mt-3 text-deep-sea/60">Scanning the shore…</p>
      )}

      {!isPending && loaded.length > 0 && pool.length === 0 && (
        <p className="mt-3 text-deep-sea/60">
          No agent-ready work right now — nothing waiting to be picked up.
        </p>
      )}

      {pool.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {pool.map((item) => (
            <PoolRow
              key={`${item.repo.owner}/${item.repo.repo}#${item.issue.number}`}
              item={item}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function PoolRow({ item }: { item: PoolItem }) {
  const slug = `${item.repo.owner}/${item.repo.repo}`;

  return (
    <li className="rounded border border-deep-sea/15 bg-white/50 px-3 py-2">
      <a
        href={item.issue.url}
        target="_blank"
        rel="noreferrer"
        className="text-deep-sea hover:underline"
      >
        <span className="text-deep-sea/50">
          {slug} #{item.issue.number}
        </span>{" "}
        {item.issue.title}
      </a>
      <span className="ml-2 text-xs text-driftwood">
        opened {formatAge(item.issue.createdAt)}
      </span>
    </li>
  );
}
