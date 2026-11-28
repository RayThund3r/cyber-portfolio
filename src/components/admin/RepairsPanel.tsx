// src/components/admin/RepairsPanel.tsx — "Recent work": before / after pairs for repairs and redesigns, shown on the Services page.
'use client';

import { useEffect, useRef, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { prepareArt, type PreparedArt } from '@/lib/artImage';
import { box, btn, primary } from './adminKit';
import { AButton, Badge, Card, Empty, Field, Notice } from './ui';

import { ask } from '@/lib/dialog';
interface Job { id: string; title: string; note: string; kind: 'repair' | 'design'; shown: boolean; w: number; h: number; v: number }
async function jobApi(body?: Record<string, unknown>): Promise<{ items: Job[] }> {
  const r = await fetch('/api/admin/repairs', body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : { cache: 'no-store' });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'Request failed');
  return d;
}
const EMPTY: Job = { id: '', title: '', note: '', kind: 'repair', shown: true, w: 0, h: 0, v: 0 };

function Slot({ label, src, note, busy, onPick }: { label: string; src: string; note: string; busy: boolean; onPick: (f?: File | null) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div>
      <button type="button" onClick={() => ref.current?.click()} disabled={busy} aria-label={`Choose the ${label.toLowerCase()} picture`} className="flex aspect-[4/3] w-full cursor-pointer items-center justify-center overflow-hidden rounded-2xl border border-dashed border-zinc-700 bg-zinc-950/60 text-zinc-500 transition hover:border-zinc-400 hover:text-zinc-200">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" className="h-full w-full object-contain" />
        ) : <span className="flex flex-col items-center gap-2 text-xs"><Icon name="plus" size={22} />{busy ? 'Preparing…' : `${label} picture`}</span>}
      </button>
      <input ref={ref} type="file" accept="image/*" className="sr-only" onChange={(e) => { onPick(e.target.files?.[0]); e.target.value = ''; }} />
      <p className="mt-1.5 text-[11px] text-zinc-500"><span className="font-semibold text-zinc-300">{label}.</span> {note}</p>
    </div>
  );
}

