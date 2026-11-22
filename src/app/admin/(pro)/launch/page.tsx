// src/app/admin/(pro)/launch/page.tsx — Launch Pad: readiness score and the exact steps still left, in order.
'use client';
import { useState } from 'react';
import Icon from '@/components/ui/Icon';
import { api, useApi } from '@/lib/admin/client';
import type { Mission } from '@/lib/admin/launch';
import { AButton, Badge, Card, CopyBtn, ErrorBox, PageHead, Skel } from '@/components/admin/ui';

interface LiveCheck { id: string; title: string; ok: boolean | null; detail: string; fix?: string; ms: number }
interface Launch { missions: Mission[]; score: number; done: number; total: number; next: Mission | null; level: string }

function Ring({ value }: { value: number }) {
  const r = 52, c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 120 120" className="h-32 w-32 shrink-0" role="img" aria-label={`${value} percent ready`}>
      <circle cx="60" cy="60" r={r} fill="none" stroke="currentColor" strokeWidth="8" className="text-zinc-800" />
      <circle cx="60" cy="60" r={r} fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} transform="rotate(-90 60 60)" className="text-accent transition-[stroke-dashoffset] duration-700" />
      <text x="60" y="66" textAnchor="middle" className="fill-zinc-100 font-mono text-[26px] font-bold">{value}%</text>
    </svg>
  );
}

export default function LaunchPage() {
  const { data, error, reload } = useApi<Launch>('/api/admin/launch');
  const [open, setOpen] = useState<string | null>(null);
  const [checks, setChecks] = useState<LiveCheck[] | null>(null);
  const [probing, setProbing] = useState(false);
  const [probeErr, setProbeErr] = useState('');
  const probe = async () => {
    setProbing(true); setProbeErr('');
    try {
      const r = await api<{ checks: LiveCheck[]; busy?: boolean }>('/api/admin/launch', { method: 'POST', body: {} });
      if (r.busy) setProbeErr('Just ran. Wait a few seconds and try again.'); else setChecks(r.checks);
    } catch (e) { setProbeErr(e instanceof Error ? e.message : 'Could not run the checks.'); }
    setProbing(false);
  };
  const missing = data?.missions.filter((m) => !m.done) ?? [];
  const envBlock = missing.flatMap((m) => m.env).filter((v, i, a) => a.indexOf(v) === i).map((k) => `${k}=`).join('\n');
  return (
    <>
      <PageHead title="Launch Pad" sub="How close is the site to fully live, and what exactly is left." icon="bolt" right={<AButton icon="refresh" small onClick={reload}>Re-check</AButton>} />
      {error && <ErrorBox text={error} retry={reload} />}
      {!data && !error && <Skel h="h-64" />}
      {data && (
        <div className="space-y-4">
          <Card>
            <div className="flex flex-wrap items-center gap-5">
              <Ring value={data.score} />
              <div className="min-w-0 flex-1">
                <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Status</div>
                <div className="font-mono text-2xl font-bold text-accent">{data.level}</div>
                <p className="mt-1 text-sm text-zinc-400">{data.done} of {data.total} missions complete.</p>
                {data.next ? (
                  <button type="button" onClick={() => setOpen(data.next!.id)} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg border border-accent/40 bg-accent/10 px-3 font-mono text-xs text-accent transition hover:bg-accent/20"><Icon name="play" size={13} />Next: {data.next.title}</button>
                ) : <p className="mt-3 font-mono text-xs text-emerald-300">Everything is switched on. Nothing left to do here.</p>}
              </div>
            </div>
          </Card>

          <Card title="Live checks" icon="bolt" right={<AButton icon="refresh" small onClick={probe} disabled={probing}>{probing ? 'Testing…' : 'Run live checks'}</AButton>}>
            <p className="text-xs text-zinc-500">Tests the real connections from your live server: storage, internet answers, email and your public address. Nothing is changed or sent.</p>
            {probeErr && <p role="alert" className="mt-2 text-xs text-amber-400">{probeErr}</p>}
            {checks && (
              <ul className="mt-3 space-y-2">
                {checks.map((c) => (
                  <li key={c.id} className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
                    <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-zinc-100">{c.title}<Badge tone={c.ok ? 'ok' : c.ok === null ? 'default' : 'bad'}>{c.ok ? 'working' : c.ok === null ? 'not set up' : 'problem'}</Badge><span className="font-mono text-[10px] text-zinc-600">{c.ms} ms</span></div>
                    <p className="mt-1 text-xs text-zinc-400">{c.detail}</p>
                    {c.fix && !c.ok && <p className="mt-1 text-xs text-amber-300">Fix: {c.fix}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <div className="grid gap-3 lg:grid-cols-2">
            {data.missions.map((m) => {
              const isOpen = open === m.id;
              return (
                <div key={m.id} className={`rounded-xl border p-4 ${m.done ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-zinc-800 bg-zinc-900/40'}`}>
                  <button type="button" onClick={() => setOpen(isOpen ? null : m.id)} className="flex w-full items-start gap-3 text-left" aria-expanded={isOpen}>
                    <Icon name={m.done ? 'check' : 'bell'} size={16} className={`mt-0.5 shrink-0 ${m.done ? 'text-emerald-300' : m.optional ? 'text-amber-300' : 'text-rose-300'}`} />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-zinc-100">{m.title}<Badge tone={m.done ? 'ok' : m.optional ? 'default' : 'bad'}>{m.done ? 'done' : m.optional ? 'optional' : 'to do'}</Badge></span>
                      <span className="mt-0.5 block text-xs text-zinc-500">{m.why}</span>
                    </span>
                  </button>
                  {isOpen && !m.done && (
                    <div className="mt-3 border-t border-zinc-800 pt-3">
                      <ol className="list-decimal space-y-1.5 pl-5 text-xs text-zinc-300">{m.steps.map((s) => <li key={s}>{s}</li>)}</ol>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {m.link && <a href={m.link.href} target={m.link.href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer" className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-zinc-700 px-3 font-mono text-xs text-zinc-200 transition hover:border-accent/50">{m.link.label}<Icon name="external" size={12} /></a>}
                        {m.env.length > 0 && <CopyBtn text={m.env.map((k) => `${k}=`).join('\n')} label="Copy variable names" />}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {envBlock && (
            <Card title="Everything still missing, in one block" icon="key" right={<CopyBtn text={envBlock} label="Copy all" />}>
              <pre className="overflow-x-auto rounded-lg bg-zinc-950 p-3 font-mono text-xs text-zinc-300">{envBlock}</pre>
              <p className="mt-2 text-[11px] text-zinc-500">Paste into Vercel → Settings → Environment Variables (Vercel accepts a pasted .env block), fill in the values, then redeploy. Values are never shown here.</p>
            </Card>
          )}
        </div>
      )}
    </>
  );
}
