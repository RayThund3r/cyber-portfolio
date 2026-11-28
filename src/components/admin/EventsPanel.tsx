// src/components/admin/EventsPanel.tsx — how the public site reacts to the world: master switches, per-day switches,
// owner-written surprise events ("custom"), a calendar preview for any date, and a one-click live preview.
'use client';
import { useEffect, useMemo, useState } from 'react';
import { api, useApi } from '@/lib/admin/client';
import { AButton, Badge, Card, Empty, ErrorBox, Field, Notice, Skel, Toggle, inputCls, useToast } from '@/components/admin/ui';
import { EVENTS, upcomingEvents, type FxName, type Tone } from '@/lib/events/calendar';
import { DEFAULT_EVENTS_CFG, eventsNow, type CustomEvent, type EventsConfig } from '@/lib/events/config';
import Icon from '@/components/ui/Icon';

import { ask } from '@/lib/dialog';
const FX_OPTS: FxName[] = ['none', 'confetti', 'snow', 'hearts', 'lanterns', 'stars', 'leaves', 'rain'];
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const blank = (): CustomEvent => ({ id: '', name: '', ribbon: '', say: '', tone: 'celebrate', fx: 'confetti', from: today(), to: today() });
const SCOPES: Record<string, string> = { uganda: 'Uganda', africa: 'Africa', world: 'World', faith: 'Faith', seasonal: 'Seasonal', tech: 'Tech & fun' };

