import type { RepoRef } from "../config.ts";
import { IssueRow } from "./IssueList.tsx";
import { useRegistryIssues, type RepoIssues } from "./useRegistryIssues.ts";

/**
 * The cross-repo aggregation pane (#5): every Registry repo the Viewer's token
 * can read, its open issues grouped under a per-repo heading. Repos the token
 * can't read are skipped quietly — one inaccessible repo never blanks the rest
 * of the shore. Fetches run concurrently and are cached per repo
 * (see {@link useRegistryIssues}).
 */
export function RegistryIssues({
  token,
  repos,
}: {
  token: string | null;
  repos: RepoRef[];
}) {
  const { loaded, skipped, isPending } = useRegistryIssues(token, repos);

  return (
    <div className="flex flex-col gap-8">
      {isPending && loaded.length === 0 && (
        <p className="text-deep-sea/60">Reading the shoreline…</p>
      )}

      {loaded.map((entry) => (
        <RepoSection key={`${entry.repo.owner}/${entry.repo.repo}`} {...entry} />
      ))}

      {skipped.length > 0 && (
        <p className="text-xs text-driftwood">
          Skipped {skipped.length} repo{skipped.length === 1 ? "" : "s"} this
          token can't read.
        </p>
      )}
    </div>
  );
}

function RepoSection({ repo, issues }: RepoIssues) {
  const slug = `${repo.owner}/${repo.repo}`;
  const headingId = `repo-${repo.owner}-${repo.repo}`;

  return (
    <section role="region" aria-labelledby={headingId} className="text-left">
      <h2 id={headingId} className="text-sm text-deep-sea/70">
        <strong className="font-medium">{slug}</strong>
      </h2>

      {issues.length === 0 ? (
        <p className="mt-3 text-deep-sea/60">No open issues — all calm.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {issues.map((issue) => (
            <IssueRow key={issue.number} issue={issue} />
          ))}
        </ul>
      )}
    </section>
  );
}
