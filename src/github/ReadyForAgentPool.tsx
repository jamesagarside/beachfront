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
        className="flex items-baseline gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-driftwood"
      >
        <span>Ready for an agent</span>
        {pool.length > 0 && (
          <span className="rounded-full bg-tide-teal/10 px-2 py-0.5 text-xs font-semibold normal-case tracking-normal text-tide-teal">
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
        <ul className="mt-4 flex max-h-[26rem] flex-col gap-1.5 overflow-y-auto pr-1">
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
    <li className="rounded-md bg-white/60 shadow-sm ring-1 ring-deep-sea/10 transition hover:bg-white/85">
      <a
        href={item.issue.url}
        target="_blank"
        rel="noreferrer"
        className="flex flex-wrap items-baseline gap-x-2 px-3 py-2 text-sm text-deep-sea hover:underline"
      >
        <span className="shrink-0 text-deep-sea/50">
          {slug} #{item.issue.number}
        </span>
        <span className="min-w-0 flex-1">{item.issue.title}</span>
        <span className="shrink-0 text-xs text-driftwood">
          opened {formatAge(item.issue.createdAt)}
        </span>
      </a>
    </li>
  );
}
