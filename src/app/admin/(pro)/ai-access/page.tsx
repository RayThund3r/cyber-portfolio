// src/app/admin/(pro)/ai-access/page.tsx — daily limits for the cloud model, plans, access codes, and payment approvals.
'use client';
import { useEffect, useState } from 'react';
import { api, relTime, useApi } from '@/lib/admin/client';
import { AButton, Badge, Bars, Card, CopyBtn, Empty, ErrorBox, Field, Notice, PageHead, Skel, Stat, Toggle, inputCls, useToast } from '@/components/admin/ui';

interface Plan { id: string; name: string; price: string; messages: number; days: number; note: string }
interface Cfg { enabled: boolean; dailyFree: number; ipDailyCap: number; maxDevicesPerPass: number; plans: Plan[]; payInfo: string }
interface Pass { code: string; plan: string; label: string; messages: number; used: number; expires: number; created: number; note: string; revoked: boolean; devices: string[] }
interface Req { id: string; plan: string; name: string; contact: string; txId: string; at: number; status: 'pending' | 'approved' | 'rejected'; code?: string }
interface Data { config: Cfg; passes: Pass[]; requests: Req[]; today: { day: string; total: number; paid: number; devices: number }; history: Array<{ day: string; total: number; paid: number; devices: number }> }

