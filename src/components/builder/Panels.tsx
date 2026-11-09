// src/components/builder/Panels.tsx — layers, add, media, design, settings and the contextual inspector.
'use client';

import { useMemo, useState } from 'react';
import { PALETTES, SECTION_DEFS, SECTION_ORDER, SITE_FIELDS, type SectionInstance, type SectionType, type SiteConfig } from '@/lib/builder/schema';
import { FieldForm } from './FieldForm';
import type { EditorApi } from './editorApi';

const ib = 'w-8 h-8 rounded flex items-center justify-center text-sm text-zinc-300 hover:bg-zinc-700/70 disabled:opacity-30 cursor-pointer shrink-0';
const secTitle = (s: SectionInstance) => (s.data.title ? String(s.data.title).slice(0, 30) : s.data.navLabel || '');

/* ───────────────────────── Layers (drag to reorder) ───────────────────────── */
export function LayersPanel({ api, goAdd }: { api: EditorApi; goAdd: () => void }) {
  const [over, setOver] = useState<number | null>(null);
  const n = api.cfg.sections.length;

  const drop = (e: React.DragEvent, beforeIndex: number) => {
    e.preventDefault();
    const mv = e.dataTransfer.getData('text/x-move');
    const add = e.dataTransfer.getData('text/x-add');
    setOver(null);
    if (api.locked) return;
    if (mv) api.ops.moveBefore(mv, beforeIndex);
    else if (add && SECTION_DEFS[add as SectionType]) api.ops.add(add as SectionType, beforeIndex);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-mono text-zinc-400">PAGE LAYERS</h3>
        <button disabled={api.locked} onClick={goAdd} className="px-2.5 py-1 rounded bg-cyan-500 text-black text-xs font-mono font-semibold hover:bg-cyan-400 disabled:opacity-40 cursor-pointer">＋ Add</button>
      </div>
      <ul className="space-y-1" onDragLeave={() => setOver(null)}>
        {api.cfg.sections.map((s, i) => {
          const def = SECTION_DEFS[s.type];
          const selected = api.sel === s.id;
          return (
            <li key={s.id}
              onDragOver={(e) => { if (api.locked) return; e.preventDefault(); const r = e.currentTarget.getBoundingClientRect(); const before = e.clientY < r.top + r.height / 2; setOver(Math.min(Math.max(1, before ? i : i + 1), n - 1)); }}
              onDrop={(e) => drop(e, Math.min(Math.max(1, over ?? i), n - 1))}
              className={`relative ${over === i ? 'before:absolute before:-top-[3px] before:left-0 before:right-0 before:h-[3px] before:rounded before:bg-cyan-400' : ''}`}>
              <div className={`flex items-center gap-1 rounded-lg border pl-1 pr-1 py-1 ${selected ? 'border-cyan-500 bg-cyan-500/10' : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-600'} ${s.visible ? '' : 'opacity-50'}`}>
                {!def.fixed ? (
                  <span draggable={!api.locked} onDragStart={(e) => { e.dataTransfer.setData('text/x-move', s.id); e.dataTransfer.effectAllowed = 'move'; }} className="w-5 text-center text-zinc-500 cursor-grab active:cursor-grabbing select-none" title="Drag to reorder" aria-hidden="true">⠿</span>
                ) : <span className="w-5 text-center text-zinc-700" aria-hidden="true">·</span>}
                <button onClick={() => api.select(s.id, true)} className="flex-1 min-w-0 flex items-center gap-2 text-left py-1 cursor-pointer" aria-pressed={selected}>
                  <span className="text-base">{def.icon}</span>
                  <span className="min-w-0"><span className="block text-[13px] truncate">{def.label}</span>{secTitle(s) && <span className="block text-[10px] text-zinc-500 truncate">{secTitle(s)}</span>}</span>
                </button>
                {!def.fixed && <>
                  <button className={ib} aria-label="Move up" disabled={api.locked || i <= 1} onClick={() => api.ops.move(s.id, -1)}>↑</button>
                  <button className={ib} aria-label="Move down" disabled={api.locked || i >= n - 2} onClick={() => api.ops.move(s.id, 1)}>↓</button>
                  <button className={ib} aria-label={s.visible ? 'Hide' : 'Show'} disabled={api.locked} onClick={() => api.ops.toggle(s.id)}>{s.visible ? '👁' : '🚫'}</button>
                </>}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="text-[11px] text-zinc-500">Drag ⠿ to reorder. Drag a block from “Add” and drop it between layers.</p>
    </div>
  );
}

/* ───────────────────────── Add ───────────────────────── */
const DESC: Record<SectionType, string> = {
  navbar: '', footer: '', hero: 'Big headline with buttons and a picture', about: 'Your story with a photo and ticks', features: 'Cards for services or benefits', stats: 'Animated numbers that build trust',
  gallery: 'Photo grid with a pop-up viewer', testimonials: 'Customer quotes as cards or a slider', pricing: 'Plans and prices side by side', team: 'Photos and roles of your people',
  faq: 'Questions that expand on tap', cta: 'A bold banner with one button', text: 'Free-form text with a title', html: 'Your own HTML for advanced layouts', contact: 'Details, map and a contact form',
};
export function AddPanel({ api }: { api: EditorApi }) {
  const [q, setQ] = useState('');
  const list = SECTION_ORDER.filter((t) => `${SECTION_DEFS[t].label} ${DESC[t]}`.toLowerCase().includes(q.toLowerCase()));
  const afterSel = (() => { const i = api.cfg.sections.findIndex((s) => s.id === api.sel); return i >= 0 && i < api.cfg.sections.length - 1 ? i + 1 : undefined; })();
  return (
    <div className="space-y-3">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search blocks…" aria-label="Search blocks" className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500" />
      <div className="grid grid-cols-2 gap-2">
        {list.map((t) => (
          <button key={t} draggable={!api.locked} disabled={api.locked}
            onDragStart={(e) => { e.dataTransfer.setData('text/x-add', t); e.dataTransfer.effectAllowed = 'copy'; }}
            onClick={() => api.ops.add(t, afterSel)}
            className="text-left rounded-lg border border-zinc-800 bg-zinc-900/50 hover:border-cyan-500 hover:bg-cyan-500/5 p-3 cursor-pointer disabled:opacity-40 transition-colors">
            <div className="text-2xl mb-1">{SECTION_DEFS[t].icon}</div>
            <div className="text-[13px] font-semibold">{SECTION_DEFS[t].label}</div>
            <div className="text-[10px] text-zinc-400 mt-0.5 leading-snug">{DESC[t]}</div>
          </button>
        ))}
      </div>
      <p className="text-[11px] text-zinc-500">Click to add {afterSel ? 'below the selected block' : 'before the footer'}, or drag onto the Layers list.</p>
    </div>
  );
}

/* ───────────────────────── Media ───────────────────────── */
export function MediaPanel({ api }: { api: EditorApi }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [menu, setMenu] = useState<string | null>(null);
  const ids = Object.keys(api.assets);
  const used = useMemo(() => { const s = JSON.stringify(api.cfg); return new Set(ids.filter((i) => s.includes(`asset:${i}`))); }, [api.cfg, ids]);
  const sel = api.cfg.sections.find((s) => s.id === api.sel);
  const targets = sel ? SECTION_DEFS[sel.type].fields.filter((f) => f.type === 'image') : [];

  const upload = async (files: FileList | File[]) => {
    setBusy(true); setErr('');
    for (const f of Array.from(files)) { try { await api.upload(f); } catch (e: any) { setErr(`${f.name}: ${e.message}`); } }
    setBusy(false);
  };
  const useIn = (assetId: string, key: string) => { if (sel) api.edit('', (c) => { const s = c.sections.find((x) => x.id === sel.id); if (s) s.data[key] = `asset:${assetId}`; }); setMenu(null); };

  return (
    <div className="space-y-3" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files.length && api.isProject && !api.locked) upload(e.dataTransfer.files); }}>
      {api.isProject ? (
        <label className={`block rounded-xl border-2 border-dashed border-zinc-700 hover:border-cyan-500 p-5 text-center cursor-pointer ${api.locked || busy ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="text-2xl">🖼️</div>
          <div className="text-sm font-semibold mt-1">{busy ? 'Uploading…' : 'Upload pictures'}</div>
          <div className="text-[11px] text-zinc-500">Drag & drop or tap to choose · JPG, PNG, WebP, GIF</div>
          <input type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(e) => { if (e.target.files) upload(e.target.files); e.target.value = ''; }} />
        </label>
      ) : <p className="text-xs text-zinc-400">Templates use picture links (paste them into image fields).</p>}
      {err && <p role="alert" className="text-xs text-red-400">{err}</p>}
      <div className="grid grid-cols-2 gap-2">
        {ids.map((id) => (
          <div key={id} className="relative group rounded-lg overflow-hidden border border-zinc-800 bg-zinc-900">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={api.assets[id]} alt="" className="w-full aspect-square object-cover" />
            {used.has(id) && <span className="absolute top-1 left-1 px-1.5 rounded bg-emerald-500 text-black text-[9px] font-mono">in use</span>}
            <div className="absolute inset-x-0 bottom-0 flex gap-1 p-1 bg-gradient-to-t from-black/80 to-transparent opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
              <button disabled={!targets.length || api.locked} onClick={() => (targets.length === 1 ? useIn(id, targets[0].key) : setMenu(menu === id ? null : id))} className="flex-1 px-1.5 py-1 rounded bg-white/90 text-black text-[10px] font-semibold disabled:opacity-40 cursor-pointer" title={targets.length ? 'Use in the selected block' : 'Select a block with a picture first'}>Use</button>
              <button disabled={api.locked} aria-label="Delete picture" onClick={() => { if (!used.has(id) || confirm('This picture is used on your page. Delete anyway?')) api.removeAsset(id); }} className="px-1.5 py-1 rounded bg-red-500/90 text-white text-[10px] cursor-pointer">🗑</button>
            </div>
            {menu === id && targets.length > 1 && <div className="absolute inset-x-1 bottom-9 rounded bg-zinc-900 border border-zinc-600 shadow-xl z-10">{targets.map((f) => <button key={f.key} onClick={() => useIn(id, f.key)} className="block w-full text-left px-2 py-1.5 text-[11px] hover:bg-zinc-800 cursor-pointer">{f.label}</button>)}</div>}
          </div>
        ))}
      </div>
      {api.isProject && ids.length === 0 && <p className="text-xs text-zinc-500 text-center">No pictures yet. Upload some, then use them anywhere on your page.</p>}
    </div>
  );
}

/* ───────────────────────── Design ───────────────────────── */
export function DesignPanel({ api }: { api: EditorApi }) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-xs font-mono text-zinc-400 mb-2">COLOUR THEMES — ONE TAP</h3>
        <div className="grid grid-cols-4 gap-2">
          {PALETTES.map((p) => (
            <button key={p.id} disabled={api.locked} aria-label={`${p.label} theme`} onClick={() => api.edit('', (c) => { c.theme = { ...c.theme, mode: p.mode, primary: p.primary, secondary: p.secondary, bg: p.bg, alt: p.alt, text: p.text }; })} className="rounded-lg border border-zinc-700 hover:border-cyan-500 p-1.5 cursor-pointer disabled:opacity-40">
              <span className="block h-8 rounded" style={{ background: `linear-gradient(135deg, ${p.bg} 0 45%, ${p.primary} 45% 72%, ${p.secondary} 72%)` }} />
              <span className="block text-[10px] mt-1 text-zinc-300">{p.label}</span>
            </button>
          ))}
        </div>
      </div>
      <FieldForm fields={SITE_FIELDS[1].fields} value={api.cfg.theme} ctx={api.ctx} tag="theme" onChange={(nv, t) => api.edit(t, (c) => { c.theme = nv as SiteConfig['theme']; })} />
    </div>
  );
}

/* ───────────────────────── Settings ───────────────────────── */
export function SettingsPanel({ api, onNew, onDuplicate, onBackup, onFullPreview }: { api: EditorApi; onNew: () => void; onDuplicate: () => void; onBackup: () => void; onFullPreview: () => void }) {
  const btn = 'w-full text-left px-3 py-2 rounded-lg border border-zinc-800 hover:border-zinc-500 text-sm cursor-pointer disabled:opacity-40';
  return (
    <div className="space-y-6">
      {api.isProject && (
        <section className="space-y-2">
          <h3 className="text-xs font-mono text-cyan-300">PROJECT</h3>
          <button className={btn} onClick={onNew}>＋ New project…</button>
          <button className={btn} onClick={onDuplicate}>⧉ Duplicate this project</button>
          <button className={btn} onClick={onFullPreview}>↗ Open full preview in a new tab</button>
          <button className={btn} onClick={onBackup}>⬇ Download a backup file (.json)</button>
        </section>
      )}
      <section><h3 className="text-xs font-mono text-cyan-300 mb-2">{SITE_FIELDS[0].title}</h3><FieldForm fields={SITE_FIELDS[0].fields} value={api.cfg.brand} ctx={api.ctx} tag="brand" onChange={(nv, t) => api.edit(t, (c) => { c.brand = nv as SiteConfig['brand']; })} /></section>
      <section><h3 className="text-xs font-mono text-cyan-300 mb-2">{SITE_FIELDS[2].title}</h3><FieldForm fields={SITE_FIELDS[2].fields} value={api.cfg.meta} ctx={api.ctx} tag="meta" onChange={(nv, t) => api.edit(t, (c) => { c.meta = nv as SiteConfig['meta']; })} /></section>
    </div>
  );
}

/* ───────────────────────── Inspector (selected block) ───────────────────────── */
export function Inspector({ api, onClose }: { api: EditorApi; onClose?: () => void }) {
  const s = api.cfg.sections.find((x) => x.id === api.sel);
  const [tab, setTab] = useState<'content' | 'style'>('content');
  if (!s) return <div className="p-4 text-sm text-zinc-500">Select a block on the canvas or in Layers to edit it here.<br /><br />💡 <strong className="text-zinc-300">Double-click any text</strong> on the canvas to type directly.</div>;
  const def = SECTION_DEFS[s.type];
  const content = def.fields.filter((f) => f.group !== 'style');
  const style = def.fields.filter((f) => f.group === 'style');
  const set = (nv: Record<string, any>, tag: string) => api.edit(tag, (c) => { const t = c.sections.find((x) => x.id === s.id); if (t) t.data = nv; });
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-1 px-3 py-2 border-b border-zinc-800">
        <span className="text-lg">{def.icon}</span>
        <div className="flex-1 min-w-0"><div className="text-sm font-semibold truncate">{def.label}</div><div className="text-[10px] font-mono text-zinc-500">{s.id}</div></div>
        {!def.fixed && <>
          <button className={ib} aria-label="Duplicate" disabled={api.locked} onClick={() => api.ops.duplicate(s.id)}>⧉</button>
          <button className={ib} aria-label="Delete" disabled={api.locked} onClick={() => api.ops.remove(s.id)}>🗑</button>
        </>}
        {onClose && <button className={ib} aria-label="Close" onClick={onClose}>✕</button>}
      </div>
      {style.length > 0 && (
        <div className="flex border-b border-zinc-800" role="tablist">
          {(['content', 'style'] as const).map((k) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`flex-1 py-2 text-xs font-mono cursor-pointer border-b-2 ${tab === k ? 'border-cyan-400 text-cyan-300' : 'border-transparent text-zinc-400'}`}>{k === 'content' ? 'Content' : 'Style & menu'}</button>)}
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-3">
        <FieldForm key={`${s.id}-${tab}`} fields={tab === 'content' || !style.length ? content : style} value={s.data} ctx={api.ctx} tag={`${s.id}.${tab}`} onChange={set} />
      </div>
    </div>
  );
}
