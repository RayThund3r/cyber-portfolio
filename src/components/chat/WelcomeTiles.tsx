// src/components/chat/WelcomeTiles.tsx
//
// Empty-state launchpad: a few big tappable tiles instead of a row of chips, so a first-time visitor
// sees what the assistant can do at a glance. Each tile sends its prompt as if typed.
'use client';

const TILES: Array<{ icon: string; title: string; hint: string; send: string }> = [
  { icon: '🛠', title: 'Fix my device', hint: 'Describe the problem', send: 'My device has a problem' },
  { icon: '🗂', title: 'See the work', hint: 'Browse projects', send: 'Show me your projects' },
  { icon: '💬', title: 'Get a quote', hint: 'Price and timing', send: 'Get a quote' },
  { icon: '🧭', title: 'Take me somewhere', hint: 'Navigate the site', send: 'What can you do?' },
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
          <span className="text-lg" aria-hidden="true">{t.icon}</span>
          <p className="mt-1 font-sans text-[13px] font-semibold text-zinc-100">{t.title}</p>
          <p className="font-sans text-[11px] text-zinc-500">{t.hint}</p>
        </button>
      ))}
    </div>
  );
}
