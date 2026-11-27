// src/components/admin/ArtPanel.tsx — the Art gallery: upload, describe, reorder and remove your graphic design pieces.
'use client';

import { useEffect, useRef, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { prepareArt, pickColors, type PreparedArt } from '@/lib/artImage';
import { box, btn, primary } from './adminKit';
import { AButton, Badge, Card, Empty, Field, Notice } from './ui';

interface Art { id: string; title: string; category: string; description: string; tools: string[]; year: string; featured: boolean; w: number; h: number; v: number; color?: string; tone?: string }
const CATS = ['Logos', 'Branding', 'Posters', 'Social media', 'Illustration', 'Packaging', 'UI design', 'Other'];
async function artApi(body?: Record<string, unknown>): Promise<{ items: Art[] }> {
  const r = await fetch('/api/admin/art', body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : { cache: 'no-store' });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'Request failed');
  return d;
}
const EMPTY: Art = { id: '', title: '', category: 'Logos', description: '', tools: [], year: String(new Date().getFullYear()), featured: false, w: 0, h: 0, v: 0 };

export default function ArtPanel() {
  const [items, setItems] = useState<Art[]>([]);
  const [edit, setEdit] = useState<Art | null>(null);
  const [pic, setPic] = useState<PreparedArt | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const [toolsText, setToolsText] = useState('');

  useEffect(() => { artApi().then((d) => setItems(d.items)).catch((e) => setMsg({ ok: false, text: e.message })); }, []);

  const open = (a: Art) => { setEdit(a); setPic(null); setToolsText((a.tools || []).join(', ')); setMsg(null); };

  const choose = async (f?: File | null) => {
    if (!f) return;
    setBusy(true); setMsg(null);
    try { const p = await prepareArt(f); setPic(p); if (edit && !edit.title) setEdit({ ...edit, title: f.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').slice(0, 80) }); }
    catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
    finally { setBusy(false); if (file.current) file.current.value = ''; }
  };

  const call = async (body: Record<string, unknown>, done: string) => {
    setBusy(true); setMsg(null);
    try { const d = await artApi(body); setItems(d.items); setEdit(null); setPic(null); setMsg({ ok: true, text: done }); }
    catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
    finally { setBusy(false); }
  };

  const loadImg = (src: string) => new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Could not read a picture.')); i.src = src; });

  // Pieces uploaded before colours existed get theirs worked out from the saved thumbnail.
  const colourise = async () => {
    const todo = items.filter((a) => !a.color || a.color === '#22d3ee');
    if (!todo.length) { setMsg({ ok: true, text: 'Every piece already has its colours.' }); return; }
    setBusy(true); setMsg(null);
    try {
      let last: Art[] = items;
      for (const a of todo) {
        const { color, tone } = pickColors(await loadImg(`/api/art/${a.id}?t=1&v=${a.v}`));
        last = (await artApi({ action: 'save', item: { ...a, tools: a.tools.join(',') }, color, tone })).items;
      }
      setItems(last); setMsg({ ok: true, text: `Updated colours on ${todo.length} piece${todo.length === 1 ? '' : 's'}.` });
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); } finally { setBusy(false); }
  };

  // Backup: every piece with its full picture, as one file you keep. Restore puts missing pieces back.
  const backup = async () => {
    setBusy(true); setMsg(null);
    try {
      const pieces = [];
      for (const a of items) {
        const [full, th] = await Promise.all([fetch(`/api/art/${a.id}?v=${a.v}`), fetch(`/api/art/${a.id}?t=1&v=${a.v}`)]);
        const toUrl = async (r: Response) => { const b = await r.blob(); return new Promise<string>((res) => { const f = new FileReader(); f.onload = () => res(String(f.result)); f.readAsDataURL(b); }); };
        pieces.push({ ...a, image: await toUrl(full), thumb: await toUrl(th) });
      }
      const url = URL.createObjectURL(new Blob([JSON.stringify({ kind: 'art-backup', at: new Date().toISOString(), pieces })], { type: 'application/json' }));
      const l = document.createElement('a'); l.href = url; l.download = `art-backup-${new Date().toISOString().slice(0, 10)}.json`; l.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      setMsg({ ok: true, text: `Saved ${pieces.length} piece${pieces.length === 1 ? '' : 's'} to a file.` });
    } catch (e) { setMsg({ ok: false, text: (e as Error).message || 'Backup failed.' }); } finally { setBusy(false); }
  };
  const restore = async (f: File) => {
    setBusy(true); setMsg(null);
    try {
      const d = JSON.parse(await f.text());
      if (d?.kind !== 'art-backup' || !Array.isArray(d.pieces)) throw new Error('That is not an art backup file.');
      const have = new Set(items.map((a) => a.id));
      let n = 0, last = items;
      for (const p of d.pieces.slice(0, 150)) {
        if (!p?.id || have.has(p.id)) continue;
        last = (await artApi({ action: 'save', item: { ...p, tools: Array.isArray(p.tools) ? p.tools.join(',') : '' }, image: p.image, thumb: p.thumb, w: p.w, h: p.h, color: p.color, tone: p.tone })).items; n++;
      }
      setItems(last); setMsg({ ok: true, text: n ? `Restored ${n} missing piece${n === 1 ? '' : 's'}.` : 'Nothing was missing.' });
    } catch (e) { setMsg({ ok: false, text: (e as Error).message || 'Restore failed.' }); } finally { setBusy(false); }
  };
  const restoreInput = useRef<HTMLInputElement>(null);

  const save = () => edit && call({ action: 'save', item: { ...edit, tools: toolsText }, ...(pic ? { image: pic.image, thumb: pic.thumb, w: pic.w, h: pic.h, color: pic.color, tone: pic.tone } : {}) }, 'Saved. Visitors see it on /art straight away.');

  const preview = pic ? pic.thumb : edit?.id ? `/api/art/${edit.id}?t=1&v=${edit.v}` : '';

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <AButton variant="solid" icon="plus" onClick={() => open({ ...EMPTY })}>Add artwork</AButton>
        <button type="button" className={btn} disabled={busy || !items.length} onClick={backup}>Download backup</button>
        <button type="button" className={btn} disabled={busy} onClick={() => restoreInput.current?.click()}>Restore from backup</button>
        <button type="button" className={btn} disabled={busy || !items.length} onClick={colourise}>Refresh glow colours</button>
        <input ref={restoreInput} type="file" accept="application/json,.json" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => { const f = e.target.files?.[0]; if (f) restore(f); e.target.value = ''; }} />
        <a href="/art" target="_blank" rel="noopener noreferrer" className="text-xs text-zinc-400 hover:text-accent">Open the gallery</a>
        {msg && <span role="status" className={`text-xs font-medium ${msg.ok ? 'text-emerald-300' : 'text-rose-300'}`}>{msg.text}</span>}
      </div>
      {!items.length && <Notice title="Sample pieces are showing">Visitors currently see 14 sample designs on /art. They disappear on their own the moment you save your first real piece, so there is nothing to delete.</Notice>}
      <Notice title="How uploads work">Pick a picture and it is shrunk on your device to web size, then saved here. Keep your full-size originals somewhere safe; the gallery shows the shrunk copy. Up to 150 pieces.</Notice>

      {edit && (
        <Card title={edit.id ? `Editing: ${edit.title || edit.id}` : 'New artwork'} icon="pencil">
          <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
            <div>
              <button type="button" onClick={() => file.current?.click()} disabled={busy} className="group flex aspect-square w-full cursor-pointer items-center justify-center overflow-hidden rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/60 text-zinc-500 transition hover:border-accent hover:text-accent">
                {preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={preview} alt="" className="h-full w-full object-contain" />
                ) : (
                  <span className="flex flex-col items-center gap-2 text-xs"><Icon name="plus" size={22} />{busy ? 'Preparing…' : 'Choose a picture'}</span>
                )}
              </button>
              <input ref={file} type="file" accept="image/*" className="sr-only" onChange={(e) => choose(e.target.files?.[0])} />
              <p className="mt-2 text-[11px] text-zinc-500">{pic ? `Ready: ${pic.note}` : edit.id ? 'Tap the picture to replace it.' : 'PNG, JPG or WebP.'}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Title"><input className={box} value={edit.title} maxLength={80} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></Field>
              <Field label="Category"><select className={box} value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })}>{CATS.map((c) => <option key={c}>{c}</option>)}</select></Field>
              <div className="sm:col-span-2"><Field label="About this piece" hint="Optional: the idea, the client, the brief"><textarea className={box} rows={3} maxLength={600} value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></Field></div>
              <Field label="Tools" hint="Separate with commas"><input className={box} value={toolsText} placeholder="Photoshop, Illustrator" onChange={(e) => setToolsText(e.target.value)} /></Field>
              <Field label="Year"><input className={box} inputMode="numeric" maxLength={4} value={edit.year} onChange={(e) => setEdit({ ...edit, year: e.target.value.replace(/\D/g, '') })} /></Field>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300 sm:col-span-2"><input type="checkbox" className="accent-[var(--accent)]" checked={edit.featured} onChange={(e) => setEdit({ ...edit, featured: e.target.checked })} /> Feature this piece (shown larger)</label>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button className={primary} disabled={busy || (!edit.id && !pic)} onClick={save}>{busy ? 'Working…' : 'Save artwork'}</button>
            <button className={btn} onClick={() => { setEdit(null); setPic(null); }}>Cancel</button>
          </div>
        </Card>
      )}

      {items.length === 0 && !edit ? (
        <div className="rounded-2xl border border-dashed border-zinc-800"><Empty icon="palette" title="No artwork yet" text="Add your first piece and it appears on the public Art page." /></div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((a, i) => (
            <li key={a.id} className="flex gap-3 overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-3 transition hover:border-zinc-700">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/art/${a.id}?t=1&v=${a.v}`} alt="" className="h-20 w-20 flex-none rounded-xl bg-zinc-800 object-cover" loading="lazy" />
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-start gap-2"><span className="min-w-0 flex-1 truncate text-sm font-semibold text-zinc-100">{a.title}</span>{a.featured && <Badge tone="accent">Featured</Badge>}</div>
                <div className="mt-0.5 truncate text-[11px] text-zinc-500">{a.category}{a.year ? ` · ${a.year}` : ''}</div>
                <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-2">
                  <AButton small disabled={busy || i === 0} onClick={() => call({ action: 'move', id: a.id, dir: 'up' }, 'Moved.')} title="Move earlier" icon="arrowUp" />
                  <AButton small disabled={busy || i === items.length - 1} onClick={() => call({ action: 'move', id: a.id, dir: 'down' }, 'Moved.')} title="Move later"><Icon name="arrowUp" size={14} className="rotate-180" /></AButton>
                  <AButton small icon="pencil" onClick={() => open(a)}>Edit</AButton>
                  <AButton small danger icon="trash" onClick={() => confirm(`Delete “${a.title}”?`) && call({ action: 'delete', id: a.id }, 'Deleted.')} title="Delete" />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