export default function AiAccessPage() {
  const toast = useToast();
  const q = useApi<Data>('/api/admin/ai-access', { every: 30000 });
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [busy, setBusy] = useState(false);
  const [planId, setPlanId] = useState('');
  const [count, setCount] = useState(1);
  const [note, setNote] = useState('');
  const [fresh, setFresh] = useState<string[]>([]);
  useEffect(() => { if (q.data && !cfg) { setCfg(q.data.config); setPlanId(q.data.config.plans[0]?.id || ''); } }, [q.data, cfg]);

  const act = async (body: Record<string, unknown>, ok: string) => {
    setBusy(true);
    try { const r = await api<Record<string, unknown>>('/api/admin/ai-access', { method: 'POST', body }); toast(ok, 'ok'); q.reload(); return r; }
    catch (e) { toast(e instanceof Error ? e.message : 'Failed', 'err'); return null; }
    finally { setBusy(false); }
  };

  if (q.error && !q.data) return <div className="p-4"><ErrorBox text={q.error} retry={q.reload} /></div>;
  if (!q.data || !cfg) return <div className="space-y-4 p-4"><Skel h="h-24" /><Skel h="h-64" /></div>;
  const d = q.data;
  const pending = d.requests.filter((r) => r.status === 'pending');
  const setPlan = (i: number, patch: Partial<Plan>) => setCfg({ ...cfg, plans: cfg.plans.map((p, j) => (j === i ? { ...p, ...patch } : p)) });
  const planName = (id: string) => cfg.plans.find((p) => p.id === id)?.name || id;
  const num = (v: string) => Math.max(0, Math.floor(Number(v) || 0));

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <PageHead title="AI Access" icon="key" sub="Daily free answers, paid passes, and who is using the cloud model." />
      <Notice tone="info" title="How it works">
        Every visitor gets {cfg.dailyFree} AI answers a day. After that the chat keeps working on the built-in rules (nothing breaks). People can unlock more with a code you give them, or by paying and sending a transaction id for you to approve here. Limits are kept in storage — connect free Upstash Redis in Health to keep them across restarts.
      </Notice>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="AI answers today" value={d.today.total} icon="brain" />
        <Stat label="Visitors using AI" value={d.today.devices} icon="user" />
        <Stat label="From passes" value={d.today.paid} icon="key" />
        <Stat label="Waiting for approval" value={pending.length} icon="bell" />
      </div>

      {pending.length > 0 && (
        <Card title="Payments waiting for you" icon="bell" right={<Badge tone="warn">{pending.length}</Badge>}>
          <ul className="divide-y divide-zinc-800">
            {pending.map((r) => (
              <li key={r.id} className="flex flex-col gap-2 py-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 text-sm">
                  <div className="text-zinc-100">{r.name} · <span className="text-accent">{planName(r.plan)}</span></div>
                  <div className="font-mono text-[11px] text-zinc-500">{r.contact} · tx {r.txId} · {relTime(r.at)}</div>
                </div>
                <div className="flex gap-2">
                  <AButton variant="solid" icon="check" disabled={busy} onClick={() => act({ action: 'approve', id: r.id }, 'Approved — the pass is active on their device')}>Approve</AButton>
                  <AButton danger disabled={busy} onClick={() => act({ action: 'reject', id: r.id }, 'Rejected')}>Reject</AButton>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-zinc-500">Check the transaction id in your mobile-money messages before approving. Approving unlocks the pass on the visitor's own device automatically.</p>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Limits" icon="shield">
          <div className="space-y-3">
            <Toggle checked={cfg.enabled} onChange={(v) => setCfg({ ...cfg, enabled: v })} label="Enforce daily limits" hint="Off = everyone gets unlimited cloud AI (the old behaviour)." />
            <div className="grid grid-cols-3 gap-3">
              <Field label="Free / day"><input className={inputCls} inputMode="numeric" value={cfg.dailyFree} onChange={(e) => setCfg({ ...cfg, dailyFree: num(e.target.value) })} /></Field>
              <Field label="Per IP / day" hint="blocks cookie-clearing"><input className={inputCls} inputMode="numeric" value={cfg.ipDailyCap} onChange={(e) => setCfg({ ...cfg, ipDailyCap: num(e.target.value) })} /></Field>
              <Field label="Devices / pass"><input className={inputCls} inputMode="numeric" value={cfg.maxDevicesPerPass} onChange={(e) => setCfg({ ...cfg, maxDevicesPerPass: num(e.target.value) })} /></Field>
            </div>
            <Field label="Payment instructions shown to visitors" hint="e.g. Send to MTN MoMo 07xx xxx xxx (name). Then paste the transaction id.">
              <textarea className={`${inputCls} min-h-20 py-2`} maxLength={600} value={cfg.payInfo} onChange={(e) => setCfg({ ...cfg, payInfo: e.target.value })} />
            </Field>
          </div>
        </Card>

        <Card title="Plans" icon="grid" right={cfg.plans.length < 8 ? <AButton small onClick={() => setCfg({ ...cfg, plans: [...cfg.plans, { id: `plan${cfg.plans.length + 1}`, name: 'New plan', price: '', messages: 100, days: 30, note: '' }] })}>Add</AButton> : undefined}>
          <div className="space-y-3">
            {cfg.plans.map((p, i) => (
              <div key={i} className="rounded-lg border border-zinc-800 p-2.5">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <input className={inputCls} aria-label="Name" value={p.name} onChange={(e) => setPlan(i, { name: e.target.value, id: p.id.startsWith('plan') ? e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '') || p.id : p.id })} />
                  <input className={inputCls} aria-label="Price" placeholder="UGX 5,000" value={p.price} onChange={(e) => setPlan(i, { price: e.target.value })} />
                  <input className={inputCls} aria-label="Answers (0 = unlimited)" title="Answers (0 = unlimited)" inputMode="numeric" value={p.messages} onChange={(e) => setPlan(i, { messages: num(e.target.value) })} />
                  <input className={inputCls} aria-label="Days" title="Days valid" inputMode="numeric" value={p.days} onChange={(e) => setPlan(i, { days: num(e.target.value) })} />
                </div>
                <div className="mt-2 flex gap-2">
                  <input className={inputCls} aria-label="Description" placeholder="Shown to visitors" value={p.note} onChange={(e) => setPlan(i, { note: e.target.value })} />
                  <AButton danger small onClick={() => setCfg({ ...cfg, plans: cfg.plans.filter((_, j) => j !== i) })}>Remove</AButton>
                </div>
              </div>
            ))}
            <p className="text-xs text-zinc-500">Answers 0 = unlimited. Prices are just text; payment is manual.</p>
          </div>
        </Card>
      </div>
      <div className="flex justify-end"><AButton variant="solid" icon="check" disabled={busy} onClick={async () => { const r = await act({ action: 'saveConfig', config: cfg }, 'Saved'); if (r?.config) setCfg(r.config as Cfg); }}>Save limits and plans</AButton></div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Create access codes" icon="key">
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <Field label="Plan"><select className={inputCls} value={planId} onChange={(e) => setPlanId(e.target.value)}>{d.config.plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
              <Field label="How many"><input className={inputCls} inputMode="numeric" value={count} onChange={(e) => setCount(Math.min(50, Math.max(1, num(e.target.value))))} /></Field>
              <Field label="Note"><input className={inputCls} maxLength={120} placeholder="who it is for" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
            </div>
            <AButton variant="solid" icon="key" disabled={busy || !planId} onClick={async () => { const r = await act({ action: 'createPass', plan: planId, count, note }, 'Codes created'); if (r?.codes) setFresh(r.codes as string[]); }}>Generate</AButton>
            {fresh.length > 0 && (
              <div className="rounded-lg border border-accent/40 bg-zinc-950 p-3">
                <div className="mb-1 flex items-center justify-between text-xs text-zinc-400">New codes — send them to the customer<CopyBtn text={fresh.join('\n')} label="Copy all" /></div>
                <ul className="font-mono text-sm text-accent">{fresh.map((c) => <li key={c}>{c}</li>)}</ul>
              </div>
            )}
            <p className="text-xs text-zinc-500">The pass clock starts when the customer first enters the code. Unused codes never expire on their own.</p>
          </div>
        </Card>
        <Card title="Last 7 days" icon="grid">
          <Bars items={d.history.map((h) => ({ name: h.day.slice(5), n: h.total }))} empty="No AI answers yet" />
        </Card>
      </div>

      <Card title="Passes" icon="key" right={<Badge>{d.passes.length}</Badge>} pad={false}>
        {d.passes.length === 0 ? <Empty icon="key" title="No passes yet" text="Generate a code above or approve a payment." /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="font-mono text-[10px] uppercase text-zinc-500"><tr><th className="p-3">Code</th><th>Plan</th><th>Used</th><th>Devices</th><th>Expires</th><th /></tr></thead>
              <tbody>
                {d.passes.map((p) => (
                  <tr key={p.code} className="border-t border-zinc-800/70">
                    <td className="p-3 font-mono text-xs text-zinc-200">{p.code}<div className="text-[10px] text-zinc-600">{p.note}</div></td>
                    <td>{p.label}{p.revoked && <> <Badge tone="bad">CANCELLED</Badge></>}</td>
                    <td className="font-mono text-xs">{p.messages === 0 ? `${p.used}/∞` : `${p.used}/${p.messages}`}</td>
                    <td className="font-mono text-xs">{p.devices.length}</td>
                    <td className="font-mono text-xs text-zinc-400">{p.expires ? (p.expires < Date.now() ? 'expired' : new Date(p.expires).toLocaleDateString()) : 'not used yet'}</td>
                    <td className="space-x-1 pr-3 text-right">
                      <CopyBtn text={p.code} />
                      {!p.revoked && <AButton small danger disabled={busy} onClick={() => act({ action: 'revoke', code: p.code }, 'Cancelled')}>Cancel</AButton>}
                      <AButton small disabled={busy} onClick={() => act({ action: 'delete', code: p.code }, 'Deleted')}>Delete</AButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
