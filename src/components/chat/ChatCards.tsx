// src/components/chat/ChatCards.tsx
//
// Tappable cards under a bot reply (e.g. portfolio projects). Horizontal snap-scroll strip; tapping a
// card sends its `send` text as if the visitor typed it. Images fall back to a gradient tile.
'use client';

import { memo, useState } from 'react';
import type { ChatCard } from '@/utils/chatEngine/types';

function Card({ c, onPick }: { c: ChatCard; onPick: (t: string) => void }) {
  const [broken, setBroken] = useState(false);
  return (
    <button
      type="button"
      onClick={() => onPick(c.send)}
      className="group/card w-44 shrink-0 cursor-pointer snap-start overflow-hidden rounded-xl border border-white/[0.08] bg-zinc-900/80 text-left transition duration-200 hover:-translate-y-0.5 hover:border-accent/50 focus-visible:outline-2 focus-visible:outline-accent active:scale-[0.98]"
    >
      <div className="relative h-24 w-full overflow-hidden bg-gradient-to-br from-accent/20 via-zinc-800 to-zinc-900">
        {c.image && !broken && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={c.image}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setBroken(true)}
            className="h-full w-full object-cover transition duration-500 group-hover/card:scale-105"
          />
        )}
        {c.badge && (
          <span className="absolute left-1.5 top-1.5 rounded-md bg-zinc-950/80 px-1.5 py-0.5 font-mono text-[10px] text-accent backdrop-blur">
            {c.badge}
          </span>
        )}
      </div>
      <div className="px-2.5 py-2">
        <p className="line-clamp-1 font-sans text-xs font-semibold text-zinc-100">{c.title}</p>
        {c.subtitle && <p className="mt-0.5 line-clamp-2 font-sans text-[11px] leading-snug text-zinc-500">{c.subtitle}</p>}
        <p className="mt-1.5 font-mono text-[10px] text-accent">Open →</p>
      </div>
    </button>
  );
}

function ChatCards({ cards, onPick }: { cards: ChatCard[]; onPick: (t: string) => void }) {
  if (!cards.length) return null;
  return (
    <div
      role="list"
      aria-label="Related items"
      className="animate-msg-in -mx-1 mt-2 flex max-w-full snap-x gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {cards.map((c) => (
        <div role="listitem" key={c.id} className="contents">
          <Card c={c} onPick={onPick} />
        </div>
      ))}
    </div>
  );
}

export default memo(ChatCards);