export default function EventsPanel() {
  const toast = useToast();
  const res = useApi<{ cfg: EventsConfig }>('/api/admin/events');
  const [cfg, setCfg] = useState<EventsConfig | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<CustomEvent>(blank());
  const [editing, setEditing] = useState(false);
  const [simDate, setSimDate] = useState(today());

  useEffect(() => { if (res.data) setCfg(res.data.cfg); }, [res.data]);

  async function persist(next: EventsConfig, msg: string) {
    setBusy(true);
    try { const out = await api<{ cfg: EventsConfig }>('/api/admin/events', { method: 'PUT', body: { cfg: next } }); setCfg(out.cfg); toast(msg, 'ok'); return true; }
    catch (e) { toast(e instanceof Error ? e.message : 'Could not save', 'err'); return false; }
    finally { setBusy(false); }
  }

  const sim = useMemo(() => { const d = new Date(simDate + 'T12:00:00'); return Number.isNaN(d.getTime()) ? new Date() : d; }, [simDate]);
  const current = cfg || DEFAULT_EVENTS_CFG;
  const onThatDay = useMemo(() => eventsNow(current, sim), [current, sim]);
  const coming = useMemo(() => upcomingEvents(sim, 6, current.off), [current.off, sim]);
  const grouped = useMemo(() => { const g: Record<string, typeof EVENTS> = {}; for (const e of EVENTS) (g[e.scope] ||= []).push(e); return g; }, []);

  const valid = form.name.trim().length >= 2 && /^\d{4}-\d{2}-\d{2}$/.test(form.from) && /^\d{4}-\d{2}-\d{2}$/.test(form.to || form.from);
  async function saveCustom() {
    if (!cfg || !valid) return;
    const item: CustomEvent = { ...form, id: form.id || 'c' + Date.now().toString(36), to: form.to || form.from };
    const custom = editing ? cfg.custom.map((c) => (c.id === form.id ? item : c)) : [...cfg.custom, item];
    if (await persist({ ...cfg, custom }, editing ? 'Event updated' : 'Event added. It is live now.')) { setForm(blank()); setEditing(false); }
  }
  const toggleOff = (id: string, on: boolean) => { if (!cfg) return; const off = on ? cfg.off.filter((x) => x !== id) : [...cfg.off, id]; void persist({ ...cfg, off }, on ? 'Enabled' : 'Hidden'); };

  if (res.error && !cfg) return <ErrorBox text={res.error} retry={res.reload} />;
  if (!cfg) return <Skel h="h-64" />;

  return (
    <div className="grid gap-5 lg:grid-cols-5">
      <div className="space-y-4 lg:col-span-3">
        <Card title="Master switches" icon="spark">
          <div className="space-y-3">
            <Toggle checked={cfg.enabled} onChange={(v) => void persist({ ...cfg, enabled: v }, v ? 'World events on' : 'World events off')} label="React to world events" hint="The ribbon, effects and the assistant's greetings. Off = the site ignores the calendar completely." />
            <Toggle checked={cfg.fx} onChange={(v) => void persist({ ...cfg, fx: v }, v ? 'Effects on' : 'Effects off')} label="Allow effects (confetti, snow, lanterns...)" hint="Off keeps just the quiet ribbon. Visitors who prefer reduced motion never see effects either way." />
          </div>
        </Card>

        <Card title={editing ? 'Edit your event' : 'Add a surprise event'} icon="bell">
          <p className="mb-3 text-xs text-zinc-500">For things no calendar knows: a national moment, a big match night, a launch, a day of mourning. It goes live on the public site within about a minute and wins over built-in days.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name"><input className={inputCls} value={form.name} maxLength={60} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Cranes match night" /></Field>
            <Field label="Mood" hint="Solemn = quiet ribbon, never any effects"><select className={inputCls} value={form.tone} onChange={(e) => setForm({ ...form, tone: e.target.value as Tone })}><option value="celebrate">Celebrate</option><option value="awareness">Awareness</option><option value="solemn">Solemn</option></select></Field>
            <div className="sm:col-span-2"><Field label="Ribbon text (top of every page)"><input className={inputCls} value={form.ribbon} maxLength={160} onChange={(e) => setForm({ ...form, ribbon: e.target.value })} placeholder="Come on, Cranes! Orders still open tonight." /></Field></div>
            <div className="sm:col-span-2"><Field label="What the assistant says about it"><textarea className={`${inputCls} py-2`} rows={2} maxLength={300} value={form.say} onChange={(e) => setForm({ ...form, say: e.target.value })} placeholder="It's match night! We're open but may reply slower." /></Field></div>
            <Field label="From"><input type="date" className={inputCls} value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value, to: form.to < e.target.value ? e.target.value : form.to })} /></Field>
            <Field label="To (inclusive)"><input type="date" className={inputCls} value={form.to} min={form.from} onChange={(e) => setForm({ ...form, to: e.target.value })} /></Field>
            <Field label="Effect"><select className={inputCls} disabled={form.tone === 'solemn'} value={form.tone === 'solemn' ? 'none' : form.fx} onChange={(e) => setForm({ ...form, fx: e.target.value as FxName })}>{FX_OPTS.map((f) => <option key={f}>{f}</option>)}</select></Field>
            <Field label="Link (optional, a page on this site)"><input className={inputCls} value={form.href || ''} onChange={(e) => setForm({ ...form, href: e.target.value })} placeholder="/portfolio" /></Field>
            <div className="sm:col-span-2"><Toggle checked={!!form.yearly} onChange={(v) => setForm({ ...form, yearly: v })} label="Repeat every year" /></div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <AButton variant="solid" icon="check" onClick={saveCustom} disabled={!valid || busy}>{editing ? 'Save changes' : 'Add event'}</AButton>
            {editing && <AButton onClick={() => { setForm(blank()); setEditing(false); }}>Cancel</AButton>}
          </div>
        </Card>

        <Card title={`Your events (${cfg.custom.length})`} icon="grid">
          {cfg.custom.length === 0 ? <Empty icon="bell" title="No surprise events" text="Add one above. It shows on the live site straight away." /> : (
            <ul className="space-y-2">
              {cfg.custom.map((c) => (
                <li key={c.id} className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/60 p-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-zinc-100">{c.name}</p>
                    <p className="truncate font-mono text-[10px] text-zinc-500">{c.from}{c.to !== c.from ? ` → ${c.to}` : ''}{c.yearly ? ' · yearly' : ''}</p>
                    <div className="mt-1 flex flex-wrap gap-1"><Badge tone={cfg.off.includes(c.id) ? 'warn' : 'ok'}>{cfg.off.includes(c.id) ? 'hidden' : 'on'}</Badge><Badge>{c.tone}</Badge>{c.tone !== 'solemn' && c.fx !== 'none' && <Badge>{c.fx}</Badge>}</div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <AButton small icon="pencil" onClick={() => { setForm(c); setEditing(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Edit</AButton>
                    <AButton small danger icon="trash" onClick={async () => { if (await ask(`Remove ${c.name}?`, { danger: true, confirmLabel: 'Delete' })) void persist({ ...cfg, custom: cfg.custom.filter((x) => x.id !== c.id) }, 'Event removed'); }}>Delete</AButton>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="space-y-4 lg:col-span-2">
        <Card title="See any day" icon="calendar">
          <Field label="Pick a date"><input type="date" className={inputCls} value={simDate} onChange={(e) => setSimDate(e.target.value || today())} /></Field>
          <div className="mt-3">
            {onThatDay.length === 0 ? <p className="text-sm text-zinc-500">Nothing special that day.</p> : (
              <ul className="space-y-1.5">{onThatDay.map((e) => <li key={e.id} className="flex items-start gap-2 text-sm text-zinc-200"><Icon name={e.icon} size={15} className="mt-0.5 text-accent" /><span><b>{e.name}</b><span className="block text-xs text-zinc-500">{e.ribbon}</span></span></li>)}</ul>
            )}
          </div>
          <p className="mb-1 mt-4 font-mono text-[10px] uppercase tracking-wider text-zinc-500">Coming up after this day</p>
          <ul className="space-y-1 text-xs text-zinc-400">{coming.map((e) => <li key={e.id} className="flex justify-between gap-2"><span className="truncate">{e.name}</span><span className="shrink-0 font-mono text-zinc-500">{e.start.slice(5)}{e.approx ? ' ~' : ''}</span></li>)}</ul>
          <p className="mt-2 text-[11px] text-zinc-600">~ moon-based dates can differ by a day.</p>
        </Card>

        <Card title="Built-in days" icon="compass">
          <p className="mb-2 text-xs text-zinc-500">Switch off any you do not want the site to mark. Tap the eye to see how it looks on the live site.</p>
          <div className="space-y-3">
            {Object.entries(grouped).map(([scope, list]) => (
              <div key={scope}>
                <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-accent">{SCOPES[scope] || scope}</p>
                <ul className="space-y-1">
                  {list.map((e) => {
                    const on = !cfg.off.includes(e.id);
                    return (
                      <li key={e.id} className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-zinc-900/60">
                        <input type="checkbox" aria-label={`Show ${e.name}`} checked={on} disabled={busy} onChange={(ev) => toggleOff(e.id, ev.target.checked)} className="h-4 w-4 cursor-pointer accent-cyan-400" />
                        <span className={`min-w-0 flex-1 truncate text-sm ${on ? 'text-zinc-200' : 'text-zinc-600 line-through'}`}>{e.name}</span>
                        <a href={`/?event=${e.id}`} target="_blank" rel="noopener noreferrer" aria-label={`Preview ${e.name} on the live site`} className="rounded p-1 text-zinc-500 hover:text-accent"><Icon name="eye" size={14} /></a>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </Card>
        <Notice title="About live news">The site cannot watch the news by itself (no paid feeds). Built-in days run on their own. For anything unexpected, add a surprise event above and it appears everywhere within a minute.</Notice>
      </div>
    </div>
  );
}
