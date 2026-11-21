// src/app/admin/(pro)/ai-providers/page.tsx — free AI services the chat can use. Switch each on/off, order them, cap them, test them.
'use client';
import { useState } from 'react';
import { api, useApi } from '@/lib/admin/client';
import { AButton, Badge, Card, ErrorBox, Field, Notice, PageHead, Skel, Stat, Toggle, inputCls, useToast } from '@/components/admin/ui';

interface Use { ok: number; fail: number; skipped: number; last?: string }
interface Item { id: string; name: string; enabled: boolean; custom: boolean; model: string; baseUrl: string; dailyCap: number; keySet: boolean; keyTail: string; keyLost: boolean; links: { signup: string; keys: string; docs: string } | null; note: string; today: Use; coolingMs: number }
interface Data { master: boolean; items: Item[]; order: string[]; env: { configured: boolean; enabled: boolean; host: string; model: string; today: Use }; day: string }
interface TestRes { ok: boolean; text?: string; firstTokenMs?: number; totalMs?: number; error?: string }

export default function AiProvidersPage() {
  const toast = useToast();
  const q = useApi<Data>('/api/admin/llm-providers', { every: 30000 });
  const [busy, setBusy] = useState('');
  const [tests, setTests] = useState<Record<string, TestRes>>({});
  const [newName, setNewName] = useState(''); const [newUrl, setNewUrl] = useState('');

  const act = async (body: Record<string, unknown>, ok?: string) => {
    setBusy(String(body.id || body.action));
    try { const r = await api<Record<string, unknown>>('/api/admin/llm-providers', { method: 'POST', body }); if (ok) toast(ok, 'ok'); q.reload(); return r; }
    catch (e) { toast(e instanceof Error ? e.message : 'Failed', 'err'); return null; }
    finally { setBusy(''); }
  };
  if (q.error && !q.data) return <div className="p-4"><ErrorBox text={q.error} retry={q.reload} /></div>;
  if (!q.data) return <div className="space-y-4 p-4"><Skel h="h-24" /><Skel h="h-64" /></div>;
  const d = q.data;
  const active = d.items.filter((i) => i.enabled && i.keySet).length + (d.env.configured && d.env.enabled ? 1 : 0);
  const total = d.items.reduce((n, i) => n + i.today.ok, 0) + d.env.today.ok;
  const fails = d.items.reduce((n, i) => n + i.today.fail, 0) + d.env.today.fail;
  const ids = d.order.concat(d.items.map((i) => i.id).filter((x) => !d.order.includes(x)));
  const move = (id: string, dir: -1 | 1) => { const o = ids.slice(); const i = o.indexOf(id), j = i + dir; if (i < 0 || j < 0 || j >= o.length) return; [o[i], o[j]] = [o[j], o[i]]; void act({ action: 'order', order: o }); };
  const test = async (id: string) => { setBusy('test:' + id); try { const r = await api<TestRes>('/api/admin/llm-providers', { method: 'POST', body: { action: 'test', id } }); setTests((t) => ({ ...t, [id]: r })); q.reload(); } catch (e) { setTests((t) => ({ ...t, [id]: { ok: false, error: e instanceof Error ? e.message : 'Failed' } })); } finally { setBusy(''); } };
  const pos = (id: string) => ids.indexOf(id) + 1;

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <PageHead title="AI Providers" icon="cpu" sub="Free AI services your chat can use. Switch each on or off, set the order they are tried in, and cap what each may serve per day." right={<Toggle checked={d.master} onChange={(v) => void act({ action: 'master', value: v }, v ? 'Cloud AI is ON' : 'Cloud AI is OFF: the chat uses its built-in engine')} label="Cloud AI" />} />
      {!d.master && <Notice tone="warn" title="Cloud AI is switched off">Visitors get the built-in answers engine (and the on-device model if they chose it). Nothing below is used until you switch it back on.</Notice>}
      <Notice tone="info" title="How it works">
        The chat asks the first switched-on service. If it is out of free quota, slow or broken, the next one answers, and if none can, the built-in engine does. Keys are stored encrypted on the server and never shown to visitors. Free plans change often: check each provider's page for current limits, and set a daily cap below their limit so you never hit it by surprise. Visitors' messages go to the service that answers, so say so on your privacy page.
      </Notice>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Switched on" value={active} icon="bolt" />
        <Stat label="AI answers today" value={total} icon="brain" />
        <Stat label="Failures today" value={fails} icon="bell" />
        <Stat label="Order" value={ids.length} icon="grid" hint="services listed" />
      </div>

      <div className="space-y-3">
        {d.env.configured && (
          <Card title={`Your own server (set in Vercel)`} icon="cpu" right={<Badge tone={d.env.enabled ? 'ok' : 'default'}>{d.env.enabled ? 'ON' : 'OFF'}</Badge>}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="font-mono text-xs text-zinc-400">{d.env.host} · {d.env.model} · today {d.env.today.ok} ok / {d.env.today.fail} failed</div>
              <div className="flex items-center gap-2"><Toggle checked={d.env.enabled} onChange={(v) => void act({ action: 'env', value: v })} label="Use it" /><AButton small icon="play" disabled={busy === 'test:env'} onClick={() => test('env')}>{busy === 'test:env' ? 'Testing…' : 'Test'}</AButton></div>
            </div>
            <TestBox r={tests.env} />
          </Card>
        )}
        {ids.map((id) => { const p = d.items.find((i) => i.id === id); return p ? <ProviderCard key={p.id} p={p} pos={pos(p.id)} last={pos(p.id) === ids.length} busy={busy} onMove={move} onAct={act} onTest={test} test={tests[p.id]} /> : null; })}
      </div>

      <Card title="Add another service" icon="puzzle">
        <p className="mb-3 text-xs text-zinc-500">Any service that speaks the OpenAI chat format (many do). Use its public https address, for example ending in /v1.</p>
        <div className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
          <input className={inputCls} placeholder="Name" maxLength={40} value={newName} onChange={(e) => setNewName(e.target.value)} aria-label="Name" />
          <input className={inputCls} placeholder="https://api.example.com/v1" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} aria-label="Address" />
          <AButton variant="solid" icon="check" disabled={!newUrl.trim() || busy === 'addCustom'} onClick={async () => { const r = await act({ action: 'addCustom', name: newName, baseUrl: newUrl }, 'Added. Now give it a key and model.'); if (r) { setNewName(''); setNewUrl(''); } }}>Add</AButton>
        </div>
      </Card>
    </div>
  );
}

