// src/components/site/StatusTicker.tsx — the diagnostic strip at the top of the home page.
// The old strip was one row that simply ran off the screen on phones (the text was cut in half). Now:
//  · the live status badge is pinned on the left, always fully visible
//  · everything else scrolls past as a smooth ticker on phones (pauses while touched), and sits still from tablet width up
//  · visitors who prefer reduced motion get a plain, swipeable row instead of movement
'use client';

import { StatusBadge, StatusSummary } from '@/components/site/LiveStatus';
import { NodeInline } from '@/components/site/VisitorNode';
import type { NetState } from '@/lib/useNetStatus';

export default function StatusTicker({ state, client }: { state: NetState; client: string }) {
  const items = (hidden: boolean) => (
    <div aria-hidden={hidden || undefined} className={`flex shrink-0 items-center gap-6 pr-6 ${hidden ? 'md:hidden' : ''}`}>
      <NodeInline />
      <span className="text-accent">CLIENT: [{client}]</span>
      <span className="md:hidden"><StatusSummary state={state} /></span>
    </div>
  );
  return (
    <div className="border-b border-zinc-800/80 bg-zinc-900/60 font-mono text-[11px] text-zinc-400">
      <div className="mx-auto flex h-9 max-w-7xl items-center">
        <div className="relative z-10 flex h-full shrink-0 items-center border-r border-zinc-800/80 bg-zinc-900 pl-4 pr-3 sm:pl-8 sm:pr-4">
          <StatusBadge state={state} />
        </div>
        <div className="cy-ticker-mask relative h-full min-w-0 flex-1 overflow-hidden">
          <div className="cy-ticker flex h-full w-max items-center whitespace-nowrap md:w-auto md:pl-6">
            {items(false)}
            {items(true)}
          </div>
        </div>
        <div className="hidden shrink-0 pl-4 pr-8 md:block"><StatusSummary state={state} /></div>
      </div>
    </div>
  );
}
