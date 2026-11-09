// src/components/chat/ChatLauncher.tsx
//
// The floating button that opens the chat: unread badge, a gentle pulse until the visitor has opened
// it once, and a single friendly nudge bubble per browser session (never while the chat is open,
// dismissible, and gone for good once they have talked to it).
'use client';

import { forwardRef, useEffect, useState } from 'react';
import { safeLocal, safeSession } from '@/lib/safeStorage';

const SEEN_KEY = 'sys_chat_seen';
const NUDGE_KEY = 'sys_chat_nudged';
const NUDGE_AFTER_MS = 22_000;
const NUDGE_FOR_MS = 14_000;

interface Props {
  unread: number;
  onOpen: () => void;
  /** True when the visitor has already had a conversation here, so a nudge would be noise. */
  hasHistory: boolean;
}

const ChatLauncher = forwardRef<HTMLButtonElement, Props>(function ChatLauncher({ unread, onOpen, hasHistory }, ref) {
  const [seen, setSeen] = useState(true); // pulse only until they have ever opened it (avoids a flash on SSR)
  const [nudge, setNudge] = useState(false);

  useEffect(() => {
    setSeen(safeLocal.get(SEEN_KEY) === '1');
  }, []);

  useEffect(() => {
    if (hasHistory || safeSession.get(NUDGE_KEY) || safeLocal.get(SEEN_KEY) === '1') return;
    let hide: number | undefined;
    const show = window.setTimeout(() => {
      if (document.visibilityState !== 'visible') return;
      safeSession.set(NUDGE_KEY, '1');
      setNudge(true);
      hide = window.setTimeout(() => setNudge(false), NUDGE_FOR_MS);
    }, NUDGE_AFTER_MS);
    return () => {
      window.clearTimeout(show);
      if (hide) window.clearTimeout(hide);
    };
  }, [hasHistory]);

  const open = () => {
    safeLocal.set(SEEN_KEY, '1');
    setSeen(true);
    setNudge(false);
    onOpen();
  };

  return (
    <div className="fixed z-[60] flex flex-col items-end gap-2 max-sm:bottom-[max(1rem,env(safe-area-inset-bottom))] max-sm:right-4 sm:bottom-5 sm:right-5">
      {nudge && (
        <div role="status" className="animate-nudge-in relative max-w-[16rem] rounded-2xl rounded-br-md border border-accent/30 bg-zinc-900/95 py-3 pl-4 pr-9 font-sans text-xs leading-relaxed text-zinc-200 shadow-2xl backdrop-blur-xl">
          <button type="button" onClick={open} className="cursor-pointer text-left">
            👋 Need a hand? Ask me anything — or tell me where to go and I’ll take you there.
          </button>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setNudge(false)}
            className="absolute right-1.5 top-1.5 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-zinc-500 hover:bg-white/5 hover:text-zinc-200"
          >
            ✕
          </button>
        </div>
      )}
      <button
        ref={ref}
        type="button"
        onClick={open}
        aria-label={unread > 0 ? `Open chat assistant, ${unread} unread` : 'Open chat assistant'}
        className={`group relative flex h-14 cursor-pointer items-center gap-2.5 rounded-full border border-accent/50 bg-zinc-950/90 pl-4 pr-5 font-mono text-accent shadow-xl backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:border-accent hover:glow-accent active:scale-95 ${
          seen ? '' : 'animate-ring'
        }`}
      >
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-70" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent" />
        </span>
        <span className="text-xs font-bold tracking-wide">CHAT_ASSIST</span>
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 font-sans text-[11px] font-bold text-black shadow">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
    </div>
  );
});

export default ChatLauncher;
