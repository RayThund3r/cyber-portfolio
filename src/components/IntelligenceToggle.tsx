// src/components/IntelligenceToggle.tsx
'use client';

import { useIntelligence } from '@/context/IntelligenceContext';

export default function IntelligenceToggle() {
  const { mode, toggleMode } = useIntelligence();

  return (
    <button
      onClick={toggleMode}
      className={`px-3 py-1.5 rounded font-mono text-xs border transition-all duration-300 flex items-center gap-2 cursor-pointer ${
        mode === 'HUMAN'
          ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/20'
          : 'bg-cyan-500/10 border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/20'
      }`}
      title="Toggle site communication persona between Human-Friendly and Expert-Technical"
    >
      <span className={`w-2 h-2 rounded-full animate-pulse ${mode === 'HUMAN' ? 'bg-emerald-400' : 'bg-cyan-400'}`}></span>
      <span>MODE: [{mode}]</span>
    </button>
  );
}