function TestBox({ r }: { r?: TestRes }) {
  if (!r) return null;
  return (
    <div className={`mt-3 rounded-lg border p-3 text-sm ${r.ok ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-red-500/30 bg-red-500/5'}`} role="status">
      {r.ok ? <><div className="mb-1 font-mono text-[11px] text-zinc-500">first word {r.firstTokenMs} ms · total {((r.totalMs || 0) / 1000).toFixed(1)} s</div><p className="whitespace-pre-wrap text-zinc-200">{r.text}</p></> : <p className="text-red-300">{r.error}</p>}
    </div>
  );
}

function ProviderCard({ p, pos, last, busy, onMove, onAct, onTest, test }: { p: Item; pos: number; last: boolean; busy: string; onMove: (id: string, d: -1 | 1) => void; onAct: (b: Record<string, unknown>, ok?: string) => Promise<unknown>; onTest: (id: string) => void; test?: TestRes }) {
  const [key, setKey] = useState(''); const [model, setModel] = useState(p.model); const [cap, setCap] = useState(String(p.dailyCap)); const [url, setUrl] = useState(p.baseUrl);
  const dirty = !!key || model !== p.model || cap !== String(p.dailyCap) || (p.custom && url !== p.baseUrl);
  const save = () => onAct({ action: 'save', id: p.id, key: key || undefined, model, dailyCap: Number(cap) || 0, ...(p.custom ? { baseUrl: url } : {}) }, 'Saved').then((r) => { if (r) setKey(''); });
  const tone = p.enabled && p.keySet ? (p.coolingMs > 0 ? 'warn' : 'ok') : 'default';
  return (
    <Card title={`${pos}. ${p.name}`} icon="cpu" right={<Badge tone={tone}>{p.enabled && p.keySet ? (p.coolingMs > 0 ? 'RESTING' : 'ON') : 'OFF'}</Badge>}>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="max-w-xl text-xs text-zinc-500">{p.note}</p>
          <div className="flex items-center gap-1">
            <AButton small title="Try this one earlier" disabled={pos === 1} onClick={() => onMove(p.id, -1)}>↑</AButton>
            <AButton small title="Try this one later" disabled={last} onClick={() => onMove(p.id, 1)}>↓</AButton>
          </div>
        </div>
        {p.links && (
          <div className="flex flex-wrap gap-2 text-xs">
            <a className="rounded border border-zinc-700 px-2.5 py-1.5 text-accent hover:border-accent" href={p.links.keys} target="_blank" rel="noopener noreferrer">① Get a free key ↗</a>
            <a className="rounded border border-zinc-700 px-2.5 py-1.5 text-zinc-300 hover:border-accent" href={p.links.signup} target="_blank" rel="noopener noreferrer">Sign up ↗</a>
            <a className="rounded border border-zinc-700 px-2.5 py-1.5 text-zinc-300 hover:border-accent" href={p.links.docs} target="_blank" rel="noopener noreferrer">Model list &amp; limits ↗</a>
          </div>
        )}
        {p.keyLost && <Notice tone="warn" title="Saved key can't be read">The admin secret changed since this key was saved. Paste it again.</Notice>}
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="API key" hint={p.keySet ? `saved (ends …${p.keyTail}). Paste a new one to replace it.` : 'paste the key you copied'}>
            <input className={inputCls} type="password" autoComplete="off" spellCheck={false} placeholder={p.keySet ? '••••••••••' : 'paste key'} value={key} onChange={(e) => setKey(e.target.value)} />
          </Field>
          <Field label="Model" hint="exact name from the provider's model list"><input className={inputCls} value={model} spellCheck={false} onChange={(e) => setModel(e.target.value)} /></Field>
          {p.custom && <Field label="Address"><input className={inputCls} value={url} spellCheck={false} onChange={(e) => setUrl(e.target.value)} /></Field>}
          <Field label="Daily cap" hint="max answers per day from this service (0 = no cap)"><input className={inputCls} inputMode="numeric" value={cap} onChange={(e) => setCap(e.target.value.replace(/\D/g, ''))} /></Field>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <Toggle checked={p.enabled} onChange={(v) => void onAct({ action: 'save', id: p.id, enabled: v }, v ? `${p.name} is ON` : `${p.name} is OFF`)} label="Use this service" />
            <span className="font-mono text-[11px] text-zinc-500">today {p.today.ok} ok · {p.today.fail} failed</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {p.keySet && <AButton small danger disabled={!!busy} onClick={() => onAct({ action: 'save', id: p.id, clearKey: true, enabled: false }, 'Key removed')}>Remove key</AButton>}
            {p.custom && <AButton small danger disabled={!!busy} onClick={() => onAct({ action: 'removeCustom', id: p.id }, 'Removed')}>Delete</AButton>}
            <AButton small icon="play" disabled={busy === 'test:' + p.id || !p.keySet || dirty} title={dirty ? 'Save first' : undefined} onClick={() => onTest(p.id)}>{busy === 'test:' + p.id ? 'Testing…' : 'Test'}</AButton>
            <AButton small variant="solid" icon="check" disabled={!dirty || !!busy} onClick={save}>Save</AButton>
          </div>
        </div>
        {p.today.last && p.today.fail > 0 && <p className="font-mono text-[11px] text-amber-300/80">last error: {p.today.last}</p>}
        <TestBox r={test} />
      </div>
    </Card>
  );
}
