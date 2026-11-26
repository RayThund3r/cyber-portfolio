// src/components/chat/WelcomeTiles.tsx
//
// Empty-state launchpad: a few big tappable tiles instead of a row of chips, so a first-time visitor
// sees what the assistant can do at a glance. Each tile sends its prompt as if typed.
'use client';

const TILES: Array<{ icon: string; // SVG path title: string; hint: string; send: string }> = [
  { icon: 'M14.7 6.3a4 4 0 0 0-5 5L4 17l3 3 5.7-5.7a4 4 0 0 0 5-5l-2.4 2.4-2.3-.7-.7-2.3z', title: 'Fix my device', hint: 'Describe the problem', send: 'My device has a problem' },
  { icon: 'M3 7h6l2 2h10v10H3z', title: 'See the work', hint: 'Browse projects', send: 'Show me your projects' },
  { icon: 'M4 5h16v11H9l-5 4z', title: 'Get a quote', hint: 'Price and timing', send: 'Get a quote' },
  { icon: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM15.5 8.5l-2 5-5 2 2-5z', title: 'Take me somewhere', hint: 'Navigate the site', send: 'What can you do?' },
];

export default function WelcomeTiles({ onPick }: { onPick: (t: string) => void }) {
  return (
    <div className="mt-4 grid grid-cols-2 gap-2" role="group" aria-label="Quick start">
      {TILES.map((t, i) => (
        <button
          key={t.title}
          type="button"
          onClick={() => onPick(t.send)}
          style={{ animationDelay: `${80 + i * 70}ms` }}
          className="animate-msg-in cursor-pointer rounded-xl border border-white/[0.08] bg-zinc-900/70 px-3 py-3 text-left opacity-0 transition duration-200 [animation-fill-mode:forwards] hover:-translate-y-0.5 hover:border-accent/50 hover:bg-zinc-900 focus-visible:outline-2 focus-visible:outline-accent active:scale-[0.97]"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-accent"><path d={t.icon} /></svg>
          <p className="mt-1 font-sans text-[13px] font-semibold text-zinc-100">{t.title}</p>
          <p className="font-sans text-[11px] text-zinc-500">{t.hint}</p>
        </button>
      ))}
    </div>
  );
}
