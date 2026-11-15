// src/components/site/SessionLine.tsx — a tiny terminal line in the footer with a real, live "time on site" counter for this visit.
// Nothing is stored or sent: it counts seconds in the page and starts again on every visit.
'use client';
import { useEffect, useState } from 'react';

const two = (n: number) => String(n).padStart(2, '0');
export default function SessionLine() {
  const [s, setS] = useState(0);
  useEffect(() => {
    const t0 = Date.now();
    const id = window.setInterval(() => { if (!document.hidden) setS(Math.floor((Date.now() - t0) / 1000)); }, 1000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div className="mt-1 text-[10px] text-zinc-500" aria-hidden="true">
      <span className="text-accent">&gt;</span> session {two(Math.floor(s / 3600))}:{two(Math.floor(s / 60) % 60)}:{two(s % 60)} <span className="caret" />
    </div>
  );
}
