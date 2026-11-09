// src/app/loading.tsx
//
// A thin progress bar instead of a full-screen loader: navigations feel instant and the page
// layout doesn't jump. Uses the accent colour, so it follows the cyan / amber / emerald theme.
export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="fixed left-0 right-0 top-0 z-[100]">
      <div className="h-0.5 w-full overflow-hidden bg-zinc-900">
        <div className="h-full w-1/3 animate-pulse bg-accent-strong" />
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
