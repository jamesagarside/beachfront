import type { RepoRef } from "../config.ts";
import { buildAttentionQueue, type AttentionItem } from "./attentionQueue.ts";
import { formatAge } from "./IssueList.tsx";
import { useRegistryIssues } from "./useRegistryIssues.ts";

/**
 * The north-star view (#8): the cross-repo Attention queue. It surfaces, in the
 * same three buckets the `triage` skill uses, every issue across every Managed
 * repo that needs a human — untriaged, needs-triage, and needs-info with a
 * reporter reply — oldest first, with a count per bucket. Coral is the brand's
 * "needs a human" colour, so the bucket counts wear it here.
 */
const BUCKETS = [
  {
    key: "untriaged" as const,
    label: "Untriaged",
    hint: "no triage label yet",
  },
  {
    key: "needsTriage" as const,
    label: "Needs triage",
    hint: "labelled, awaiting a decision",
  },
  {
    key: "needsInfo" as const,
    label: "Needs info — reporter replied",
    hint: "the reporter has responded",
  },
];

export function AttentionQueue({
  token,
  repos,
}: {
  token: string | null;
  repos: RepoRef[];
}) {
  const { loaded, isPending } = useRegistryIssues(token, repos);
  const queue = buildAttentionQueue(loaded);
  const total =
    queue.untriaged.length + queue.needsTriage.length + queue.needsInfo.length;

  return (
    <section aria-labelledby="attention-heading" className="text-left">
      <h2
        id="attention-heading"
        className="flex items-baseline gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-driftwood"
      >
        <span>Attention queue</span>
        {total > 0 && (
          <span className="rounded-full bg-coral/15 px-2 py-0.5 text-xs font-semibold normal-case tracking-normal text-coral">
            {total}
          </span>
        )}
      </h2>

      {isPending && loaded.length === 0 && (
        <p className="mt-3 text-deep-sea/60">Scanning the shore…</p>
      )}

      {!isPending && loaded.length > 0 && total === 0 && (
        <p className="mt-3 text-deep-sea/60">
          Nothing needs a human right now — all calm.
        </p>
      )}

      {total > 0 && (
        <div className="mt-4 flex flex-col gap-5">
          {BUCKETS.map(({ key, label, hint }) => (
            <Bucket key={key} label={label} hint={hint} items={queue[key]} />
          ))}
        </div>
      )}
    </section>
  );
}

function Bucket({
  label,
  hint,
  items,
}: {
  label: string;
  hint: string;
  items: AttentionItem[];
}) {
  const headingId = `attention-${label.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <section role="region" aria-labelledby={headingId}>
      <h3
        id={headingId}
        className="flex items-baseline gap-2 text-sm text-deep-sea/80"
      >
        <span className="font-medium">{label}</span>
        <span
          className={`rounded-full px-2 text-xs ${
            items.length > 0
              ? "bg-coral/15 font-semibold text-coral"
              : "bg-deep-sea/5 text-driftwood"
          }`}
        >
          {items.length}
        </span>
        <span className="text-xs text-driftwood">{hint}</span>
      </h3>

      {items.length === 0 ? (
        <p className="mt-2 text-xs text-deep-sea/40">none</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1.5">
          {items.map((item) => (
            <AttentionRow
              key={`${item.repo.owner}/${item.repo.repo}#${item.issue.number}`}
              item={item}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function AttentionRow({ item }: { item: AttentionItem }) {
  const slug = `${item.repo.owner}/${item.repo.repo}`;

  return (
    <li className="rounded-md border-l-2 border-coral/70 bg-white/60 shadow-sm ring-1 ring-deep-sea/10 transition hover:bg-white/85">
      <a
        href={item.issue.url}
        target="_blank"
        rel="noreferrer"
        className="flex flex-wrap items-baseline gap-x-2 px-3 py-2 text-sm text-deep-sea hover:underline"
      >
        <span className="shrink-0 text-deep-sea/50">
          {slug} #{item.issue.number}
        </span>
        <span className="min-w-0 flex-1 font-medium">{item.issue.title}</span>
        <span className="shrink-0 text-xs font-normal text-driftwood">
          opened {formatAge(item.issue.createdAt)}
        </span>
      </a>
    </li>
  );
}
