/**
 * Walking-skeleton shell. The real panes (Attention queue, ready-for-agent pool,
 * Agent runs) arrive in later slices; for now this proves build → deploy → serve.
 */
export function App() {
  return (
    <main className="min-h-screen bg-sand text-deep-sea font-sans flex items-center justify-center p-8">
      <div className="max-w-xl text-center">
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
      </div>
    </main>
  );
}
