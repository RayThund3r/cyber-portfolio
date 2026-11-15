// src/components/site/EasterEggs.tsx — hidden surprises for curious visitors. Nothing here changes functionality or layout:
//  · the classic cheat code (arrow keys + B + A, or eight swipes + two taps on a phone) → confetti and a nudge to the arcade
//  · type a magic word anywhere on the page (not inside a text box): party, matrix, snow, hearts, stars, barrel, sudo
//  · a hello for people who open the browser console
// The assistant knows hints about these ("any easter eggs?") but never the full list.
'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { triggerFx } from '@/lib/events/fx';
import Icon from '@/components/ui/Icon';

const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
const SWIPES = ['U', 'U', 'D', 'D', 'L', 'R', 'L', 'R', 'T', 'T'];
const WORDS: Record<string, { fx: 'confetti' | 'matrix' | 'snow' | 'hearts' | 'stars' | 'barrel' | 'none'; msg: string }> = {
  party: { fx: 'confetti', msg: 'Party mode! 🎉' },
  matrix: { fx: 'matrix', msg: 'Wake up, visitor...' },
  snow: { fx: 'snow', msg: 'Let it snow.' },
  hearts: { fx: 'hearts', msg: 'Spreading love.' },
  stars: { fx: 'stars', msg: 'Look up.' },
  barrel: { fx: 'barrel', msg: 'Do a barrel roll!' },
  sudo: { fx: 'none', msg: 'visitor is not in the sudoers file. This incident will be reported.' },
};
const typing = (t: EventTarget | null) => { const el = t as HTMLElement | null; return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)); };

export default function EasterEggs() {
  const [toast, setToast] = useState<{ msg: string; game?: boolean } | null>(null);
  const timer = useRef(0);
  const say = (msg: string, game = false) => { setToast({ msg, game }); window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setToast(null), game ? 7000 : 3500); };

  useEffect(() => {
    try {
      if (!(window as unknown as { __sysHello?: boolean }).__sysHello) {
        (window as unknown as { __sysHello?: boolean }).__sysHello = true;
        console.log('%c SYS://ONLINE ', 'background:#22d3ee;color:#000;font-weight:bold;padding:2px 6px;border-radius:4px', '\nCurious? So are we. Try the cheat code, or type "party" on the page. 🤫');
      }
    } catch { /* console blocked */ }

    let k = 0; let buf = '';
    const onKey = (e: KeyboardEvent) => {
      if (typing(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      k = key === KONAMI[k] ? k + 1 : key === KONAMI[0] ? 1 : 0;
      if (k === KONAMI.length) { k = 0; triggerFx('confetti', 7000); say('CHEAT CODE ACCEPTED · +30 LIVES', true); }
      if (e.key.length === 1) {
        buf = (buf + key).slice(-8);
        for (const w of Object.keys(WORDS)) if (buf.endsWith(w)) { buf = ''; const x = WORDS[w]; triggerFx(x.fx, 6000); say(x.msg); }
      }
    };
    // Phone version: swipe up, up, down, down, left, right, left, right, then tap twice.
    let sx = 0, sy = 0, sq = 0;
    const onStart = (e: TouchEvent) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; };
    const onEnd = (e: TouchEvent) => {
      if (typing(e.target)) return;
      const t = e.changedTouches[0]; const dx = t.clientX - sx, dy = t.clientY - sy;
      const m = Math.max(Math.abs(dx), Math.abs(dy));
      const d = m < 14 ? 'T' : m < 70 ? '' : Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'R' : 'L') : dy > 0 ? 'D' : 'U';
      if (!d) { return; }
      sq = d === SWIPES[sq] ? sq + 1 : d === SWIPES[0] ? 1 : 0;
      if (sq === SWIPES.length) { sq = 0; triggerFx('confetti', 7000); say('CHEAT CODE ACCEPTED · +30 LIVES', true); }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchend', onEnd, { passive: true });
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('touchstart', onStart); window.removeEventListener('touchend', onEnd); window.clearTimeout(timer.current); };
  }, []);

  if (!toast) return null;
  return (
    <div role="status" className="fixed bottom-20 left-1/2 z-[70] flex max-w-[92vw] -translate-x-1/2 items-center gap-3 rounded-full border border-accent/50 bg-zinc-950/95 px-4 py-2 font-mono text-xs text-accent shadow-lg backdrop-blur">
      <Icon name="gamepad" size={15} />
      <span>{toast.msg}</span>
      {toast.game && <Link href="/games?g=snake" className="rounded-full border border-accent/50 px-2 py-0.5 hover:bg-accent/10">PLAY</Link>}
    </div>
  );
}
