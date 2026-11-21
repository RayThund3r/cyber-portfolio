// src/components/admin/CloudAiCard.tsx — status and test bench for the server-hosted chat model (see /inference).
'use client';
import { useState } from 'react';
import { api, useApi } from '@/lib/admin/client';
import { AButton, Badge, Card, Skel, inputCls, useToast } from '@/components/admin/ui';

interface St { configured: boolean; ok: boolean; pingMs: number; host: string; model: string; label: string; keySet: boolean; maxTokens: number; ratePerMin: number }
interface Test { text: string; firstTokenMs: number; totalMs: number; wordsPerSec: number }

export default function CloudAiCard() {
  const toast = useToast();
  const st = useApi<St>('/api/admin/llm');
  const [prompt, setPrompt] = useState('How long does a phone screen repair usually take?');
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<Test | null>(null);
  const d = st.data;
  const run = async () => {
    setBusy(true); setRes(null);
    try { setRes(await api<Test>('/api/admin/llm', { method: 'POST', body: { prompt } })); }
    catch (e) { toast(e instanceof Error ? e.message : 'Test failed', 'err'); }
    finally { setBusy(false); }
  };
  return (
    <Card title="Cloud AI (server-hosted model)" icon="cpu" className="md:col-span-2"
      right={d ? <Badge tone={!d.configured ? 'default' : d.ok ? 'ok' : 'bad'}>{!d.configured ? 'NOT SET UP' : d.ok ? 'ONLINE' : 'UNREACHABLE'}</Badge> : undefined}>
      {!d ? <Skel h="h-20" /> : !d.configured ? (
        <p className="text-sm leading-relaxed text-zinc-400">No server of your own is set. Free AI services (Groq, Gemini, OpenRouter…) are managed on the <a className="text-accent underline" href="/admin/ai-providers">AI Providers</a> page: add a free key there and switch the service on, no redeploy needed.</p>
      ) : (
        <div className="space-y-3">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[11px] text-zinc-400 sm:grid-cols-4">
            <div><dt className="text-zinc-600">HOST</dt><dd className="truncate text-zinc-200">{d.host}</dd></div>
            <div><dt className="text-zinc-600">MODEL</dt><dd className="truncate text-zinc-200">{d.model}</dd></div>
            <div><dt className="text-zinc-600">PING</dt><dd className="text-zinc-200">{d.ok ? `${d.pingMs} ms` : '—'}</dd></div>
            <div><dt className="text-zinc-600">LIMITS</dt><dd className="text-zinc-200">{d.maxTokens} tok · {d.ratePerMin}/min{d.keySet ? ' · key set' : ''}</dd></div>
          </dl>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input className={inputCls} value={prompt} maxLength={300} onChange={(e) => setPrompt(e.target.value)} aria-label="Test prompt" />
            <AButton variant="solid" icon="play" onClick={run} disabled={busy || !prompt.trim()}>{busy ? 'Waiting…' : 'Test'}</AButton>
            <AButton onClick={st.reload} icon="refresh">Re-check</AButton>
          </div>
          {res && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
              <div className="mb-2 flex flex-wrap gap-3 font-mono text-[11px] text-zinc-500"><span>first word {res.firstTokenMs} ms</span><span>total {(res.totalMs / 1000).toFixed(1)} s</span><span>{res.wordsPerSec} words/s</span></div>
              <p className="whitespace-pre-wrap text-sm text-zinc-200">{res.text || '(empty answer)'}</p>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
