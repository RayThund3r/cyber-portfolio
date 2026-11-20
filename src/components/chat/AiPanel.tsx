// src/components/chat/AiPanel.tsx
//
// The "enable on-device AI" strip under the chat header. Collapsed to one line on phones so the
// conversation keeps the room.
'use client';

import { useState } from 'react';
import { setCloudUserOff, type CloudQuota } from '@/utils/chatEngine/remoteLLM';
import AccessPanel from './AccessPanel';
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
  cloud?: { ready: boolean; off: boolean; label: string; limited?: boolean; quota?: CloudQuota | null };
  compact: boolean;
}

const hoursLeft = (t: number) => { const m = Math.max(1, Math.round((t - Date.now()) / 60000)); return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`; };

export default function AiPanel({ llm, modelId, setModelId, remote, cloud, compact }: Props) {
  const [showMore, setShowMore] = useState(false);
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

  // Server-hosted model: nothing to download, works on any browser.
  if (cloud?.ready) {
    return (
      <div className={`${base} flex flex-wrap items-center justify-between gap-x-3`}>
        <span className="truncate text-emerald-400">● AI ON · {cloud.label}{cloud.quota?.enabled ? ` · ${cloud.quota.left < 0 ? 'unlimited' : `${cloud.quota.left} left today`}` : ' · nothing to download'}</span>
        <span className="flex shrink-0 items-center gap-2">
          {cloud.quota?.enabled && cloud.quota.plan === 'free' && (
            <button type="button" onClick={() => setShowMore((v) => !v)} className="hit cursor-pointer py-1 text-accent hover:underline">GET MORE</button>
          )}
          <button type="button" onClick={() => setCloudUserOff(true)} className="hit cursor-pointer py-1 text-zinc-500 hover:text-zinc-200">TURN OFF</button>
        </span>
        {showMore && <div className="basis-full"><AccessPanel onClose={() => setShowMore(false)} /></div>}
      </div>
    );
  }
  // The free daily answers are used up: the chat keeps working on the built-in rules; offer a pass or the on-device model.
  const limitedRow = cloud?.limited ? (
    <div className="mb-1">
      <div className="text-amber-400">● Daily AI limit reached · using smart rules{cloud.quota ? ` · resets in ${hoursLeft(cloud.quota.resetAt)}` : ''}</div>
      <button type="button" onClick={() => setShowMore((v) => !v)} className="hit cursor-pointer text-accent hover:underline">{showMore ? 'HIDE' : 'GET MORE ANSWERS'}</button>
      {showMore && <AccessPanel onClose={() => setShowMore(false)} />}
    </div>
  ) : null;
  const cloudOffRow = cloud?.off && !limitedRow ? (
    <button type="button" onClick={() => setCloudUserOff(false)} className="hit mb-1 block cursor-pointer text-left text-accent">
      Cloud AI is off · TURN ON (no download)
    </button>
  ) : null;

  if (llm.status === 'unsupported') {
    if (limitedRow || cloudOffRow) return <div className={base}>{limitedRow}{cloudOffRow}<span className="text-zinc-500">Or use smart rules + search.</span></div>;
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
      <div className={limitedRow ? base : undefined}>
      {limitedRow}
      <details className={limitedRow ? 'mt-1' : base}>
        <summary className="flex cursor-pointer list-none items-center justify-between py-1 text-zinc-400">
          <span>AI: OFF · smart rules + search</span>
          <span className="text-accent">ENABLE ▾</span>
        </summary>
        <div className="mt-2">{cloudOffRow}{controls}</div>
        <div className="mt-1 text-zinc-600">{note}</div>
      </details>
      </div>
    );
  }

  return (
    <div className={base}>
      {limitedRow}
      {cloudOffRow}
      {controls}
      <div className="mt-1 text-zinc-600">{note}</div>
    </div>
  );
}
