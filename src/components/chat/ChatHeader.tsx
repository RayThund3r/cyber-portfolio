// src/components/chat/ChatHeader.tsx
//
// Title bar: avatar with a live status dot, the name of any guided flow in progress, an overflow menu
// (owner message, reply style, help, export, clear, expand) and close. The menu is keyboard-operable
// and closes on Esc / outside click without closing the chat.
'use client';

import { useEffect, useRef, useState } from 'react';
import type { PersonaMode } from '@/utils/chatEngine/types';

const FLOW_LABEL: Record<string, string> = {
  diagnose: 'Troubleshooting',
  project: 'Scoping a project',
  decide: 'Repair or replace',
  quote: 'Getting a quote',
};

interface Props {
  mode: PersonaMode;
  flow?: string;
  wide: boolean;
  canExpand: boolean;
  isThinking: boolean;
  onToggleMode: () => void;
  onOwner: () => void;
  onHelp: () => void;
  onExport: () => void;
  onClear: () => void;
  onExpand: () => void;
  onClose: () => void;
}

export default function ChatHeader(p: Props) {
  const [menu, setMenu] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const firstItem = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menu) {
      setConfirmClear(false);
      return;
    }
    firstItem.current?.focus();
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
  }, [menu]);

  const item = 'flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-left text-xs text-zinc-200 transition-colors hover:bg-white/5 focus-visible:bg-white/5 sm:min-h-9';
  const pick = (fn: () => void) => () => {
    setMenu(false);
    triggerRef.current?.focus();
    fn();
  };

  return (
    <div className="relative z-40 flex items-center gap-3 border-b border-white/5 bg-gradient-to-r from-accent/10 via-transparent to-transparent px-3.5 py-2.5 max-sm:pt-[max(0.625rem,env(safe-area-inset-top))]">
      {/* the sweep lives in its own clipped layer so the dropdown menu below is never cut off */}
      <div aria-hidden="true" className="scanline pointer-events-none absolute inset-0 overflow-hidden" />
      <div className="relative shrink-0" aria-hidden="true">
        <div className="flex h-9 w-9 items-center justify-center rounded-full border border-accent/50 bg-accent/10 font-mono text-sm text-accent">◈</div>
        <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-zinc-950 ${p.isThinking ? 'animate-pulse bg-amber-400' : 'bg-emerald-400'}`} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate font-mono text-xs font-bold tracking-wide text-zinc-100">CHAT_ENGINE</p>
        <p className="truncate font-mono text-[10px] text-zinc-500" aria-live="polite">
          {p.isThinking ? 'typing…' : p.flow ? FLOW_LABEL[p.flow] || 'In a guided flow' : p.mode === 'EXPERT' ? 'expert mode' : 'online · replies instantly'}
        </p>
      </div>

      <div ref={wrapRef} className="relative flex items-center gap-1">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setMenu((m) => !m)}
          aria-haspopup="menu"
          aria-expanded={menu}
          aria-label="Chat menu"
          className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl text-lg text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-100 sm:h-9 sm:w-9"
        >
          ⋯
        </button>

        {menu && (
          <div
            role="menu"
            aria-label="Chat options"
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                setMenu(false);
                triggerRef.current?.focus();
              }
              if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]'));
                const i = items.indexOf(document.activeElement as HTMLElement);
                items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
              }
            }}
            className="animate-nudge-in absolute right-0 top-full z-30 mt-1.5 w-60 origin-top-right rounded-xl border border-white/10 bg-zinc-900/95 p-1.5 shadow-2xl backdrop-blur-xl"
          >
            <button ref={firstItem} role="menuitem" type="button" className={item} onClick={pick(p.onOwner)}>
              <span aria-hidden>✉</span> Message the owner
            </button>
            <button role="menuitem" type="button" className={item} onClick={pick(p.onToggleMode)}>
              <span aria-hidden>{p.mode === 'HUMAN' ? '⌘' : '☺'}</span> {p.mode === 'HUMAN' ? 'Switch to expert replies' : 'Switch to friendly replies'}
            </button>
            <button role="menuitem" type="button" className={item} onClick={pick(p.onHelp)}>
              <span aria-hidden>?</span> What can you do?
            </button>
            <button role="menuitem" type="button" className={item} onClick={pick(p.onExport)}>
              <span aria-hidden>⤓</span> Download conversation
            </button>
            {p.canExpand && (
              <button role="menuitem" type="button" className={item} onClick={pick(p.onExpand)}>
                <span aria-hidden>{p.wide ? '⤡' : '⤢'}</span> {p.wide ? 'Smaller window' : 'Bigger window'}
              </button>
            )}
            <div className="my-1 h-px bg-white/5" />
            {confirmClear ? (
              <button role="menuitem" type="button" className={`${item} text-amber-300`} onClick={pick(p.onClear)}>
                <span aria-hidden>⚠</span> Tap again to clear everything
              </button>
            ) : (
              <button role="menuitem" type="button" className={item} onClick={() => setConfirmClear(true)}>
                <span aria-hidden>↺</span> Start a fresh chat
              </button>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={p.onClose}
          aria-label="Close chat"
          className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl text-sm text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-100 sm:h-9 sm:w-9"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
