// src/components/admin/AdminEggs.tsx — little secrets for the owner. Purely cosmetic; nothing here touches data or settings.
//  · type a word anywhere in the admin (not inside a text box): coffee, matrix, party, uptime, root, hello, 42
//  · the cheat code (arrow keys + B + A) opens "root mode": a green terminal glow for a few seconds
//  · press "g" then "g" quickly: scroll to the top ("gg", like in vim)
'use client';
import { useEffect, useRef, useState } from 'react';
import { triggerFx } from '@/lib/events/fx';

const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
const typing = (t: EventTarget | null) => { const el = t as HTMLElement | null; return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)); };
const QUOTES = [
  'There is no cloud. It is just someone else’s computer. (Except yours, apparently.)',
  'It works on my machine. ✅',
  'Have you tried turning it off and on again?',
  'The best code is the code you did not have to write.',
  'Ship it. Then fix it. Then ship it again.',
];

export default function AdminEggs() {
  const [msg, setMsg] = useState<string | null>(null);
  const [root, setRoot] = useState(false);
  const timer = useRef(0);
  const say = (m: string, ms = 3800) => { setMsg(m); window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setMsg(null), ms); };

  useEffect(() => {
    let k = 0; let buf = ''; let lastG = 0; let q = 0;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || typing(e.target)) return;
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      k = key === KONAMI[k] ? k + 1 : key === KONAMI[0] ? 1 : 0;
      if (k === KONAMI.length) {
        k = 0; setRoot(true); triggerFx('matrix'); say('ROOT MODE ENGAGED. (Cosmetic. You were already the admin.) 😎', 5000);
        window.setTimeout(() => setRoot(false), 6000);
        return;
      }
      if (key === 'g') { const now = Date.now(); if (now - lastG < 450) { window.scrollTo({ top: 0, behavior: 'smooth' }); say('gg ⬆️', 1500); } lastG = now; }
      if (key.length !== 1) return;
      buf = (buf + key).slice(-8);
      const hit = (w: string) => buf.endsWith(w);
      if (hit('coffee')) say('☕ Brewing... 100% (never done). Take a real break, you earned it.');
      else if (hit('matrix')) { triggerFx('matrix'); say('Wake up, admin...'); }
      else if (hit('party')) { triggerFx('confetti'); say('Party mode! 🎉 Something good happened, right?'); }
      else if (hit('uptime')) say(`Session uptime: ${Math.max(1, Math.round(performance.now() / 60000))} min. The site has been fine without you, probably. 🙂`);
      else if (hit('root')) say('uid=0(admin) gid=0(admin) groups=0(admin). Welcome back.');
      else if (hit('hello')) say(QUOTES[q++ % QUOTES.length], 4500);
      else if (hit('42')) say('The answer. Now what was the question? Probably: "how many unread requests?"');
    };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); window.clearTimeout(timer.current); };
  }, []);

  return (
    <>
      {root && <div aria-hidden className="pointer-events-none fixed inset-0 z-[90] animate-pulse" style={{ boxShadow: 'inset 0 0 120px rgba(34,197,94,.35)', background: 'repeating-linear-gradient(0deg, rgba(34,197,94,.04) 0 2px, transparent 2px 4px)' }} />}
      {msg && (
        <div role="status" className="fixed bottom-4 left-1/2 z-[95] w-[min(92vw,26rem)] -translate-x-1/2 rounded-xl border border-emerald-500/40 bg-zinc-950/95 px-4 py-3 font-mono text-xs text-emerald-300 shadow-lg">
          {msg}
        </div>
      )}
    </>
  );
}
