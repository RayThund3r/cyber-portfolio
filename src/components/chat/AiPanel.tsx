// src/components/chat/AiPanel.tsx
//
// The "enable on-device AI" strip under the chat header. Collapsed to one line on phones so the
// conversation keeps the room.
'use client';

import {
  LLMState,
  MODEL_OPTIONS,
  labelForModel,
  loadLocalLLM,
  unloadLocalLLM,
} from '@/utils/chatEngine/localLLM';

interface Props {
  llm: LLMState;
  modelId: string;
  setModelId: (id: string) => void;
  remote: boolean;
  compact: boolean;
}

export default function AiPanel({ llm, modelId, setModelId, remote, compact }: Props) {
  const base = 'border-b border-zinc-800 bg-zinc-900/60 px-4 py-2 font-mono text-[10px]';
  const selected = MODEL_OPTIONS.find((m) => m.id === modelId) || MODEL_OPTIONS[1];

  if (llm.status === 'loading') {
    const pct = Math.round(llm.progress * 100);
    return (
      <div className={base} role="status">
        <div className="mb-1 flex justify-between text-zinc-400">
          <span>LOADING AI · {labelForModel(llm.modelId)}</span>
          <span>{pct}%</span>
        </div>
        <div className="h-1 overflow-hidden rounded bg-zinc-800">
          <div className="h-full bg-accent transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-1 truncate text-zinc-600">{llm.text}</div>
      </div>
    );
  }

  if (llm.status === 'ready') {
    return (
      <div className={`${base} flex items-center justify-between gap-3`}>
        <span className="truncate text-emerald-400">● AI ON · {labelForModel(llm.modelId)} · runs on your device</span>
        <button type="button" onClick={() => unloadLocalLLM()} className="shrink-0 cursor-pointer py-1 text-zinc-500 hover:text-zinc-200">
          TURN OFF
        </button>
      </div>
    );
  }

  if (llm.status === 'unsupported') {
    return (
      <div className={`${base} text-zinc-500`}>
        {remote ? '● Using server AI' : 'AI needs a WebGPU browser (Chrome / Edge). Using smart rules + search for now.'}
      </div>
    );
  }

  if (remote) return <div className={`${base} text-emerald-400`}>● AI ON · server</div>;

  const note =
    llm.status === 'error'
      ? `Couldn't load AI: ${llm.error || 'unknown error'}`
      : `${selected.note}. One-time ${selected.approxDownload} download (cached after) — use Wi-Fi if you're on mobile data.`;

  const controls = (
    <div className="flex items-center gap-2">
      <select
        value={modelId}
        onChange={(e) => setModelId(e.target.value)}
        aria-label="AI model"
        className="min-w-0 flex-1 rounded border border-zinc-800 bg-zinc-950 px-1.5 py-1.5 text-zinc-300 focus:outline-none sm:flex-none"
      >
        {MODEL_OPTIONS.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label} {m.approxDownload}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => loadLocalLLM(modelId)}
        className="shrink-0 cursor-pointer rounded bg-accent-strong px-2.5 py-1.5 font-bold text-black hover:bg-accent"
      >
        ENABLE AI
      </button>
    </div>
  );

  if (compact) {
    return (
      <details className={base}>
        <summary className="flex cursor-pointer list-none items-center justify-between py-1 text-zinc-400">
          <span>AI: OFF · smart rules + search</span>
          <span className="text-accent">ENABLE ▾</span>
        </summary>
        <div className="mt-2">{controls}</div>
        <div className="mt-1 text-zinc-600">{note}</div>
      </details>
    );
  }

  return (
    <div className={base}>
      {controls}
      <div className="mt-1 text-zinc-600">{note}</div>
    </div>
  );
}
