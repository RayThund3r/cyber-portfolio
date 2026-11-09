// src/app/admin/site/page.tsx — announcement bar, availability, and a content health check of projects and services.
'use client';
import { useEffect, useMemo, useState } from 'react';
import { api, useApi } from '@/lib/admin/client';
import type { SiteConfig } from '@/lib/admin/siteconfig';
import { lintContent } from '@/lib/admin/derive';
import { ALL_PROJECTS } from '@/data/portfolioData';
import { SERVICES } from '@/data/servicesData';
import { Bar } from '@/components/layout/AnnouncementBar';
import { AButton, Badge, Card, ErrorBox, Field, inputCls, Notice, PageHead, Skel, Toggle, useToast } from '@/components/admin/ui';

const PRESETS: Array<{ label: string; text: string; level: SiteConfig['announce']['level'] }> = [
  { label: 'Closed today', text: 'Closed today. Messages are still read and answered the next working day.', level: 'warn' },
  { label: 'Holiday', text: 'On holiday until further notice. Repairs and orders resume when I am back.', level: 'info' },
  { label: 'Booking open', text: 'Booking is open: send a message to reserve your repair slot this week.', level: 'success' },
  { label: 'Fully booked', text: 'Fully booked this week. New requests are scheduled for the following week.', level: 'warn' },
];
const toLocal = (ms: number) => { if (!ms) return ''; const d = new Date(ms - new Date(ms).getTimezoneOffset() * 60000); return d.toISOString().slice(0, 16); };

