// src/components/admin/GamesPanel.tsx — owner utility: list, add, edit, hide, reorder and preview links to web games.
'use client';
import { useEffect, useMemo, useState } from 'react';
import { api, useApi } from '@/lib/admin/client';
import { AButton, Badge, Card, Empty, ErrorBox, Field, Notice, Skel, Toggle, inputCls, useToast } from '@/components/admin/ui';
import { RATIOS, ratioCss, safeUrl, type EmbedMode, type ExtGame, type Ratio } from '@/lib/games/ext';
import Icon from '@/components/ui/Icon';

type Form = { id: string; title: string; url: string; desc: string; cover: string; category: string; mode: EmbedMode; ratio: Ratio; tags: string; off: boolean };
const blank: Form = { id: '', title: '', url: '', desc: '', cover: '', category: 'Community', mode: 'iframe', ratio: '16:9', tags: '', off: false };

export default function GamesPanel() {
  const toast = useToast();
  const res = useApi<{ games: ExtGame[] }>('/api/admin/games');
  const [list, setList] = useState<ExtGame[] | null>(null);
  const [form, setForm] = useState<Form>(blank);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);

  useEffect(() => { if (res.data) setList(res.data.games); }, [res.data]);

  const urlOk = useMemo(() => !!safeUrl(form.url), [form.url]);
  const coverOk = !form.cover || !!safeUrl(form.cover, { allowLocalHttp: false });
  const valid = form.title.trim().length >= 2 && urlOk && coverOk;

  async function persist(next: ExtGame[], msg: string) {
    setBusy(true);
    try { const out = await api<{ games: ExtGame[] }>('/api/admin/games', { method: 'PUT', body: { games: next } }); setList(out.games); toast(msg, 'ok'); return true; }
    catch (e) { toast(e instanceof Error ? e.message : 'Could not save', 'err'); return false; }
    finally { setBusy(false); }
  }

  async function save() {
    if (!valid || !list) return;
    const item = { id: form.id || 'x' + Date.now().toString(36), title: form.title.trim(), url: form.url.trim(), desc: form.desc.trim(), cover: form.cover.trim() || undefined, category: form.category.trim() || 'Community', mode: form.mode, ratio: form.ratio, tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean), off: form.off || undefined, t: Date.now() } as ExtGame;
    const next = form.id ? list.map((g) => (g.id === form.id ? item : g)) : [...list, item];
    if (await persist(next, form.id ? 'Game updated' : 'Game added')) { setForm(blank); setPreview(false); }
  }

  const move = (i: number, d: -1 | 1) => { if (!list) return; const j = i + d; if (j < 0 || j >= list.length) return; const n = [...list]; [n[i], n[j]] = [n[j], n[i]]; void persist(n, 'Order saved'); };
  const edit = (g: ExtGame) => { setForm({ id: g.id, title: g.title, url: g.url, desc: g.desc, cover: g.cover || '', category: g.category, mode: g.mode, ratio: g.ratio, tags: g.tags.join(', '), off: !!g.off }); setPreview(false); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  if (res.error && !list) return <ErrorBox text={res.error} retry={res.reload} />;
  if (!list) return <Skel h="h-64" />;

  return (
    <div className="grid gap-5 lg:grid-cols-5">
      <div className="space-y-4 lg:col-span-3">
        <Card title={form.id ? 'Edit game' : 'Add a game'} icon="gamepad">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Title"><input className={inputCls} value={form.title} maxLength={60} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Space Dodger" /></Field>
            <Field label="Category" hint="Shown as a small tag"><input className={inputCls} value={form.category} maxLength={24} onChange={(e) => setForm({ ...form, category: e.target.value })} /></Field>
            <div className="sm:col-span-2"><Field label="Game address (https://…)" hint={form.url && !urlOk ? 'Must start with https:// (http:// only works for localhost).' : 'Where the game lives, for example your Vercel or GitHub Pages link.'}>
              <input className={`${inputCls} ${form.url && !urlOk ? 'border-red-500/60' : ''}`} value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://my-game.vercel.app" inputMode="url" /></Field></div>
            <div className="sm:col-span-2"><Field label="Short description"><textarea className={`${inputCls} py-2`} rows={2} maxLength={240} value={form.desc} onChange={(e) => setForm({ ...form, desc: e.target.value })} placeholder="Dodge asteroids for as long as you can." /></Field></div>
            <div className="sm:col-span-2"><Field label="Cover image address (optional)" hint={!coverOk ? 'Must be an https:// image link.' : 'A 16:9 picture makes the card look better.'}>
              <input className={`${inputCls} ${!coverOk ? 'border-red-500/60' : ''}`} value={form.cover} onChange={(e) => setForm({ ...form, cover: e.target.value })} placeholder="https://…/cover.png" inputMode="url" /></Field></div>
            <Field label="How it opens">
              <select className={inputCls} value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value as EmbedMode })}>
                <option value="iframe">Play inside the site (embed)</option><option value="tab">Open in a new tab</option>
              </select></Field>
            <Field label="Shape of the game window"><select className={inputCls} value={form.ratio} onChange={(e) => setForm({ ...form, ratio: e.target.value as Ratio })}>{RATIOS.map((r) => <option key={r}>{r}</option>)}</select></Field>
            <div className="sm:col-span-2"><Field label="Tags (comma separated)"><input className={inputCls} value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="arcade, 2d, mine" /></Field></div>
            <div className="sm:col-span-2"><Toggle checked={!form.off} onChange={(v) => setForm({ ...form, off: !v })} label="Visible on the Games page" /></div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <AButton variant="solid" icon="check" onClick={save} disabled={!valid || busy}>{form.id ? 'Save changes' : 'Add game'}</AButton>
            <AButton icon="eye" onClick={() => setPreview((p) => !p)} disabled={!urlOk}>{preview ? 'Hide preview' : 'Preview here'}</AButton>
            {urlOk && <a href={form.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-zinc-700 px-3 font-mono text-[11px] text-zinc-300 hover:border-accent/50 hover:text-accent"><Icon name="external" size={13} />Open in new tab</a>}
            {form.id && <AButton onClick={() => { setForm(blank); setPreview(false); }}>Cancel edit</AButton>}
          </div>
          {preview && urlOk && (
            <div className="mt-3">
              <div className="overflow-hidden rounded-xl border border-zinc-800 bg-black" style={{ aspectRatio: ratioCss(form.ratio), maxHeight: '60vh' }}>
                <iframe title="Game preview" src={form.url} loading="lazy" sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-popups allow-forms" allow="fullscreen; gamepad" className="h-full w-full border-0" />
              </div>
              <p className="mt-2 text-xs text-zinc-500">If this stays blank, the game&apos;s host blocks embedding (X-Frame-Options or a frame-ancestors rule). Choose &ldquo;Open in a new tab&rdquo; for it, or allow this site&apos;s address in the game&apos;s headers.</p>
            </div>
          )}
        </Card>
        <Notice title="Embedding safely">Games run in a sandboxed frame. They can run their own code and use their own storage, but cannot reach this site&apos;s pages, cookies or admin session. Only add games you trust.</Notice>
      </div>

      <div className="lg:col-span-2">
        <Card title={`Your games (${list.length}/60)`} icon="grid">
          {list.length === 0 ? <Empty icon="gamepad" title="No extra games yet" text="Add your first one on the left. It appears on the public Games page straight away." /> : (
            <ul className="space-y-2">
              {list.map((g, i) => (
                <li key={g.id} className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/60 p-2.5">
                  <div className="flex flex-col">
                    <button type="button" aria-label="Move up" disabled={i === 0 || busy} onClick={() => move(i, -1)} className="cursor-pointer text-zinc-500 hover:text-accent disabled:opacity-30"><Icon name="arrowUp" size={14} /></button>
                    <button type="button" aria-label="Move down" disabled={i === list.length - 1 || busy} onClick={() => move(i, 1)} className="cursor-pointer text-zinc-500 hover:text-accent disabled:opacity-30"><Icon name="arrowUp" size={14} style={{ transform: 'rotate(180deg)' }} /></button>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-zinc-100">{g.title}</p>
                    <p className="truncate font-mono text-[10px] text-zinc-500">{g.url.replace(/^https?:\/\//, '')}</p>
                    <div className="mt-1 flex flex-wrap gap-1"><Badge tone={g.off ? 'warn' : 'ok'}>{g.off ? 'hidden' : 'live'}</Badge><Badge>{g.mode === 'iframe' ? 'embedded' : 'new tab'}</Badge><Badge>{g.category}</Badge></div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <AButton small icon="pencil" onClick={() => edit(g)}>Edit</AButton>
                    <AButton small danger icon="trash" onClick={() => { if (window.confirm(`Remove ${g.title}?`)) void persist(list.filter((x) => x.id !== g.id), 'Game removed'); }}>Delete</AButton>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
