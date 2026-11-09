// src/components/studio/StudioEditor.tsx — edit one website with a live, device-sized preview.
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FieldForm, type FormCtx } from '@/components/builder/FieldForm';
import { STUDIO_GROUPS, type StudioData } from '@/lib/studio/schema';
import { buildStudioSite } from '@/lib/studio/generate';
import { PRESETS } from '@/lib/studio/presets';
import { compress } from './compress';

async function post(body: unknown) {
  const r = await fetch('/api/studio', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(d.error || 'Request failed'), { status: r.status });
  return d;
}
const btn = 'px-3 py-1.5 rounded border border-zinc-700 text-xs font-mono hover:border-zinc-500 disabled:opacity-40 cursor-pointer';
const primary = 'px-3 py-1.5 rounded bg-cyan-500 text-black text-xs font-mono font-semibold hover:bg-cyan-400 disabled:opacity-40 cursor-pointer';
const LOOK_KEYS = ['skin', 'hf', 'bf', 'radius', 'fx', 'lr', 'bgL', 'cardL', 'txL', 'acL', 'ac2L', 'bgD', 'cardD', 'txD', 'acD', 'ac2D'];
const DEVICES = { phone: 390, tablet: 768, desktop: 0 } as const;

export default function StudioEditor({ slug, onBack, onAuthLost }: { slug: string; onBack: () => void; onAuthLost: () => void }) {
  const [data, setData] = useState<StudioData | null>(null);
  const [assets, setAssets] = useState<Record<string, string>>({});
  const [name, setName] = useState('');
  const [published, setPublished] = useState(false);
  const [portfolioId, setPortfolioId] = useState<string | null>(null);
  const [group, setGroup] = useState(STUDIO_GROUPS[0].id);
  const [device, setDevice] = useState<keyof typeof DEVICES>('phone');
  const [view, setView] = useState<'edit' | 'preview'>('edit');
  const [save, setSave] = useState<'idle' | 'dirty' | 'saving' | 'saved' | 'error'>('idle');
  const [msg, setMsg] = useState<string | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState('');
  const dirty = useRef(false);

  const fail = useCallback((e: any) => { if (e?.status === 401) onAuthLost(); else setMsg(e?.message || 'Something went wrong.'); }, [onAuthLost]);

  useEffect(() => {
    post({ action: 'get', slug }).then((d) => { setData(d.data); setAssets(d.assets); setName(d.name); setPublished(d.published); setPortfolioId(d.portfolioId); setSave('saved'); }).catch((e) => (e.status === 401 ? onAuthLost() : setLoadErr(e.message)));
  }, [slug, onAuthLost]);

  const change = (v: Record<string, any>) => { setData(v as StudioData); dirty.current = true; setSave('dirty'); };

  const saveNow = useCallback(async () => {
    if (!data) return;
    setSave('saving'); setMsg(null);
    try { const r = await post({ action: 'save', slug, data, name }); dirty.current = false; setSave('saved'); if (r.passKept) setMsg('The passcode must be at least 8 characters, so the previous passcode was kept.'); } catch (e) { setSave('error'); fail(e); }
  }, [data, slug, name, fail]);

  // autosave 1.5 s after the last change
  useEffect(() => {
    if (save !== 'dirty') return;
    const t = setTimeout(saveNow, 1500);
    return () => clearTimeout(t);
  }, [save, data, saveNow]);

  // warn before leaving with unsaved work
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirty.current) e.preventDefault(); };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, []);

  // live preview (debounced); pictures are inlined so it works before anything is saved
  useEffect(() => {
    if (!data) return;
    const t = setTimeout(() => setPreviewHtml(buildStudioSite(data, { assetUrl: (id) => assets[id] || '', fallbackPass: 'preview' })), 400);
    return () => clearTimeout(t);
  }, [data, assets]);

  const ctx: FormCtx = useMemo(() => ({
    sections: [], assets, disabled: false,
    upload: async (file: File) => {
      const c = await compress(file);
      const r = await post({ action: 'upload', slug, mime: c.mime, data: c.data });
      setAssets((a) => ({ ...a, [r.id]: c.dataUrl }));
      return r.id as string;
    },
  }), [assets, slug]);

  const applyLook = (id: string) => {
    if (!data || !confirm('Replace colours, fonts and style with this look? Your content stays.')) return;
    const src = PRESETS[id].data;
    const next = { ...data, customCss: '' } as StudioData;
    for (const k of LOOK_KEYS) next[k] = src[k];
    change(next);
  };
  const togglePublish = async () => {
    setMsg(null);
    try { if (dirty.current) await saveNow(); const r = await post({ action: 'publish', slug, published: !published }); setPublished(r.published); } catch (e) { fail(e); }
  };
  const addToPortfolio = async () => {
    setMsg(null);
    try { if (dirty.current) await saveNow(); const r = await post({ action: 'portfolio', slug }); setPortfolioId('set'); setMsg(r.updated ? 'Portfolio entry updated.' : 'Added to your portfolio, with a link to the live demo.'); } catch (e) { fail(e); }
  };

  if (loadErr) return <div className="space-y-3"><p className="text-red-400 text-sm">{loadErr}</p><button className={btn} onClick={onBack}>← Back</button></div>;
  if (!data) return <p className="text-sm text-zinc-400">Loading…</p>;
  const g = STUDIO_GROUPS.find((x) => x.id === group)!;
  const label = { idle: '', dirty: 'Unsaved changes…', saving: 'Saving…', saved: 'Saved ✓', error: 'Not saved' }[save];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button className={btn} onClick={async () => { if (dirty.current) await saveNow(); onBack(); }}>← All sites</button>
        <input value={name} onChange={(e) => { setName(e.target.value); dirty.current = true; setSave('dirty'); }} maxLength={60} aria-label="Site name" className="min-w-0 flex-1 rounded border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-100 focus:border-cyan-500 focus:outline-none sm:max-w-xs" />
        <span className={`font-mono text-[11px] ${save === 'error' ? 'text-red-400' : 'text-zinc-400'}`} role="status">{label}</span>
        <div className="ml-auto flex flex-wrap gap-2">
          <button className={primary} onClick={saveNow} disabled={save === 'saving'}>Save</button>
          <a className={btn} href={`/api/studio?download=${encodeURIComponent(slug)}`}>⬇ Download site (.zip)</a>
          <a className={btn} href={`/api/studio?backup=${encodeURIComponent(slug)}`} title="Settings and pictures, to restore this site later">💾 Backup</a>
          <button className={btn} onClick={togglePublish}>{published ? 'Unpublish demo' : 'Publish live demo'}</button>
        </div>
      </div>

      {published && (
        <p className="rounded border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
          Live demo: <a className="underline" href={`/demo/${slug}`} target="_blank" rel="noopener noreferrer">/demo/{slug}</a>
          <button className="ml-3 underline" onClick={() => navigator.clipboard?.writeText(`${location.origin}/demo/${slug}`)}>copy link</button>
          <button className="ml-3 underline" onClick={addToPortfolio}>{portfolioId ? 'update portfolio entry' : 'add to my portfolio'}</button>
        </p>
      )}
      {msg && <p role="status" className="text-xs text-amber-300">{msg}</p>}

      <div className="flex gap-2 lg:hidden">
        <button className={`${btn} flex-1 ${view === 'edit' ? 'border-cyan-500 text-cyan-300' : ''}`} onClick={() => setView('edit')}>Edit</button>
        <button className={`${btn} flex-1 ${view === 'preview' ? 'border-cyan-500 text-cyan-300' : ''}`} onClick={() => setView('preview')}>Preview</button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <div className={view === 'edit' ? '' : 'hidden lg:block'}>
          <div className="mb-3 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Settings groups">
            {STUDIO_GROUPS.map((x) => (
              <button key={x.id} role="tab" aria-selected={group === x.id} onClick={() => setGroup(x.id)} className={`${btn} flex-shrink-0 ${group === x.id ? 'border-cyan-500 text-cyan-300' : ''}`}>{x.icon} {x.label}</button>
            ))}
          </div>
          <p className="mb-3 text-xs text-zinc-400">{g.blurb}</p>
          {g.id === 'look' && (
            <div className="mb-4 rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
              <div className="mb-2 font-mono text-[11px] text-zinc-400">TRY A READY-MADE LOOK</div>
              <div className="flex flex-wrap gap-2">{Object.entries(PRESETS).map(([id, p]) => <button key={id} className={btn} title={p.desc} onClick={() => applyLook(id)}>{p.label}</button>)}</div>
            </div>
          )}
          <FieldForm fields={g.fields} value={data} onChange={(v) => change(v)} ctx={ctx} tag={g.id} />
        </div>

        <div className={view === 'preview' ? '' : 'hidden lg:block'}>
          <div className="sticky top-16">
            <div className="mb-2 flex items-center gap-2">
              {(Object.keys(DEVICES) as (keyof typeof DEVICES)[]).map((d) => <button key={d} className={`${btn} ${device === d ? 'border-cyan-500 text-cyan-300' : ''}`} onClick={() => setDevice(d)}>{d === 'phone' ? '📱 Phone' : d === 'tablet' ? '▭ Tablet' : '🖥 Desktop'}</button>)}
              <span className="ml-auto font-mono text-[10px] text-zinc-500">Live preview: tap around, it is the real site</span>
            </div>
            <div className="flex justify-center overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40 p-2">
              <iframe
                title="Site preview" srcDoc={previewHtml}
                // no allow-same-origin: the preview can never touch the admin's own data
                sandbox="allow-scripts allow-forms allow-popups allow-modals"
                style={{ width: DEVICES[device] ? DEVICES[device] : '100%', maxWidth: '100%', height: 'min(78vh, 860px)' }}
                className="rounded-lg border-0 bg-white"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