export default function SitePage() {
  const toast = useToast();
  const { data, error, reload } = useApi<{ config: SiteConfig }>('/api/admin/config');
  const [c, setC] = useState<SiteConfig | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (data) setC(data.config); }, [data]);
  const dirty = !!c && !!data && JSON.stringify(c) !== JSON.stringify(data.config);
  const lint = useMemo(() => lintContent(ALL_PROJECTS, SERVICES), []);

  const save = async (next = c) => {
    if (!next) return; setSaving(true);
    try { const r = await api<{ config: SiteConfig }>('/api/admin/config', { method: 'PUT', body: { config: next } }); setC(r.config); reload(); toast('Saved. Visitors see it within a minute.'); }
    catch (e) { toast(e instanceof Error ? e.message : 'Save failed', 'err'); } finally { setSaving(false); }
  };
  const a = c?.announce;
  const set = (patch: Partial<SiteConfig['announce']>) => setC((x) => (x ? { ...x, announce: { ...x.announce, ...patch } } : x));
  const expireIn = (h: number) => set({ expires: Date.now() + h * 3600_000 });

  return (
    <>
      <PageHead title="Site" sub="Change what visitors see without touching code or redeploying." icon="wrench" right={c && <AButton variant="solid" icon="check" onClick={() => save()} disabled={!dirty || saving}>{saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}</AButton>} />
      {error && <ErrorBox text={error} retry={reload} />}
      {!c && !error && <Skel h="h-72" />}
      {c && a && (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Announcement bar" icon="bell">
              <div className="space-y-3">
                <Toggle checked={a.enabled} onChange={(v) => set({ enabled: v })} label="Show the announcement" hint="Appears above every page of the public site." />
                <div className="flex flex-wrap gap-1.5">{PRESETS.map((p) => <AButton key={p.label} small onClick={() => set({ text: p.text, level: p.level, enabled: true })}>{p.label}</AButton>)}</div>
                <Field label="Message" hint={`${a.text.length}/240`}><textarea value={a.text} maxLength={240} rows={2} onChange={(e) => set({ text: e.target.value })} className={`${inputCls} resize-y`} /></Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Style"><select value={a.level} onChange={(e) => set({ level: e.target.value as SiteConfig['announce']['level'] })} className={inputCls}><option value="info">Info</option><option value="success">Good news</option><option value="warn">Heads-up</option><option value="alert">Urgent</option></select></Field>
                  <Field label="Link (optional)" hint="/services or https://…"><input value={a.href} onChange={(e) => set({ href: e.target.value })} placeholder="/contact" className={inputCls} /></Field>
                </div>
                <Field label="Hide automatically on" hint={a.expires ? `In ${Math.max(0, Math.round((a.expires - Date.now()) / 3600000))} h` : 'Stays until you switch it off'}>
                  <div className="flex flex-wrap items-center gap-2"><input type="datetime-local" value={toLocal(a.expires)} onChange={(e) => set({ expires: e.target.value ? new Date(e.target.value).getTime() : 0 })} className={`${inputCls} max-w-[15rem]`} />{[['1 h', 1], ['1 day', 24], ['1 week', 168]].map(([l, h]) => <AButton key={String(l)} small onClick={() => expireIn(Number(h))}>{l}</AButton>)}<AButton small onClick={() => set({ expires: 0 })}>Never</AButton></div></Field>
                <Toggle checked={a.dismissible} onChange={(v) => set({ dismissible: v })} label="Visitors can dismiss it" />
              </div>
            </Card>
            <div className="space-y-4">
              <Card title="Live preview" icon="search"><div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">{a.text ? <Bar data={{ text: a.text, level: a.level, href: a.href, dismissible: a.dismissible, id: 'p' }} onDismiss={() => undefined} /> : <p className="p-6 text-center text-xs text-zinc-600">Write a message to preview it.</p>}<div className="space-y-2 p-4 opacity-40"><div className="h-3 w-1/3 rounded bg-zinc-700" /><div className="h-2 w-2/3 rounded bg-zinc-800" /><div className="h-2 w-1/2 rounded bg-zinc-800" /></div></div></Card>
              <Card title="Availability" icon="clock">
                <div className="space-y-3"><div className="flex gap-2" role="radiogroup" aria-label="Availability">{(['available', 'busy', 'away'] as const).map((v) => <button key={v} role="radio" aria-checked={c.availability === v} type="button" onClick={() => setC({ ...c, availability: v })} className={`flex-1 cursor-pointer rounded-lg border px-3 py-2 font-mono text-xs capitalize transition ${c.availability === v ? 'border-accent bg-accent/15 text-accent' : 'border-zinc-700 text-zinc-400 hover:text-zinc-200'}`}>{v}</button>)}</div>
                  <Field label="Note (optional)"><input value={c.availabilityNote} maxLength={120} onChange={(e) => setC({ ...c, availabilityNote: e.target.value })} placeholder="e.g. Back online Monday 9am" className={inputCls} /></Field>
                  <p className="text-[11px] text-zinc-500">Saved with the announcement and available to the public site at <code className="text-zinc-400">/api/site-config</code>.</p></div>
              </Card>
            </div>
          </div>
          <Card title={`Content check (${lint.filter((l) => l.level === 'warn').length} to fix, ${lint.filter((l) => l.level === 'info').length} ideas)`} icon="lightbulb" pad={false}>
            {lint.length === 0 ? <p className="p-6 text-center text-sm text-emerald-300">Every project and service looks complete.</p> : <ul className="max-h-96 divide-y divide-zinc-800/70 overflow-y-auto">{lint.map((l, i) => <li key={i} className="flex items-baseline gap-3 px-4 py-2 text-sm"><Badge tone={l.level === 'warn' ? 'warn' : 'default'}>{l.level === 'warn' ? 'fix' : 'idea'}</Badge><span className="w-52 shrink-0 truncate text-zinc-300">{l.where}</span><span className="min-w-0 flex-1 text-zinc-500">{l.text}</span></li>)}</ul>}
          </Card>
          <Notice title="Where do projects and services live?">They are plain files in your repository (<code className="text-accent">data/portfolioData.ts</code>, <code className="text-accent">data/servicesData.ts</code>), so changes go through Git and Vercel like any code change. This panel checks them for you rather than editing them, so a typo here can never take the site down.</Notice>
        </div>
      )}
    </>
  );
}
