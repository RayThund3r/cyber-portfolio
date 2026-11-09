// src/components/chat/MessageList.tsx
//
// The scrolling conversation: day separators, grouped bubbles, quick-reply chips, the hand-off card,
// the typing indicator, and "stick to the bottom" scrolling that never yanks a visitor who has
// scrolled up to re-read — they get a "New messages" pill instead.
'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Message } from '@/utils/chatEngine/types';
import type { SharedFile } from './useAttachments';
import MessageBubble from './MessageBubble';
import HandoffCard from './HandoffCard';
import WelcomeTiles from './WelcomeTiles';
import { dayLabel, sameDay } from './chatUtils';

interface Props {
  messages: Message[];
  isThinking: boolean;
  revealingId: string | null;
  chips: string[];
  expert: boolean;
  handoff: { prefill: string } | null;
  files: SharedFile[];
  /** Show the launchpad tiles (fresh conversation). */
  welcome?: boolean;
  onChip: (text: string) => void;
  onNav?: (nav: { path: string; label: string }) => void;
  onRate: (m: Message, r: 'up' | 'down') => void;
  onRetry: (m: Message) => void;
  onRevealDone: (id: string) => void;
  onHandoffCancel: () => void;
  onHandoffSent: (summary: string) => void;
  onToast: (t: string) => void;
}

const NEAR_BOTTOM = 96;

export default function MessageList(p: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const [away, setAway] = useState(false);
  const [slow, setSlow] = useState(false);

  const toBottom = useCallback((smooth: boolean) => {
    const el = ref.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  const onScroll = () => {
    const el = ref.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM;
    stick.current = near;
    if (near) setAway(false);
  };

  // New content: follow it if the visitor is at the bottom (or just sent something); otherwise flag it.
  const lastId = p.messages[p.messages.length - 1]?.id;
  const lastSender = p.messages[p.messages.length - 1]?.sender;
  useLayoutEffect(() => {
    if (lastSender === 'user') stick.current = true;
    if (stick.current) toBottom(true);
    else setAway(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastId, p.isThinking, p.handoff, p.chips.length]);

  // Keep following while a reply types out / streams in.
  const onTick = useCallback(() => {
    if (stick.current) toBottom(false);
  }, [toBottom]);

  useEffect(() => {
    if (!p.isThinking) {
      setSlow(false);
      return;
    }
    const t = window.setTimeout(() => setSlow(true), 7000);
    return () => window.clearTimeout(t);
  }, [p.isThinking]);

  const lastBot = [...p.messages].reverse().find((m) => m.sender === 'bot');
  const streaming = p.messages.length > 0 && !!p.messages[p.messages.length - 1].streaming;

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={ref}
        onScroll={onScroll}
        role="log"
        aria-label="Conversation"
        aria-live="polite"
        aria-relevant="additions"
        tabIndex={0}
        className="h-full overflow-y-auto overscroll-contain scroll-smooth px-3.5 pb-3 pt-1 focus-visible:outline-none"
      >
        {p.messages.map((m, i) => {
          const prev = p.messages[i - 1];
          const next = p.messages[i + 1];
          const first = !prev || prev.sender !== m.sender || !sameDay(prev.ts, m.ts);
          const last = !next || next.sender !== m.sender || !sameDay(m.ts, next.ts);
          const newDay = !!m.ts && (!prev || !sameDay(prev.ts, m.ts)) && i > 0;
          return (
            <div key={m.id}>
              {newDay && (
                <div className="my-3 flex items-center gap-3 font-mono text-[10px] uppercase tracking-wider text-zinc-600" role="separator">
                  <span className="h-px flex-1 bg-white/5" />
                  {dayLabel(m.ts!)}
                  <span className="h-px flex-1 bg-white/5" />
                </div>
              )}
              <MessageBubble
                msg={m}
                first={first}
                last={last}
                showActions={m.id === lastBot?.id}
                onRevealDone={p.onRevealDone}
                onTick={onTick}
                onRate={p.onRate}
                onRetry={p.onRetry}
                onCard={p.onChip}
                onNav={p.onNav}
                onToast={p.onToast}
              />
            </div>
          );
        })}

        {p.welcome && !p.isThinking && !p.handoff && <WelcomeTiles onPick={p.onChip} />}

        {p.handoff && (
          <div className="animate-msg-in mt-3">
            <HandoffCard
              files={p.files}
              messages={p.messages}
              prefill={p.handoff.prefill}
              expert={p.expert}
              onCancel={p.onHandoffCancel}
              onSent={p.onHandoffSent}
            />
          </div>
        )}

        {p.isThinking && !streaming && (
          <div className="animate-msg-in mt-3 flex items-center gap-2" role="status" aria-label="Assistant is typing">
            <div className="flex h-7 w-7 items-center justify-center rounded-full border border-accent/40 bg-accent/10 font-mono text-[11px] text-accent" aria-hidden="true">
              ◈
            </div>
            <div className="flex items-center gap-1 rounded-2xl rounded-tl-md border border-white/[0.07] bg-zinc-900/90 px-3.5 py-3">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent [animation-delay:0.15s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent [animation-delay:0.3s]" />
            </div>
            {slow && <span className="font-mono text-[10px] text-zinc-500">still working…</span>}
          </div>
        )}

        {!p.isThinking && !p.revealingId && !p.handoff && p.chips.length > 0 && (
          <div className="animate-msg-in mt-3 flex flex-wrap gap-1.5 pl-9" aria-label="Suggested replies">
            {p.chips.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => p.onChip(s)}
                className="min-h-9 cursor-pointer rounded-full border border-accent/35 bg-accent/5 px-3.5 py-1.5 font-sans text-xs text-accent transition-all hover:border-accent hover:bg-accent/15 active:scale-95 sm:min-h-8"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {away && (
        <button
          type="button"
          onClick={() => {
            stick.current = true;
            setAway(false);
            toBottom(true);
          }}
          className="animate-nudge-in absolute bottom-2 left-1/2 flex min-h-9 -translate-x-1/2 cursor-pointer items-center gap-1.5 rounded-full border border-accent/40 bg-zinc-900/95 px-3.5 font-mono text-[11px] text-accent shadow-xl backdrop-blur-xl hover:bg-zinc-800"
        >
          ↓ New messages
        </button>
      )}
    </div>
  );
}
