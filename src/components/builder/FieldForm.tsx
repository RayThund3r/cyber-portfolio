// src/components/builder/FieldForm.tsx — renders ANY schema fields as a friendly, no-code form.
'use client';

import { useState } from 'react';
import type { Field } from '@/lib/builder/schema';
import Icon from '@/components/ui/IconAny';
import { useSiteSettings } from '@/context/SiteSettingsContext';
import { useSortable } from './useSortable';
import { cloudToken, cloudVerifier, hashPass } from '@/lib/builder/sha256';

import { IconCart, IconCheck, IconCheckCircle, IconClose, IconCode, IconCopy, IconDesktop, IconEye, IconEyeOff, IconImage, IconLayers, IconLock, IconPalette, IconPaperclip, IconPencil, IconPhone, IconPlus, IconSettings, IconSparkle, IconTablet, IconTrash, IconWarn, IconBulb, IconFolder, IconArrowUp, IconArrowDown, IconExternal } from './icons';
export interface FormCtx {
  sections: { id: string; label: string }[];          // for "link to a section" pickers
  assets: Record<string, string>;                      // asset id → data URL (preview)
  upload: ((file: File) => Promise<string>) | null;    // returns asset id; null = URLs only
  disabled: boolean;
  /** Pro sites: the site key that salts the owner-passcode hash. */
  siteKey?: string;
}

const inp = 'w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-cyan-500 disabled:opacity-50';
const small = 'px-2 py-1 rounded border border-zinc-700 text-[11px] font-mono hover:border-zinc-500 disabled:opacity-30 cursor-pointer';
const EMOJIS = ['⭐', '🚀', '💡', '🔧', '📱', '💻', '🎨', '🛒', '❤️', '✅', '📞', '🏆', '🍲', '☕', '🔒', '⚡', '🌍', '🤝', '📈', '🎓'];

export const resolveImg = (v: string, assets: Record<string, string>) => (v?.startsWith('asset:') ? assets[v.slice(6)] || '' : v || '');

export function FieldForm({ fields, value, onChange, ctx, tag }: {
  fields: Field[]; value: Record<string, any>; onChange: (v: Record<string, any>, tag: string) => void; ctx: FormCtx; tag: string;
}) {
  return (
    <div className="space-y-3">
      {fields.filter((f) => !f.hidden).map((f) => (
        <FieldRow key={f.key} f={f} v={value[f.key]} ctx={ctx} tag={`${tag}.${f.key}`} set={(nv, t) => onChange({ ...value, [f.key]: nv }, t)} setMany={(patch, t) => onChange({ ...value, ...patch }, t)} />
      ))}
    </div>
  );
}

function Label({ f, children }: { f: Field; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-mono text-zinc-400 mb-1">{f.label}</span>
      {children}
      {f.help && <span className="block text-[11px] text-zinc-500 mt-1">{f.help}</span>}
    </label>
  );
}

