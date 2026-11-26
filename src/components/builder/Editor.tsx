// src/components/builder/Editor.tsx
//
// Figma/Canva-style website editor.
//   • DESIGN mode: click blocks to select, double-click text to type on the canvas, drag layers, inspector, AI, code.
//   • VIEW mode: the finished site, fully interactive, exactly what visitors get.
// Desktop: tool rail + panel + canvas + inspector.  Mobile: canvas + bottom navigation + bottom sheets.
'use client';

import { type ReactElement, useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import Link from 'next/link';
import { SECTION_DEFS, newSection, type SectionType, type SiteConfig } from '@/lib/builder/schema';
import { readinessWarnings } from '@/lib/builder/readiness';
import ProContent from './ProContent';
import { frameReducer, initialFrames } from '@/lib/builder/frames';
import { buildSite } from '@/lib/builder/generate';
import type { FormCtx } from './FieldForm';
import type { EditorApi } from './editorApi';
import { AddPanel, DesignPanel, Inspector, LayersPanel, MediaPanel, SettingsPanel } from './Panels';
import AIPanel from './AIPanel';
import CodePanel from './CodePanel';
import GuidedTour, { type TourStep } from './GuidedTour';
import Portal from '@/components/ui/Portal';
import { BuyModal, NewProjectModal } from './Modals';
import { quote as smartQuote, type RateCard } from '@/lib/builder/smartPricing';
import { compressImage, lsDel, lsGet, lsSet, post, setPath } from './lib';
import { rememberProject } from '@/utils/useProjectRef';
import ImportBackup from './ImportBackup';
import { readAssets as readLocalAssets, readCopy, restoreToServer, writeAssets, writeCopy } from '@/lib/builder/localCopy';
import type { TemplateDef } from '@/lib/builder/templates';

import { IconCart, IconCheck, IconCheckCircle, IconClose, IconCode, IconCopy, IconDesktop, IconEye, IconEyeOff, IconImage, IconLayers, IconLock, IconPalette, IconPaperclip, IconPencil, IconPhone, IconPlus, IconSettings, IconSparkle, IconTablet, IconTrash, IconWarn, IconBulb, IconFolder, IconBack, IconUndo, IconRedo, IconExternal, IconMinus, IconInfo, IconDownload } from './icons';
type Tool = 'layers' | 'add' | 'media' | 'design' | 'ai' | 'code' | 'settings' | 'content';
const TOOLS: { k: Tool; icon: (p: { size?: number }) => ReactElement; label: string }[] = [
  { k: 'layers', icon: IconLayers, label: 'Layers' }, { k: 'add', icon: IconPlus, label: 'Add' }, { k: 'media', icon: IconImage, label: 'Media' },
  { k: 'design', icon: IconPalette, label: 'Design' }, { k: 'ai', icon: IconSparkle, label: 'AI' }, { k: 'code', icon: IconCode, label: 'Code' }, { k: 'settings', icon: IconSettings, label: 'Project' },
];
const TOOLS_PRO: { k: Tool; icon: (p: { size?: number }) => ReactElement; label: string }[] = [
  { k: 'content', icon: IconLayers, label: 'Content' }, { k: 'media', icon: IconImage, label: 'Media' }, { k: 'ai', icon: IconSparkle, label: 'AI' }, { k: 'code', icon: IconCode, label: 'Code' }, { k: 'settings', icon: IconSettings, label: 'Project' },
];
const ZOOMS = [0.25, 0.5, 0.67, 0.75, 0.9, 1, 1.25, 1.5, 2];
const DEVICE_W = { desktop: null, tablet: 820, mobile: 390 } as const;
type Device = keyof typeof DEVICE_W;

/** Undo history is stored as JSON strings with a byte budget — an 80-step history of a large site would otherwise hold ~80 full copies in memory. */
interface Hist { past: string[]; present: SiteConfig; future: string[]; tag: string; t: number; v: number; bytes: number }
const MAX_HIST_CHARS = 12_000_000;
interface Meta { smart?: { card: RateCard; floor: number } | null; templateId?: string; name: string; templateName: string; priceUGX: number | null; order: { ticket: string; paid: boolean; price: number } | null; updatedAt: string }

function useMedia(q: string) {
  const [m, setM] = useState(false);
  useEffect(() => { const mq = window.matchMedia(q); const f = () => setM(mq.matches); f(); mq.addEventListener('change', f); return () => mq.removeEventListener('change', f); }, [q]);
  return m;
}

const tb = 'h-9 min-w-9 px-2.5 rounded-lg text-xs font-sans text-zinc-300 hover:bg-zinc-800 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors';

function Sheet({ title, onClose, children, tall }: { title: string; onClose: () => void; children: React.ReactNode; tall?: boolean }) {
  const [big, setBig] = useState(false);
  return (
    <div className={`fixed inset-x-0 bottom-14 z-40 bg-zinc-950 border-t border-zinc-700 rounded-t-2xl shadow-[0_-12px_40px_rgba(0,0,0,.5)] flex flex-col ${big ? 'h-[86vh]' : tall ? 'h-[70vh]' : 'h-[52vh]'} transition-[height] duration-200`} role="dialog" aria-label={title}>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-800">
        <button className="mx-auto absolute left-1/2 -translate-x-1/2 -top-0 w-10 h-1.5 mt-1.5 rounded-full bg-zinc-600 cursor-pointer" aria-label="Resize panel" onClick={() => setBig(!big)} />
        <span className="text-sm font-semibold mt-2">{title}</span>
        <button className="ml-auto mt-2 w-8 h-8 rounded hover:bg-zinc-800 cursor-pointer" aria-label="Close panel" onClick={onClose}><IconClose size={16} /></button>
      </div>
      <div className="flex-1 min-h-0 flex flex-col">{children}</div>
    </div>
  );
}

export default function Editor({ mode, id, keyStr }: { mode: 'project' | 'template'; id: string; keyStr?: string }) {
  const isProject = mode === 'project';
  const isLg = useMedia('(min-width: 1024px)');
  const isXl = useMedia('(min-width: 1280px)');

  const [hist, setHist] = useState<Hist | null>(null);
  const [assets, setAssets] = useState<Record<string, string>>({});
  const [meta, setMeta] = useState<Meta | null>(null);
  const [projName, setProjName] = useState('');
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [tool, setTool] = useState<Tool | null>(null);
  const [viewMode, setViewMode] = useState(false);
  const [tour, setTour] = useState(false);
  const [device, setDevice] = useState<Device>('desktop');
  const [zoom, setZoom] = useState(1);
  const [fit, setFit] = useState(true);
  const [sel, setSel] = useState<string | null>(null);
  const [inspOpen, setInspOpen] = useState(false);
  const [save, setSave] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveErr, setSaveErr] = useState('');
  const [conflict, setConflict] = useState(false);
  const [draft, setDraft] = useState<{ cfg: SiteConfig; name: string } | null>(null);
  const [online, setOnline] = useState(true);
  const [errors, setErrors] = useState<{ m: string; l: number }[]>([]);
  const [buy, setBuy] = useState(false);
  const [newProj, setNewProj] = useState(false);
  const [busy, setBusy] = useState(false);
  // two stacked iframes: the new document loads in the hidden one and is swapped in when ready → no white flash on every edit
  const [fr, dispatchFr] = useReducer(frameReducer, initialFrames);
  const docs = fr.docs, front = fr.front;
  const docsRef = useRef(docs); docsRef.current = docs;
  const [nameV, setNameV] = useState(0);
  const [avail, setAvail] = useState({ w: 900, h: 600 });
  const [hint, setHint] = useState(false);

  const frameA = useRef<HTMLIFrameElement>(null), frameB = useRef<HTMLIFrameElement>(null);
  const frames = [frameA, frameB];
  const frontRef = useRef<0 | 1>(0); frontRef.current = front;
  const canvasRef = useRef<HTMLDivElement>(null);
  const yRef = useRef(0);
  const metaRef = useRef<Meta | null>(null); metaRef.current = meta;
  const savedRef = useRef('');                      // content signature at load (only for draft recovery)
  const savedV = useRef({ v: 0, n: 0 });           // version of what the server has — O(1) dirty checks instead of re-serialising the site
  const revRef = useRef(0);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const retries = useRef(0);
  const cfg = hist?.present;
  const locked = !!meta?.order;
  const draftKey = `sys_draft_${id}`;
  const latest = useRef<{ cfg?: SiteConfig; name: string; v: number; n: number }>({ name: '', v: 0, n: 0 });
  latest.current = { cfg, name: projName, v: hist?.v ?? 0, n: nameV };
  const isPro = cfg?.kind === 'pro';

  /* ───────── load ───────── */
  useEffect(() => {
    (async () => {
      let loadedKind: string | undefined;
      try {
        if (isProject) {
          let d: any;
          try { d = await post('/api/builder', { action: 'load', id, key: keyStr }); }
          catch (e: any) {
            // The server may have forgotten this site (host without a database). If THIS browser holds its copy under the same key, put it back.
            const copy = e?.status === 404 ? readCopy(id) : null;
            if (!copy || copy.key !== keyStr) throw e;
            await restoreToServer(post, copy, await readLocalAssets(id));
            d = await post('/api/builder', { action: 'load', id, key: keyStr });
            setNotice('Your site had been cleared from our server, so we restored it from this device. Nothing was lost.');
          }
          loadedKind = d.config?.kind;
          setHist({ past: [], present: d.config, future: [], tag: '', t: 0, v: 0, bytes: 0 });
          setAssets(d.assets || {}); setProjName(d.name); revRef.current = d.rev || 0;
          setMeta({ smart: d.smart ?? null, templateId: d.templateId, name: d.name, templateName: d.templateName, priceUGX: d.priceUGX, order: d.order, updatedAt: d.updatedAt || '' });
          savedRef.current = JSON.stringify([d.config, d.name]);
          rememberProject({ id: d.id, key: keyStr!, name: d.name, template: d.templateName });
          writeCopy({ id: d.id, key: keyStr!, name: d.name, templateId: d.templateId || 'blank', templateName: d.templateName || '', config: d.config, rev: d.rev || 0 });
          void writeAssets(d.id, d.assets || {});
          try { // recover unsaved edits from this device (e.g. the connection dropped or the tab crashed)
            const raw = lsGet(draftKey); const dr = raw ? JSON.parse(raw) : null;
            if (dr && dr.at > Date.parse(d.updatedAt || 0) && JSON.stringify([dr.cfg, dr.name]) !== savedRef.current) setDraft({ cfg: dr.cfg, name: dr.name });
          } catch { /* ignore */ }
        } else {
          const d = await post('/api/admin', { action: 'template.get', id });
          loadedKind = d.template.config?.kind;
          setHist({ past: [], present: d.template.config, future: [], tag: '', t: 0, v: 0, bytes: 0 });
          setMeta({ name: d.template.name, templateName: d.template.name, priceUGX: null, order: null, updatedAt: '' });
          savedRef.current = JSON.stringify([d.template.config, '']);
        }
        savedV.current = { v: 0, n: 0 };
        setTool(window.matchMedia('(min-width: 1024px)').matches ? (loadedKind === 'pro' ? 'content' : 'layers') : null);
        setHint(!lsGet('sys_builder_hint'));
      } catch (e: any) { setLoadErr(e.status === 401 ? 'Please sign in to the admin panel first, then reopen this page.' : e.message || 'Could not load.'); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isProject, id, keyStr]);

  /* ───────── editing + undo/redo ───────── */
  const edit = useCallback((tag: string, fn: (c: SiteConfig) => void) => {
    setHist((h) => {
      if (!h || locked) return h;
      const next = structuredClone(h.present);
      fn(next);
      const merge = !!tag && h.tag === tag && Date.now() - h.t < 900; // typing in one field = ONE undo step
      let past = h.past, bytes = h.bytes;
      if (!merge) {
        const snap = JSON.stringify(h.present); past = [...past, snap]; bytes += snap.length;
        while ((bytes > MAX_HIST_CHARS || past.length > 120) && past.length > 1) { bytes -= past[0].length; past = past.slice(1); }
      }
      return { past, present: next, future: [], tag, t: Date.now(), v: h.v + 1, bytes };
    });
  }, [locked]);
  const undo = useCallback(() => setHist((h) => {
    if (!h || !h.past.length) return h;
    const snap = h.past[h.past.length - 1];
    return { past: h.past.slice(0, -1), present: JSON.parse(snap), future: [JSON.stringify(h.present), ...h.future].slice(0, 120), tag: '', t: 0, v: h.v + 1, bytes: h.bytes - snap.length };
  }), []);
  const redo = useCallback(() => setHist((h) => {
    if (!h || !h.future.length) return h;
    const snap = JSON.stringify(h.present);
    return { past: [...h.past, snap], present: JSON.parse(h.future[0]), future: h.future.slice(1), tag: '', t: 0, v: h.v + 1, bytes: h.bytes + snap.length };
  }), []);

  /* ───────── saving: queued, retried with back-off, conflict-aware, draft backup ───────── */
  const flush = useCallback((force = false): Promise<void> => {
    queue.current = queue.current.then(async () => {
      const { cfg: c, name, v, n } = latest.current;
      if (!c) return;
      if (savedV.current.v === v && savedV.current.n === n) { setSave('saved'); return; }
      setSave('saving');
      try {
        if (isProject) { const d = await post('/api/builder', { action: 'save', id, key: keyStr, config: c, name, baseRev: revRef.current, force }); revRef.current = d.rev; }
        else await post('/api/admin', { action: 'template.saveConfig', id, config: c });
        savedV.current = { v, n }; retries.current = 0; setConflict(false); setSave('saved');
        if (isProject) { const m = metaRef.current; writeCopy({ id, key: keyStr!, name, templateId: m?.templateId || 'blank', templateName: m?.templateName || '', config: c, rev: revRef.current }); }
      } catch (e: any) {
        setSave('error');
        if (e.data?.conflict) { setConflict(true); setSaveErr('Changed in another tab or device.'); return; }
        setSaveErr(e.message || 'Could not save');
        if (e.status && e.status < 500 && e.status !== 429) return; // permanent error (locked, not found…) — don't hammer
        if (retries.current < 6) { const wait = Math.min(30000, 2000 * 2 ** retries.current++); setTimeout(() => flush(), wait); }
      }
    });
    return queue.current;
  }, [isProject, id, keyStr]);

  useEffect(() => {
    if (!cfg || locked || conflict) return;
    if (savedV.current.v === (hist?.v ?? 0) && savedV.current.n === nameV) return;
    setSave('idle');
    const t1 = setTimeout(() => { if (isProject) lsSet(draftKey, JSON.stringify({ cfg, name: projName, at: Date.now() })); }, 500);
    const t2 = setTimeout(() => flush(), 1200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [cfg, projName, nameV, hist?.v, locked, conflict, flush, isProject, draftKey]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { const l = latest.current; if (l.cfg && !locked && (savedV.current.v !== l.v || savedV.current.n !== l.n)) e.preventDefault(); };
    const on = () => { setOnline(true); retries.current = 0; flush(); }, off = () => setOnline(false);
    setOnline(navigator.onLine);
    window.addEventListener('beforeunload', warn); window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('beforeunload', warn); window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, [locked, flush]);

  /* ───────── canvas: iframe document + size ───────── */
  const html = useMemo(() => (cfg ? buildSite(cfg, { mode: viewMode ? 'view' : 'preview', assetSrc: (a) => assets[a] || '' }).html : ''), [cfg, assets, viewMode]);
  useEffect(() => {
    if (!html) return;
    const t = setTimeout(() => dispatchFr({ t: 'doc', doc: html.replace('/*Y*/0', `/*Y*/${Math.round(yRef.current)}`) }), docsRef.current[frontRef.current] ? 250 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html]);
  const onFrameLoad = (i: 0 | 1) => {
    const swaps = i !== frontRef.current && !!docsRef.current[i];   // an empty frame's load event is ignored by the reducer too
    if (swaps) frontRef.current = i;
    dispatchFr({ t: 'load', i });
    if (i === frontRef.current) setTimeout(() => { if (sel && !viewMode && !isPro) frames[i].current?.contentWindow?.postMessage({ t: 'select', id: sel }, '*'); }, 0);
  };

  const ready = !!cfg;
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const measure = () => setAvail({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ready, viewMode]);

  const post2 = useCallback((m: unknown) => frames[frontRef.current].current?.contentWindow?.postMessage(m, '*'), []); // eslint-disable-line react-hooks/exhaustive-deps
  const select = useCallback((sid: string | null, scroll = false) => {
    setSel(sid);
    if (sid && !isPro) { post2({ t: scroll ? 'go' : 'select', id: sid }); if (!isLg) setInspOpen(true); else if (!isXl) setInspOpen(true); }
    else post2({ t: 'select', id: null });
  }, [post2, isLg, isXl, isPro]);
  useEffect(() => { if (cfg && sel && !cfg.sections.some((s) => s.id === sel)) setSel(null); }, [cfg, sel]);

  /* ───────── section operations ───────── */
  const ops: EditorApi['ops'] = useMemo(() => ({
    move: (sid, d) => edit('', (c) => { const i = c.sections.findIndex((s) => s.id === sid), j = i + d; if (i < 1 || j < 1 || j > c.sections.length - 2) return; [c.sections[i], c.sections[j]] = [c.sections[j], c.sections[i]]; }),
    moveBefore: (sid, before) => edit('', (c) => {
      const i = c.sections.findIndex((s) => s.id === sid);
      if (i < 1 || i >= c.sections.length - 1) return;
      const [s] = c.sections.splice(i, 1);
      let at = i < before ? before - 1 : before;
      at = Math.min(Math.max(1, at), c.sections.length - 1);
      c.sections.splice(at, 0, s);
    }),
    toggle: (sid) => edit('', (c) => { const s = c.sections.find((x) => x.id === sid); if (s) s.visible = !s.visible; }),
    remove: (sid) => { if (!confirm('Delete this block?')) return; edit('', (c) => { c.sections = c.sections.filter((s) => s.id !== sid); }); },
    duplicate: (sid) => {
      const copyId = 'cp' + Math.random().toString(36).slice(2, 8);
      edit('', (c) => { const i = c.sections.findIndex((s) => s.id === sid); if (i < 0 || SECTION_DEFS[c.sections[i].type].fixed) return; const cp = structuredClone(c.sections[i]); cp.id = copyId; c.sections.splice(i + 1, 0, cp); });
      setTimeout(() => select(copyId, true), 350);
    },
    add: (type: SectionType, before) => {
      const s = newSection(type);
      edit('', (c) => { const at = Math.min(Math.max(1, before ?? c.sections.length - 1), c.sections.length - 1); c.sections.splice(at, 0, s); });
      setTimeout(() => select(s.id, true), 400);
    },
  }), [edit, select]);

  /* ───────── pictures ───────── */
  const upload = useCallback(async (file: File) => {
    const c = await compressImage(file);
    const r = await post('/api/builder', { action: 'upload', id, key: keyStr, mime: c.mime, data: c.data });
    setAssets((a) => { const n = { ...a, [r.id]: c.dataUrl }; void writeAssets(id, n); return n; });
    return { id: r.id as string, dataUrl: c.dataUrl, mime: c.mime, data: c.data };
  }, [id, keyStr]);
  const removeAsset = useCallback(async (aid: string) => {
    try { await post('/api/builder', { action: 'deleteAsset', id, key: keyStr, assetId: aid }); setAssets((a) => { const n = { ...a }; delete n[aid]; void writeAssets(id, n); return n; }); } catch (e: any) { alert(e.message); }
  }, [id, keyStr]);

  const ctx: FormCtx = useMemo(() => ({
    sections: (cfg?.sections || []).filter((s) => s.type !== 'navbar' && s.type !== 'footer').map((s) => ({ id: s.id, label: `${SECTION_DEFS[s.type].label}${s.data.title ? ' — ' + String(s.data.title).slice(0, 24) : ''}` })),
    assets, disabled: locked, upload: isProject ? async (f: File) => (await upload(f)).id : null, siteKey: cfg?.pro?.key,
  }), [cfg, assets, locked, isProject, upload]);

  const api: EditorApi = { cfg: cfg as SiteConfig, assets, locked, isProject, projectId: id, projectKey: keyStr, sel, select, edit, undo, redo, ctx, ops, upload, removeAsset, errors, clearErrors: () => setErrors([]) };
  const apiRef = useRef(api); apiRef.current = api;

  /* ───────── messages from the canvas ───────── */
  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (!frames.some((r) => r.current?.contentWindow === e.source)) return;
      const fromFront = e.source === frames[frontRef.current].current?.contentWindow;
      const m = e.data || {};
      const a = apiRef.current;
      if (m.t !== 'err' && !fromFront) return; // only the visible document may edit; a still-loading one may only report errors
      if (m.t === 'y') yRef.current = m.y;
      else if (m.t === 'sel' && typeof m.id === 'string') { setSel(m.id); setInspOpen(true); }
      else if (m.t === 'edit' && typeof m.f === 'string') {
        const [sid, path] = m.f.split('|');
        a.edit(`inline:${m.f}`, (c) => { const s = c.sections.find((x) => x.id === sid); if (s) setPath(s.data, path, String(m.v).slice(0, 3000)); });
      } else if (m.t === 'act') {
        if (m.a === 'up') a.ops.move(m.id, -1); else if (m.a === 'down') a.ops.move(m.id, 1);
        else if (m.a === 'dup') a.ops.duplicate(m.id); else if (m.a === 'del') a.ops.remove(m.id);
      } else if (m.t === 'err') setErrors((x) => [...x.slice(-40), { m: String(m.m).slice(0, 200), l: Number(m.l) || 0 }]);
    };
    window.addEventListener('message', on);
    return () => window.removeEventListener('message', on);
  }, []);

  /* ───────── keyboard shortcuts ───────── */
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (/INPUT|TEXTAREA|SELECT/.test(el.tagName) || el.isContentEditable) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
      else if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
      else if (mod && e.key.toLowerCase() === 'd' && sel) { e.preventDefault(); ops.duplicate(sel); }
      else if ((e.key === 'Delete' || e.key === 'Backspace') && sel && !viewMode) { const s = cfg?.sections.find((x) => x.id === sel); if (s && !SECTION_DEFS[s.type].fixed) { e.preventDefault(); ops.remove(sel); } }
      else if (e.key === 'Escape') select(null);
      else if (e.altKey && e.key.toLowerCase() === 'v') { e.preventDefault(); setViewMode((v) => !v); }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [undo, redo, sel, ops, viewMode, cfg, select]);

  /* ───────── project actions ───────── */
  const fullPreview = () => {
    if (!cfg) return;
    const b = buildSite(cfg, { mode: 'export', assetSrc: (a) => assets[a] || '' });
    let page = b.html;
    // NOTE: function replacements on purpose — the engine's source contains "$$" and "$&", which a string replacement would mangle
    for (const f of b.files || []) {
      if (f.name.endsWith('.css')) page = page.replace(`<link rel="stylesheet" href="${f.name}">`, () => `<style>${f.text.replace(/<\/style/gi, '<\\/style')}</style>`);
      else if (f.name.endsWith('.js')) page = page.replace(`<script src="${f.name}"></script>`, () => `<script>${f.text.replace(/<\/script/gi, '<\\/script')}</script>`);
    }
    window.open(URL.createObjectURL(new Blob([page], { type: 'text/html' })), '_blank');
  };
  const backup = () => {
    const blob = new Blob([JSON.stringify({ kind: 'sys-builder-backup', v: 1, name: projName, templateId: meta?.templateId, templateName: meta?.templateName, config: cfg, assets }, null, 1)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${(projName || 'site').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-backup.json`; a.click();
  };
  const goProject = (pid: string, key: string) => window.location.assign(`/builder/edit?id=${encodeURIComponent(pid)}&key=${encodeURIComponent(key)}`);
  const newProject = async (t: TemplateDef) => {
    setBusy(true);
    try { await flush(); const d = await post('/api/builder', { action: 'create', templateId: t.id }); goProject(d.id, d.key); } catch (e: any) { alert(e.message); setBusy(false); }
  };
  const duplicate = async () => {
    setBusy(true);
    try { await flush(); const d = await post('/api/builder', { action: 'duplicate', id, key: keyStr }); goProject(d.id, d.key); } catch (e: any) { alert(e.message); setBusy(false); }
  };
  const download = async () => {
    try {
      const r = await fetch('/api/builder/download', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ project: id, key: keyStr }) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Download failed');
      const a = document.createElement('a'); a.href = URL.createObjectURL(await r.blob());
      a.download = /filename="([^"]+)"/.exec(r.headers.get('Content-Disposition') || '')?.[1] || 'website.zip'; a.click();
    } catch (e: any) { alert(e.message); }
  };
  const unlock = async () => {
    if (!confirm('Unlock your site to keep editing? Your order will be cancelled and you can confirm again when ready.')) return;
    try { await post('/api/builder', { action: 'unorder', id, key: keyStr }); location.reload(); } catch (e: any) { alert(e.message); }
  };

  /* ───────── render ───────── */
  // First visit: offer the quick tour once the project has loaded.
  useEffect(() => {
    if (!isProject || !cfg || locked || lsGet('sys_builder_tour_done')) return;
    const t = setTimeout(() => setTour(true), 1200);
    return () => clearTimeout(t);
  }, [isProject, !!cfg, locked]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loadErr) return <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center gap-4 px-6 text-center"><p role="alert" className="text-sm text-red-300 max-w-md">{loadErr}</p><ImportBackup /><Link href="/builder" className="text-cyan-400 text-sm underline">← Back to designs</Link></div>;
  // only while Admin → SETTINGS → Smart pricing is on: the price follows the site's contents (the server recomputes it at checkout)
  const smartLive = cfg && meta?.smart && cfg.kind !== 'pro' ? smartQuote(cfg, meta.smart.card, meta.smart.floor) : null;
  if (!cfg || !meta) return <div className="min-h-screen bg-zinc-950 text-zinc-400 flex flex-col items-center justify-center gap-3 text-sm font-mono"><div className="load-bar" role="progressbar" aria-label="Loading" />Opening your project…</div>;

  const fixedW = DEVICE_W[device];
  const pad = isLg ? 32 : 0;
  const aw = Math.max(200, avail.w - pad * 2), ah = Math.max(200, avail.h - pad * 2);
  const scale = fixedW ? (fit ? Math.min(1, aw / fixedW) : zoom) : zoom;
  const frameW = fixedW ?? aw / scale;
  const frameH = ah / scale;
  const stepZoom = (d: number) => { const i = ZOOMS.findIndex((z) => z >= zoom - 0.001); const n = ZOOMS[Math.min(ZOOMS.length - 1, Math.max(0, (i < 0 ? ZOOMS.length - 1 : i) + d))]; setZoom(n); setFit(false); };
  const warnings = readinessWarnings(cfg);
  const dirty = savedV.current.v !== hist!.v || savedV.current.n !== nameV;
  const saveLabel = locked ? 'Locked' : !online ? 'Offline — saved on this device' : save === 'saving' ? 'Saving…' : save === 'error' ? saveErr : dirty ? 'Unsaved…' : 'All changes saved';

  const tools = isPro ? TOOLS_PRO : TOOLS;
  const toolTitle = tools.find((t) => t.k === tool)?.label ?? '';
  const toolBody = (() => {
    switch (tool) {
      case 'content': return <div className="p-3 overflow-y-auto sb-slim"><ProContent api={api} goSection={(sec) => post2({ t: 'go', sec })} /></div>;
      case 'layers': return <div className="p-3 overflow-y-auto sb-slim"><LayersPanel api={api} goAdd={() => setTool('add')} /></div>;
      case 'add': return <div className="p-3 overflow-y-auto sb-slim"><AddPanel api={api} /></div>;
      case 'media': return <div className="p-3 overflow-y-auto sb-slim"><MediaPanel api={api} /></div>;
      case 'design': return <div className="p-3 overflow-y-auto sb-slim"><DesignPanel api={api} /></div>;
      case 'settings': return <div className="p-3 overflow-y-auto sb-slim"><SettingsPanel api={api} onNew={() => setNewProj(true)} onDuplicate={duplicate} onBackup={backup} onFullPreview={fullPreview} /></div>;
      case 'ai': return <div className="p-3 flex-1 min-h-0"><AIPanel api={api} /></div>;
      case 'code': return <div className="p-3 flex-1 min-h-0"><CodePanel api={api} /></div>;
      default: return null;
    }
  })();
  const panelW = tool === 'code' ? 'lg:w-[560px]' : tool === 'ai' ? 'lg:w-[420px]' : 'lg:w-[340px] 2xl:w-[380px]';

  // Quick tour: shown once on a visitor's first project, and any time from the "?" button.
  const tourSteps: TourStep[] = [
    { target: '[data-tour=name]', title: 'Name your website', text: 'Give it any name you like. It is only for you, so you can find it again.' },
    { target: '[data-tour=mode]', title: 'Design or View', text: 'Design mode lets you click things to edit them. View mode shows the site exactly as visitors see it, with working links and menus.' },
    { target: '[data-tour=tools]', title: 'Your toolbox', text: 'Sections, design, images, settings and more live here. Pick a tool and its panel opens next to your page.' },
    { target: '[data-tour=canvas]', title: 'Your live page', text: 'This is your real website, updating as you type. Click any text or image on it to change it.' },
    { target: '[data-tour=undo]', title: 'Made a mistake?', text: 'Undo and redo are always here (Ctrl+Z and Ctrl+Y on a keyboard). Your work also saves automatically.' },
    { target: '[data-tour=fullpreview]', title: 'See it full screen', text: 'Open your site in a new tab to check it the way visitors will, and try it on your phone too.' },
    ...(isProject && !locked ? [{ target: '[data-tour=buy]', title: 'Happy with it?', text: 'When you are ready, press Confirm to place your order and get your finished website files.' }] : []),
  ];
  return (
    <div className="h-dvh flex flex-col bg-[#101013] text-zinc-100 font-sans">
      {/* ── top bar ── */}
      <header className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-4 py-2 border-b border-zinc-800/80 bg-zinc-950">
        <Link href={isProject ? '/builder' : '/admin'} className={tb} aria-label="Back to designs" title="Back"><IconBack size={18} /></Link>
        {isProject
          ? <input data-tour="name" aria-label="Project name" disabled={locked} value={projName} maxLength={60} onChange={(e) => { setProjName(e.target.value); setNameV((x) => x + 1); }} className="bg-transparent rounded-md border border-transparent hover:border-zinc-700 focus:border-cyan-500 outline-none text-sm font-medium px-2 py-1 w-28 sm:w-56 truncate" />
          : <span className="text-xs sm:text-sm text-amber-300 font-medium truncate">Template: {meta.name}</span>}
        {isLg && !viewMode && (
          <span className={`hidden xl:flex items-center gap-1.5 text-[11px] ${save === 'error' || !online ? 'text-amber-300' : 'text-zinc-500'}`} aria-hidden="true">
            <span className={`h-1.5 w-1.5 rounded-full ${save === 'saving' || dirty ? 'bg-amber-400' : 'bg-emerald-400'}`} />{saveLabel}
          </span>
        )}

        <div data-tour="mode" className="mx-auto flex rounded-full bg-zinc-900 p-0.5 border border-zinc-800" role="group" aria-label="Mode">
          <button onClick={() => setViewMode(false)} aria-pressed={!viewMode} aria-label="Design mode" className={`px-3 h-8 min-w-9 text-xs font-sans rounded-full cursor-pointer inline-flex items-center justify-center gap-1.5 transition-colors ${!viewMode ? 'bg-cyan-500 text-black font-semibold' : 'text-zinc-400 hover:text-zinc-100'}`}><IconPencil size={14} /><span className="hidden sm:inline">Design</span></button>
          <button onClick={() => { setViewMode(true); setInspOpen(false); }} aria-pressed={viewMode} aria-label="View mode" className={`px-3 h-8 min-w-9 text-xs font-sans rounded-full cursor-pointer inline-flex items-center justify-center gap-1.5 transition-colors ${viewMode ? 'bg-cyan-500 text-black font-semibold' : 'text-zinc-400 hover:text-zinc-100'}`}><IconEye size={14} /><span className="hidden sm:inline">View</span></button>
        </div>

        <button data-tour="undo" className={tb} onClick={undo} disabled={locked || !hist!.past.length} aria-label="Undo" title="Undo (Ctrl+Z)"><IconUndo size={17} /></button>
        <button className={tb} onClick={redo} disabled={locked || !hist!.future.length} aria-label="Redo" title="Redo (Ctrl+Y)"><IconRedo size={17} /></button>

        {isLg && (
          <>
            <span className="mx-1 h-5 w-px bg-zinc-800" aria-hidden="true" />
            <div className="flex items-center" role="group" aria-label="Zoom">
              <button className={tb} disabled={!!fixedW && fit} onClick={() => stepZoom(-1)} aria-label="Zoom out"><IconMinus size={15} /></button>
              <button className={`${tb} w-14 tabular-nums`} onClick={() => { setZoom(1); setFit(true); }} title="Reset zoom / fit">{Math.round(scale * 100)}%</button>
              <button className={tb} disabled={!!fixedW && fit} onClick={() => stepZoom(1)} aria-label="Zoom in"><IconPlus size={15} /></button>
            </div>
            <div className="flex rounded-lg bg-zinc-900 p-0.5 border border-zinc-800" role="group" aria-label="Device">
              {(['desktop', 'tablet', 'mobile'] as const).map((d) => <button key={d} className={`h-8 w-9 rounded-md flex items-center justify-center cursor-pointer transition-colors ${device === d ? 'bg-zinc-700 text-cyan-300' : 'text-zinc-400 hover:text-zinc-100'}`} aria-pressed={device === d} aria-label={`${d} preview`} onClick={() => { setDevice(d); setFit(true); setZoom(1); }} title={d}>{d === 'desktop' ? <IconDesktop size={16} /> : d === 'tablet' ? <IconTablet size={16} /> : <IconPhone size={16} />}</button>)}
            </div>
            <span className="mx-1 h-5 w-px bg-zinc-800" aria-hidden="true" />
            <button data-tour="fullpreview" className={tb} onClick={fullPreview} title="Open the site in a new tab"><IconExternal size={15} /> Preview</button>
          </>
        )}
        <button className={tb} onClick={() => setTour(true)} aria-label="Take the quick tour" title="Quick tour"><IconInfo size={17} /></button>
        {isProject && !locked && <button data-tour="buy" className="h-9 px-3.5 rounded-lg bg-cyan-500 text-black text-xs font-sans font-semibold hover:bg-cyan-400 cursor-pointer whitespace-nowrap inline-flex items-center gap-1.5 ml-1" onClick={() => setBuy(true)}><IconCheck size={15} /> <span className="hidden sm:inline">Confirm & buy</span><span className="sm:hidden">Buy</span></button>}
      </header>

      {/* ── status banners ── */}
      <div role="status" className={`text-[11px] font-sans text-zinc-500 px-4 py-1 border-b border-zinc-900 bg-zinc-950 items-center gap-2 flex-wrap ${isLg && !viewMode ? 'sr-only' : 'flex'}`}>
        <span>{viewMode ? 'View mode — exactly how visitors see your site. Links and menus work.' : saveLabel}</span>
        {viewMode && <span className="ml-auto">{saveLabel}</span>}
      </div>
      {!online && <div className="px-3 py-1.5 text-xs bg-amber-500/10 text-amber-200 border-b border-amber-500/30">You’re offline. Keep editing — your work is stored on this device and will sync when you’re back online.</div>}
      {conflict && <div className="px-3 py-2 text-xs bg-red-500/10 text-red-200 border-b border-red-500/30 flex flex-wrap items-center gap-2">This project was changed in another tab or device. <button className="underline cursor-pointer" onClick={() => location.reload()}>Load the latest (your edits are kept as a recoverable draft)</button> <button className="underline cursor-pointer" onClick={() => flush(true)}>Keep mine and overwrite</button></div>}
      {notice && <div role="status" className="px-3 py-2 text-xs bg-emerald-500/10 text-emerald-100 border-b border-emerald-500/30 flex flex-wrap items-center gap-2">{notice} <button className="underline cursor-pointer" onClick={() => setNotice('')}>OK</button></div>}
      {draft && !locked && <div className="px-3 py-2 text-xs bg-cyan-500/10 text-cyan-100 border-b border-cyan-500/30 flex flex-wrap items-center gap-2">We recovered unsaved edits from this device. <button className="underline font-semibold cursor-pointer" onClick={() => { edit('draft', (c) => { Object.assign(c, structuredClone(draft.cfg)); }); setProjName(draft.name); setNameV((x) => x + 1); setDraft(null); }}>Restore them</button> <button className="underline cursor-pointer" onClick={() => { lsDel(draftKey); setDraft(null); }}>Discard</button></div>}
      {locked && isProject && (
        <div className="px-3 py-2 text-xs bg-amber-500/10 border-b border-amber-500/30 text-amber-200 flex flex-wrap items-center gap-3">
          {meta.order!.paid
            ? <><span>Paid — your website is ready.</span><button className="px-3 py-1 rounded bg-emerald-500 text-black font-mono font-semibold cursor-pointer" onClick={download}><IconDownload size={14} /> Download website (.zip)</button></>
            : <><span>Order placed ({meta.order!.ticket}) — waiting for your payment to be confirmed.</span><Link href={`/track?id=${meta.order!.ticket}`} className="underline">Go to payment →</Link><button className="underline cursor-pointer" onClick={unlock}>Unlock to keep editing</button></>}
        </div>
      )}

      {/* ── workspace ── */}
      <div className="flex-1 min-h-0 flex">
        {isLg && !viewMode && (
          <nav data-tour="tools" className="w-[72px] shrink-0 border-r border-zinc-800 bg-zinc-950 flex flex-col items-center py-2 gap-1" aria-label="Tools">
            {tools.map((t) => (
              <button key={t.k} onClick={() => setTool(t.k)} aria-pressed={tool === t.k} className={`w-16 py-2.5 rounded-xl flex flex-col items-center gap-1 cursor-pointer ${tool === t.k ? 'bg-cyan-500/15 text-cyan-300' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'}`}>
                <span className="leading-none"><t.icon size={20} /></span><span className="text-[10.5px] font-sans">{t.label}</span>
              </button>
            ))}
          </nav>
        )}
        {isLg && !viewMode && tool && (
          <aside className={`${panelW} shrink-0 border-r border-zinc-800 bg-zinc-950 flex flex-col min-h-0`} aria-label={toolTitle}>
            <div className="px-4 py-3 border-b border-zinc-800 text-sm font-semibold text-zinc-100">{toolTitle}</div>
            <div className="flex-1 min-h-0 flex flex-col">{toolBody}</div>
          </aside>
        )}

        {/* canvas */}
        <main data-tour="canvas" ref={canvasRef} className="flex-1 min-w-0 overflow-hidden relative bg-[#18181b]" style={{ padding: pad }} onClick={() => { if (hint) { setHint(false); lsSet('sys_builder_hint', '1'); } }}>
          <div className="mx-auto bg-white shadow-2xl overflow-hidden transition-[width] duration-200" style={{ width: frameW * scale, height: ah, borderRadius: isLg ? (device === 'mobile' ? 28 : 10) : 0 }}>
            <div style={{ position: 'relative', width: frameW, height: frameH, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
              {/* sandbox WITHOUT allow-same-origin: the site being edited (incl. its custom code) can never touch this app, cookies or storage */}
              {([0, 1] as const).map((i) => (
                <iframe key={i} ref={frames[i]} title={viewMode ? 'Your website' : 'Website canvas'} sandbox="allow-scripts" srcDoc={docs[i]} onLoad={() => onFrameLoad(i)}
                  style={{ position: 'absolute', left: 0, top: 0, width: frameW, height: frameH, border: 0, background: '#fff', display: docs[i] ? 'block' : 'none', visibility: i === front ? 'visible' : 'hidden', zIndex: i === front ? 2 : 1 }} />
              ))}
            </div>
          </div>
          {hint && !viewMode && <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-zinc-800/95 border border-zinc-600 text-xs shadow-lg max-w-[92%] text-center pointer-events-none">Tap a block to select it · <strong>double-tap text to type</strong> · use the ⠿ layers to reorder</div>}
        </main>

        {/* inspector: docked on wide screens */}
        {isXl && !viewMode && !isPro && (
          <aside className="w-[340px] shrink-0 border-l border-zinc-800 bg-zinc-950 flex flex-col min-h-0" aria-label="Inspector">
            <div className="px-4 py-3 border-b border-zinc-800 text-sm font-semibold text-zinc-100">Edit block</div>
            <div className="flex-1 min-h-0"><Inspector api={api} /></div>
          </aside>
        )}
      </div>

      {/* inspector drawer (laptop widths) */}
      {isLg && !isXl && !viewMode && !isPro && inspOpen && sel && (
        <aside className="fixed right-0 top-[57px] bottom-0 w-[340px] z-40 border-l border-zinc-700 bg-zinc-950 shadow-2xl flex flex-col" aria-label="Inspector"><Inspector api={api} onClose={() => setInspOpen(false)} /></aside>
      )}

      {/* ── mobile: bottom nav + sheets ── */}
      {!isLg && (
        <>
          {!viewMode && !isPro && inspOpen && sel && <Sheet title="Edit block" tall onClose={() => setInspOpen(false)}><Inspector api={api} /></Sheet>}
          {!viewMode && tool && !(inspOpen && sel) && <Sheet title={toolTitle} tall={tool === 'ai' || tool === 'code'} onClose={() => setTool(null)}>{toolBody}</Sheet>}
          <nav className="h-[calc(3.5rem+env(safe-area-inset-bottom))] pb-[env(safe-area-inset-bottom)] shrink-0 border-t border-zinc-800 bg-zinc-950 grid z-50" style={{ gridTemplateColumns: `repeat(${viewMode ? 7 : tools.length}, minmax(0, 1fr))` }} aria-label="Tools">
            {viewMode ? (
              <>
                <button className="col-span-3 text-xs font-mono text-zinc-300 cursor-pointer" onClick={() => setViewMode(false)}><IconPencil size={14} /> Back to editing</button>
                <div className="col-span-2 flex items-center justify-center gap-1">{(['desktop', 'tablet', 'mobile'] as const).map((d) => <button key={d} aria-pressed={device === d} onClick={() => { setDevice(d); setFit(true); }} className={`w-9 h-9 rounded cursor-pointer ${device === d ? 'bg-cyan-500/20 text-cyan-300' : 'text-zinc-400'}`}>{d === 'desktop' ? <IconDesktop size={16} /> : d === 'tablet' ? <IconTablet size={16} /> : <IconPhone size={16} />}</button>)}</div>
                <button className="col-span-2 text-xs font-mono text-zinc-300 cursor-pointer" onClick={fullPreview}><IconExternal size={14} /> Preview</button>
              </>
            ) : tools.map((t) => (
              <button key={t.k} onClick={() => { setInspOpen(false); setTool(tool === t.k ? null : t.k); }} aria-pressed={tool === t.k && !inspOpen} className={`flex flex-col items-center justify-center gap-0.5 cursor-pointer ${tool === t.k && !(inspOpen && sel) ? 'text-cyan-300 bg-cyan-500/10' : 'text-zinc-400'}`}>
                <span className="leading-none"><t.icon size={20} /></span><span className="text-[9.5px] font-sans">{t.label}</span>
              </button>
            ))}
          </nav>
        </>
      )}

      <Portal>
      {buy && isProject && <BuyModal priceUGX={smartLive ? smartLive.total : meta.priceUGX} quoteLines={smartLive?.lines} templateName={meta.templateName} warnings={warnings} projectId={id} keyStr={keyStr!} onClose={() => setBuy(false)} onDone={(ticket, contact) => {
        try { sessionStorage.setItem('sys_track_prefill', JSON.stringify({ id: ticket, contact })); } catch { /* ignore */ }
        window.location.assign(`/track?id=${ticket}`);
      }} />}
      <GuidedTour steps={tourSteps} open={tour} onClose={() => setTour(false)} doneKey="sys_builder_tour_done" />
      {newProj && <NewProjectModal busy={busy} onClose={() => setNewProj(false)} onPick={newProject} />}
      </Portal>
    </div>
  );
}
