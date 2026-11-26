// src/components/chat/ChatHeader.tsx
//
// Title bar: avatar with a live status dot, the name of any guided flow in progress, an overflow menu
// (owner message, reply style, help, export, clear, expand) and close. The menu is keyboard-operable
// and closes on Esc / outside click without closing the chat.
'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
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
  /** Opens the voice conversation (omitted when the browser has no microphone support). */
  onVoice?: () => void;
  /** WhatsApp hand-off link, when the owner has a number set. */
  whatsappHref?: string;
  onWhatsApp?: () => void;
  /** Small status line for the AI engine, shown inside the menu. */
  aiPanel?: ReactNode;
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

  const Ic = ({ d }: { d: string }) => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 text-zinc-400"><path d={d} /></svg>
  );
  const item = 'flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-left text-xs text-zinc-200 transition-colors hover:bg-white/5 focus-visible:bg-white/5 sm:min-h-9';
  const pick = (fn: () => void) => () => {
    setMenu(false);
    triggerRef.current?.focus();
    fn();
  };

  return (
    <div className="relative z-40 flex items-center gap-2.5 border-b border-white/5 bg-zinc-950 px-3 py-2 max-sm:pt-[max(0.5rem,env(safe-area-inset-top))]">
      <div className="relative shrink-0" aria-hidden="true">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/15 text-accent"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/></svg></div>
        <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-zinc-950 ${p.isThinking ? 'animate-pulse bg-amber-400' : 'bg-emerald-400'}`} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate font-sans text-[13px] font-semibold text-zinc-100">Assistant</p>
        <p className="truncate font-sans text-[11px] text-zinc-500" aria-live="polite">
          {p.isThinking ? 'Typing…' : p.flow ? FLOW_LABEL[p.flow] || 'In a guided flow' : p.mode === 'EXPERT' ? 'Expert replies' : 'Online'}
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
            className="animate-nudge-in absolute right-0 top-full z-30 mt-1.5 w-64 origin-top-right rounded-xl border border-white/10 bg-zinc-900/95 p-1.5 shadow-2xl backdrop-blur-xl"
          >
            <button ref={firstItem} role="menuitem" type="button" className={item} onClick={pick(p.onOwner)}>
              <Ic d="M4 6h16v12H4zM4 7l8 6 8-6" /> Message the owner
            </button>
            {p.onVoice && (
              <button role="menuitem" type="button" className={item} onClick={pick(p.onVoice)}>
                <Ic d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3" /> Voice conversation
              </button>
            )}
            {p.whatsappHref && (
              <a role="menuitem" href={p.whatsappHref} target="_blank" rel="noopener noreferrer" className={item} onClick={() => { setMenu(false); p.onWhatsApp?.(); }}>
                <Ic d="M4 20l1.3-4A8 8 0 1 1 8 18.7z" /> Continue on WhatsApp
              </a>
            )}
            <button role="menuitem" type="button" className={item} onClick={pick(p.onToggleMode)}>
              <Ic d={p.mode === 'HUMAN' ? 'M8 9l-4 3 4 3M16 9l4 3-4 3' : 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8.5 14a4 4 0 0 0 7 0M9 9.5h.01M15 9.5h.01'} /> {p.mode === 'HUMAN' ? 'Switch to expert replies' : 'Switch to friendly replies'}
            </button>
            <button role="menuitem" type="button" className={item} onClick={pick(p.onHelp)}>
              <Ic d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.5M12 17h.01" /> What can you do?
            </button>
            <button role="menuitem" type="button" className={item} onClick={pick(p.onExport)}>
              <Ic d="M12 4v11m0 0l-4-4m4 4l4-4M5 20h14" /> Download conversation
            </button>
            {p.canExpand && (
              <button role="menuitem" type="button" className={item} onClick={pick(p.onExpand)}>
                <Ic d={p.wide ? 'M9 4v5H4M15 20v-5h5' : 'M4 9V4h5M20 15v5h-5'} /> {p.wide ? 'Smaller window' : 'Bigger window'}
              </button>
            )}
            <div className="my-1 h-px bg-white/5" />
            {confirmClear ? (
              <button role="menuitem" type="button" className={`${item} text-amber-300`} onClick={pick(p.onClear)}>
                <Ic d="M12 4l9 16H3zM12 10v4M12 17h.01" /> Tap again to clear everything
              </button>
            ) : (
              <button role="menuitem" type="button" className={item} onClick={() => setConfirmClear(true)}>
                <Ic d="M4 12a8 8 0 1 0 3-6.2M4 4v4h4" /> Start a fresh chat
              </button>
            )}
            {p.aiPanel && <div className="mt-1 border-t border-white/5 pt-1.5">{p.aiPanel}</div>}
          </div>
        )}

        <button
          type="button"
          onClick={p.onClose}
          aria-label="Close chat"
          className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl text-sm text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-100 sm:h-9 sm:w-9"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>
    </div>
  );
}