export default function RepairsPanel() {
  const [items, setItems] = useState<Job[]>([]);
  const [edit, setEdit] = useState<Job | null>(null);
  const [before, setBefore] = useState<PreparedArt | null>(null);
  const [after, setAfter] = useState<PreparedArt | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => { jobApi().then((d) => setItems(d.items)).catch((e) => setMsg({ ok: false, text: e.message })); }, []);
  const open = (j: Job) => { setEdit(j); setBefore(null); setAfter(null); setMsg(null); };

  const choose = async (side: 'before' | 'after', f?: File | null) => {
    if (!f) return;
    setBusy(true); setMsg(null);
    try { const p = await prepareArt(f); if (side === 'before') setBefore(p); else setAfter(p); }
    catch (e) { setMsg({ ok: false, text: (e as Error).message }); } finally { setBusy(false); }
  };
  const call = async (body: Record<string, unknown>, ok: string) => {
    setBusy(true); setMsg(null);
    try { const d = await jobApi(body); setItems(d.items); setMsg({ ok: true, text: ok }); return true; }
    catch (e) { setMsg({ ok: false, text: (e as Error).message }); return false; } finally { setBusy(false); }
  };
  const save = async () => {
    if (!edit) return;
    const ok = await call({ action: 'save', item: edit, before: before?.image, after: after?.image, w: after?.w || before?.w, h: after?.h || before?.h }, 'Saved. It is on the Services page.');
    if (ok) { setEdit(null); setBefore(null); setAfter(null); }
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <AButton variant="solid" icon="plus" onClick={() => open({ ...EMPTY })}>Add a job</AButton>
        <a href="/services#recent-work" target="_blank" rel="noopener noreferrer" className="text-xs text-zinc-400 hover:text-accent">See it on the site</a>
        {msg && <span role="status" className={`text-xs font-medium ${msg.ok ? 'text-emerald-300' : 'text-rose-300'}`}>{msg.text}</span>}
      </div>
      {!items.length && <Notice title="Sample jobs are showing">Visitors currently see 3 sample before and after pairs on the Services page. They disappear on their own the moment you save your first real job.</Notice>}
      <Notice title="Tips for good pairs">Take both photos from the same angle and in the same light. Fixed phone screens, cleaned laptops and redesigned logos all work well. Ask the customer before showing their device or brand.</Notice>

      {edit && (
        <Card title={edit.id ? `Editing: ${edit.title || edit.id}` : 'New job'} icon="pencil">
          <div className="grid gap-4 sm:grid-cols-2">
            <Slot label="Before" src={before?.image || (edit.id ? `/api/repairs/${edit.id}?s=before&v=${edit.v}` : '')} note={before ? before.note : 'The problem, as it arrived.'} busy={busy} onPick={(f) => choose('before', f)} />
            <Slot label="After" src={after?.image || (edit.id ? `/api/repairs/${edit.id}?s=after&v=${edit.v}` : '')} note={after ? after.note : 'The result.'} busy={busy} onPick={(f) => choose('after', f)} />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Title"><input className={box} value={edit.title} maxLength={80} placeholder="e.g. Cracked phone screen replaced" onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></Field>
            <Field label="Type"><select className={box} value={edit.kind} onChange={(e) => setEdit({ ...edit, kind: e.target.value === 'design' ? 'design' : 'repair' })}><option value="repair">Repair</option><option value="design">Design</option></select></Field>
            <div className="sm:col-span-2"><Field label="One line about it" hint="Optional: what was done, how long it took"><input className={box} value={edit.note} maxLength={160} onChange={(e) => setEdit({ ...edit, note: e.target.value })} /></Field></div>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300 sm:col-span-2"><input type="checkbox" className="accent-[var(--accent)]" checked={edit.shown} onChange={(e) => setEdit({ ...edit, shown: e.target.checked })} />Show on the Services page</label>
          </div>
          <div className="mt-4 flex gap-2">
            <button className={primary} disabled={busy || (!edit.id && (!before || !after))} onClick={save}>{busy ? 'Working…' : 'Save job'}</button>
            <button className={btn} onClick={() => { setEdit(null); setBefore(null); setAfter(null); }}>Cancel</button>
          </div>
        </Card>
      )}

      {items.length === 0 && !edit ? (
        <div className="rounded-2xl border border-dashed border-zinc-800"><Empty icon="wrench" title="No jobs yet" text="Add a before and after pair and it appears on the Services page." /></div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((j, i) => (
            <li key={j.id} className={`flex gap-3 overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-3 transition hover:border-zinc-700 ${j.shown ? '' : 'opacity-60'}`}>
              <div className="flex flex-none gap-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/repairs/${j.id}?s=before&v=${j.v}`} alt="" className="h-20 w-14 rounded-lg bg-zinc-800 object-cover" loading="lazy" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/repairs/${j.id}?s=after&v=${j.v}`} alt="" className="h-20 w-14 rounded-lg bg-zinc-800 object-cover" loading="lazy" />
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-start gap-2"><span className="min-w-0 flex-1 truncate text-sm font-semibold text-zinc-100">{j.title}</span>{!j.shown && <Badge>Hidden</Badge>}</div>
                <div className="mt-0.5 truncate text-[11px] text-zinc-500">{j.kind === 'design' ? 'Design' : 'Repair'}{j.note ? ` · ${j.note}` : ''}</div>
                <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-2">
                  <AButton small disabled={busy || i === 0} onClick={() => call({ action: 'move', id: j.id, dir: 'up' }, 'Moved.')} title="Move earlier" icon="arrowUp" />
                  <AButton small disabled={busy || i === items.length - 1} onClick={() => call({ action: 'move', id: j.id, dir: 'down' }, 'Moved.')} title="Move later"><Icon name="arrowUp" size={14} className="rotate-180" /></AButton>
                  <AButton small icon="pencil" onClick={() => open(j)}>Edit</AButton>
                  <AButton small danger icon="trash" onClick={async () => await ask(`Delete “${j.title}”?`, { danger: true, confirmLabel: 'Delete' }) && call({ action: 'delete', id: j.id }, 'Deleted.')} title="Delete" />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