function FieldRow({ f, v, set, setMany, ctx, tag }: { f: Field; v: any; set: (v: any, tag: string) => void; setMany: (patch: Record<string, any>, tag: string) => void; ctx: FormCtx; tag: string }) {
  const dis = ctx.disabled;
  switch (f.type) {
    case 'text':
      return <Label f={f}><input className={inp} disabled={dis} value={v ?? ''} maxLength={f.max} placeholder={f.placeholder} onChange={(e) => set(e.target.value, tag)} /></Label>;
    case 'textarea':
      return <Label f={f}><textarea className={inp} rows={3} disabled={dis} value={v ?? ''} maxLength={f.max} placeholder={f.placeholder} onChange={(e) => set(e.target.value, tag)} /></Label>;
    case 'number':
      return <Label f={f}><input type="number" inputMode="decimal" className={inp} disabled={dis} min={f.min} max={f.max} value={v ?? ''} onChange={(e) => set(e.target.value === '' ? '' : Number(e.target.value), tag)} /></Label>;
    case 'passcode':
      return <PasscodeField f={f} v={v} setMany={(patch) => setMany(patch, tag)} ctx={ctx} />;
    case 'code':
      return <Label f={f}><textarea className={`${inp} font-mono text-xs leading-5`} rows={8} spellCheck={false} wrap="off" disabled={dis} value={v ?? ''} maxLength={f.max} onChange={(e) => set(e.target.value, tag)} /></Label>;
    case 'select':
      return <Label f={f}><select className={inp} disabled={dis} value={v ?? f.def} onChange={(e) => set(e.target.value, tag)}>{f.options!.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></Label>;
    case 'toggle':
      return (
        <label className="flex items-center gap-2 text-sm text-zinc-200 cursor-pointer">
          <input type="checkbox" disabled={dis} checked={!!v} onChange={(e) => set(e.target.checked, tag)} className="w-4 h-4 accent-cyan-500" />
          {f.label}
        </label>
      );
    case 'color':
      return (
        <Label f={f}>
          <span className="flex items-center gap-2">
            <input type="color" disabled={dis} value={v || '#000000'} onChange={(e) => set(e.target.value, tag)} className="w-10 h-9 rounded border border-zinc-700 bg-transparent cursor-pointer" />
            <code className="text-xs text-zinc-400">{v}</code>
          </span>
        </Label>
      );
    case 'emoji':
      return (
        <Label f={f}>
          <input className={`${inp} mb-1.5`} disabled={dis} maxLength={8} value={v ?? ''} onChange={(e) => set(e.target.value, tag)} />
          <span className="flex flex-wrap gap-1">{EMOJIS.map((em) => <button type="button" key={em} disabled={dis} onClick={() => set(em, tag)} className="w-7 h-7 rounded hover:bg-zinc-800 cursor-pointer">{em}</button>)}</span>
        </Label>
      );
    case 'url':
      return (
        <Label f={f}>
          <input className={inp} disabled={dis} value={v ?? ''} placeholder="https://…  or  #  or  mailto:you@mail.com" onChange={(e) => set(e.target.value, tag)} />
          <select aria-label="Link to a section" className={`${inp} mt-1.5 text-xs`} disabled={dis} value="" onChange={(e) => e.target.value && set(e.target.value, tag)}>
            <option value="">↳ or link to a section of this site…</option>
            <option value="#">Top of the page</option>
            {ctx.sections.map((s) => <option key={s.id} value={`#sec-${s.id}`}>{s.label}</option>)}
          </select>
        </Label>
      );
    case 'image':
      return <ImageField f={f} v={v} set={(nv) => set(nv, tag)} ctx={ctx} />;
    case 'list':
      return <ListField f={f} items={Array.isArray(v) ? v : []} set={(nv, t) => set(nv, t)} ctx={ctx} tag={tag} />;
  }
}

function ImageField({ f, v, set, ctx }: { f: Field; v: string; set: (v: string) => void; ctx: FormCtx }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const src = resolveImg(v, ctx.assets);
  const pick = async (file?: File) => {
    if (!file || !ctx.upload) return;
    setBusy(true); setErr(null);
    try { set(`asset:${await ctx.upload(file)}`); } catch (e: any) { setErr(e.message || 'Upload failed'); } finally { setBusy(false); }
  };
  const dd = useSiteSettings().features.dragDrop;
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={dd ? (e) => { if (ctx.upload && !ctx.disabled && e.dataTransfer.types.includes('Files')) { e.preventDefault(); setOver(true); } } : undefined}
      onDragLeave={dd ? () => setOver(false) : undefined}
      onDrop={dd ? (e) => { e.preventDefault(); setOver(false); if (!ctx.disabled) pick(e.dataTransfer.files?.[0]); } : undefined}
      className={over ? 'rounded-lg bg-cyan-500/10 outline outline-2 outline-dashed outline-cyan-400 outline-offset-4' : undefined}
    >
      <span className="block text-[11px] font-mono text-zinc-400 mb-1">{f.label}{dd && ctx.upload && !ctx.disabled && <span className="text-zinc-600"> · or drop a picture here</span>}</span>
      <div className="flex gap-3 items-start">
        <div className="w-20 h-16 rounded border border-zinc-800 bg-zinc-900 overflow-hidden flex-none flex items-center justify-center text-zinc-600 text-xs">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {src ? <img src={src} alt="" className="w-full h-full object-cover" /> : 'none'}
        </div>
        <div className="flex-1 space-y-1.5 min-w-0">
          <div className="flex flex-wrap gap-1.5">
            {ctx.upload && (
              <label className={`${small} ${ctx.disabled || busy ? 'opacity-40 pointer-events-none' : ''}`}>
                {busy ? 'Uploading…' : '⬆ Upload picture'}
                <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
              </label>
            )}
            {v && <button type="button" disabled={ctx.disabled} className={small} onClick={() => set('')}>Remove</button>}
          </div>
          <input className={`${inp} text-xs`} disabled={ctx.disabled} placeholder="…or paste a picture link (https://…)" value={v?.startsWith('asset:') ? '' : v ?? ''} onChange={(e) => set(e.target.value.trim())} />
          {err && <p role="alert" className="text-[11px] text-red-400">{err}</p>}
          {!ctx.upload && <p className="text-[11px] text-zinc-500">Templates use picture links.</p>}
        </div>
      </div>
    </div>
  );
}

