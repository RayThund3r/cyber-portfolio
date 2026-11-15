// src/components/games/GameBuddy.tsx — the playful sidekick: reacts to what happens in the game with short funny lines.
// Shows a small toast, and also says the line in the chat when the chat is open. Mute is remembered. Never spams.
'use client';

import { useEffect, useRef, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { GAME_EVENT, chatSay, getGameContext, type GameEventDetail } from '@/lib/chatBus';
import { newSpeakState, noteSpoken, pickLine, shouldSpeak } from '@/lib/games/banter';
import { safeLocal } from '@/lib/safeStorage';

const MUTE_KEY = 'sys_buddy_muted';

export default function GameBuddy() {
  const [muted, setMuted] = useState(false);
  const [line, setLine] = useState<string | null>(null);
  const mutedRef = useRef(false);
  const speak = useRef(newSpeakState());
  const n = useRef(0);
  const last = useRef<string | null>(null);
  const hide = useRef<number | null>(null);
  const lastEvent = useRef(Date.now());

  useEffect(() => {
    const m = safeLocal.get(MUTE_KEY) === '1';
    setMuted(m); mutedRef.current = m;
  }, []);

  useEffect(() => {
    const say = (game: string, kind: GameEventDetail['kind'], c: { score?: number; streak?: number; level?: number }) => {
      if (mutedRef.current) return;
      const now = Date.now();
      if (!shouldSpeak(speak.current, kind, now)) return;
      n.current += 1;
      const text = pickLine(game, kind, n.current, last.current, c);
      if (!text) return;
      last.current = text;
      noteSpoken(speak.current, kind, now);
      setLine(text);
      chatSay(text);
      if (hide.current) window.clearTimeout(hide.current);
      hide.current = window.setTimeout(() => setLine(null), 4200);
    };
    const on = (e: Event) => {
      const d = (e as CustomEvent<GameEventDetail>).detail;
      if (!d) return;
      lastEvent.current = Date.now();
      if (d.kind === 'leave') { setLine(null); return; }
      say(d.game, d.kind, { score: d.score, streak: d.streak, level: d.level });
    };
    window.addEventListener(GAME_EVENT, on);
    // Gentle nudge when someone has gone quiet in the middle of a game.
    const idle = window.setInterval(() => {
      const ctx = getGameContext();
      if (ctx && ctx.status === 'playing' && Date.now() - lastEvent.current > 30000) { lastEvent.current = Date.now(); say(ctx.game, 'idle', {}); }
    }, 5000);
    return () => { window.removeEventListener(GAME_EVENT, on); window.clearInterval(idle); if (hide.current) window.clearTimeout(hide.current); };
  }, []);

  const toggle = () => {
    const next = !muted;
    setMuted(next); mutedRef.current = next;
    safeLocal.set(MUTE_KEY, next ? '1' : '0');
    if (next) setLine(null);
  };

  return (
    <>
      <button type="button" onClick={toggle} aria-pressed={muted} title={muted ? 'Turn the game buddy on' : 'Mute the game buddy'}
        className={`inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg border px-3 font-mono text-[11px] transition active:scale-95 ${muted ? 'border-zinc-800 text-zinc-500' : 'border-accent/40 text-accent hover:bg-accent/10'}`}>
        <Icon name={muted ? 'ban' : 'chat'} size={14} /> {muted ? 'BUDDY OFF' : 'BUDDY ON'}
      </button>
      <div aria-live="polite" role="status" className="pointer-events-none fixed inset-x-0 z-40 flex justify-center px-4" style={{ bottom: 'calc(5.5rem + env(safe-area-inset-bottom))' }}>
        {line && (
          <div className="g-pop pointer-events-auto max-w-sm rounded-2xl border border-accent/30 bg-zinc-900/90 px-4 py-2.5 text-center text-xs text-zinc-100 shadow-xl backdrop-blur">
            <span className="mr-1.5 font-mono text-[10px] text-accent">BUDDY</span>{line}
          </div>
        )}
      </div>
    </>
  );
}