function ListField({ f, items, set, ctx, tag }: { f: Field; items: Record<string, any>[]; set: (v: any, tag: string) => void; ctx: FormCtx; tag: string }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const max = f.max ?? 12;
  const blank = () => Object.fromEntries(f.fields!.map((x) => [x.key, x.type === 'list' ? [] : x.def ?? (x.type === 'toggle' ? false : '')]));
  const titleOf = (it: Record<string, any>, i: number) => String(it[f.titleKey || f.fields![0].key] || '').slice(0, 40) || `${f.itemLabel || 'Item'} ${i + 1}`;
  const dd = useSiteSettings().features.dragDrop; // OPTIONAL (Admin → SETTINGS): drag handle on top of the arrow buttons
  const sort = useSortable({
    count: items.length, disabled: ctx.disabled || !dd,
    onReorder: (from, to) => { const n = [...items]; const [m] = n.splice(from, 1); n.splice(to, 0, m); set(n, `${tag}.move`); setOpenIdx(to); },
  });
  const move = (i: number, d: number) => { const n = [...items]; const j = i + d; if (j < 0 || j >= n.length) return; [n[i], n[j]] = [n[j], n[i]]; set(n, `${tag}.move`); setOpenIdx(j); };

  return (
    <div className="rounded-lg border border-zinc-800 p-3 bg-zinc-900/30">
      <div className="text-[11px] font-mono text-zinc-400 mb-2">{f.label} <span className="text-zinc-600">({items.length}/{max})</span></div>
      {dd && <span className="sr-only" role="status">{sort.status}</span>}
      <ul className="space-y-2">
        {items.map((it, i) => (
          <li key={i} {...(dd ? sort.itemProps(i) : {})} className="rounded border border-zinc-800 bg-zinc-950">
            <div className="flex items-center gap-1 px-2 py-1.5">
              {dd && items.length > 1 && <button {...sort.handleProps(i)} aria-label="Drag to reorder" className="flex h-8 w-6 flex-none items-center justify-center rounded text-zinc-500 hover:text-cyan-300"><Icon name="grip" size={16} /></button>}
              <button type="button" className="flex-1 text-left text-xs text-zinc-200 truncate cursor-pointer" onClick={() => setOpenIdx(openIdx === i ? null : i)} aria-expanded={openIdx === i}>
                {openIdx === i ? '▾' : '▸'} {titleOf(it, i)}
              </button>
              <button type="button" aria-label="Move up" disabled={ctx.disabled || i === 0} className={small} onClick={() => move(i, -1)}><IconArrowUp size={14} /></button>
              <button type="button" aria-label="Move down" disabled={ctx.disabled || i === items.length - 1} className={small} onClick={() => move(i, 1)}><IconArrowDown size={14} /></button>
              <button type="button" aria-label="Remove" disabled={ctx.disabled} className={small} onClick={() => { set(items.filter((_, k) => k !== i), `${tag}.del`); setOpenIdx(null); }}><IconTrash size={14} /></button>
            </div>
            {openIdx === i && (
              <div className="p-3 border-t border-zinc-800">
                <FieldForm fields={f.fields!} value={it} ctx={ctx} tag={`${tag}.${i}`} onChange={(nv, t) => set(items.map((x, k) => (k === i ? nv : x)), t)} />
              </div>
            )}
          </li>
        ))}
      </ul>
      <button type="button" disabled={ctx.disabled || items.length >= max} className={`${small} mt-2`} onClick={() => { set([...items, blank()], `${tag}.add`); setOpenIdx(items.length); }}>
        + Add {f.itemLabel?.toLowerCase() || 'item'}
      </button>
    </div>
  );
}

/** Only a SHA-256 hash of the passcode is ever stored (the plain text never leaves this component). */
function PasscodeField({ f, v, setMany, ctx }: { f: Field; v: string; setMany: (patch: Record<string, string>) => void; ctx: FormCtx }) {
  const [val, setVal] = useState('');
  const [err, setErr] = useState('');
  const save = () => {
    if (val.length < 8) { setErr('Use at least 8 characters.'); return; }
    if (!ctx.siteKey) { setErr('Not ready yet — try again in a moment.'); return; }
    // two derived values from one passcode: the site-login hash, and the cloud inbox verifier (a hash of a hash). The passcode itself is never stored.
    setMany({ [f.key]: hashPass(ctx.siteKey, val), ...(f.companion ? { [f.companion]: cloudVerifier(cloudToken(ctx.siteKey, val)) } : {}) }); setVal(''); setErr('');
  };
  const clear = () => setMany({ [f.key]: '', ...(f.companion ? { [f.companion]: '' } : {}) });
  return (
    <div>
      <span className="block text-[11px] font-mono text-zinc-400 mb-1">{f.label}</span>
      <p className={`text-xs mb-2 ${v ? 'text-emerald-300' : 'text-zinc-400'}`}>{v ? '✓ Your own passcode is set (stored scrambled — nobody can read it back).' : 'No passcode set yet — we will generate a strong one and put it in your download (ADMIN-PASSCODE.txt).'}</p>
      <div className="flex gap-2">
        <input type="password" autoComplete="new-password" className={inp} disabled={ctx.disabled} value={val} placeholder="Choose a passcode (8+ characters)" onChange={(e) => setVal(e.target.value)} />
        <button type="button" disabled={ctx.disabled || !val} className={small} onClick={save}>Set</button>
        {v && <button type="button" disabled={ctx.disabled} className={small} onClick={clear}>Remove</button>}
      </div>
      {err && <p role="alert" className="text-[11px] text-red-400 mt-1">{err}</p>}
    </div>
  );
}
