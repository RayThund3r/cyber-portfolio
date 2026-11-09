// src/app/builder/page.tsx — template SHOWCASE: grouped by category, animated, live pricing, view → edit
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import gsap from 'gsap';
import { buildSite } from '@/lib/builder/generate';
import { CATEGORIES, categoryOf } from '@/lib/builder/schema';
import type { TemplateDef } from '@/lib/builder/templates';
import { CURRENCIES, FALLBACK_RATES, effectiveUGX, formatMoney, type Rates } from '@/lib/builder/pricing';
import SiteViewer from '@/components/builder/SiteViewer';
import { post, lsGet, lsSet } from '@/components/builder/lib';
import { forgetProject, readSaved, type SavedProject } from '@/utils/useProjectRef';
import { hasWhatsApp, whatsappLink } from '@/utils/chatEngine/siteConfig';

/** Thumbnail iframe that only mounts when scrolled into view (14 live previews would be heavy otherwise). */
function Thumb({ t }: { t: TemplateDef }) {
  const host = useRef<HTMLDivElement>(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    if (!('IntersectionObserver' in window)) { setVis(true); return; }
    const io = new IntersectionObserver((es) => { if (es[0].isIntersecting) { setVis(true); io.disconnect(); } }, { rootMargin: '300px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  // Thumbnails are static pictures: the frame is sandboxed without scripts, so every inline script is removed here
  // (otherwise the browser logs "Blocked script execution" once per thumbnail). 'preview' shows all sections immediately.
  const html = useMemo(() => (vis ? buildSite(t.config, { mode: 'preview', assetSrc: () => '' }).html.replace(/<script[\s\S]*?<\/script>/gi, '') : ''), [vis, t]);
  return (
    <div ref={host} className="relative aspect-[16/10] overflow-hidden bg-zinc-900 border-b border-zinc-800">
      {vis ? (
        // hover slowly "scrolls" the page so people can see more of the design
        <div className="absolute top-0 left-0 w-full h-[210%] transition-transform duration-[2800ms] ease-in-out group-hover:-translate-y-[44%] group-focus-within:-translate-y-[44%] motion-reduce:transition-none">
          <iframe title={`${t.name} preview`} sandbox="" srcDoc={html} loading="lazy" tabIndex={-1} aria-hidden="true" className="absolute top-0 left-0 border-0 pointer-events-none origin-top-left w-[333.4%] h-[333.4%] scale-[0.3] bg-white" />
        </div>
      ) : <div className="absolute inset-0 animate-pulse bg-zinc-800/50" />}
    </div>
  );
}

export default function Showcase() {
  const router = useRouter();
  const grid = useRef<HTMLDivElement>(null);
  const [templates, setTemplates] = useState<TemplateDef[] | null>(null);
  const [rates, setRates] = useState<Rates>(FALLBACK_RATES);
  const [cur, setCur] = useState('UGX');
  const [cat, setCat] = useState<string>('all');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'featured' | 'low' | 'high' | 'name'>('featured');
  const [saved, setSaved] = useState<SavedProject[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [link, setLink] = useState('');
  const [preview, setPreview] = useState<TemplateDef | null>(null);

  useEffect(() => {
    fetch('/api/builder/templates').then((r) => r.json()).then((d) => setTemplates(d.templates || [])).catch(() => setTemplates([]));
    fetch('/api/rates').then((r) => r.json()).then((r) => r?.rates?.UGX && setRates(r)).catch(() => {});
    setSaved(readSaved());
    const c = lsGet('sys_currency'); if (c && CURRENCIES.some((x) => x.code === c)) setCur(c);
  }, []);
  useEffect(() => { lsSet('sys_currency', cur); }, [cur]);
  useEffect(() => { document.body.style.overflow = preview ? 'hidden' : ''; return () => { document.body.style.overflow = ''; }; }, [preview]);

  const ugx = (t: TemplateDef) => effectiveUGX(t, rates.rates.UGX);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    let list = (templates || []).filter((t) => (cat === 'all' || t.category === cat) && (!term || `${t.name} ${t.description} ${categoryOf(t.category).label}`.toLowerCase().includes(term)));
    if (sort === 'low') list = [...list].sort((a, b) => (ugx(a) ?? 1e12) - (ugx(b) ?? 1e12));
    if (sort === 'high') list = [...list].sort((a, b) => (ugx(b) ?? -1) - (ugx(a) ?? -1));
    if (sort === 'name') list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templates, cat, q, sort, rates]);

  const counts = useMemo(() => { const m: Record<string, number> = {}; (templates || []).forEach((t) => (m[t.category] = (m[t.category] || 0) + 1)); return m; }, [templates]);
  const grouped = cat === 'all' && !q.trim() && sort === 'featured';
  const groups = useMemo(() => CATEGORIES.map((c) => ({ c, items: filtered.filter((t) => t.category === c.id) })).filter((g) => g.items.length), [filtered]);

  // gentle staggered entrance whenever the visible set changes (skipped for reduced motion)
  const sig = filtered.map((t) => t.id).join(',') + (grouped ? 'g' : 'f');
  useEffect(() => {
    if (!grid.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const cards = grid.current.querySelectorAll('.tpl-card');
    if (!cards.length) return;
    const t = gsap.fromTo(cards, { y: 26, opacity: 0, scale: 0.97 }, { y: 0, opacity: 1, scale: 1, duration: 0.55, ease: 'power3.out', stagger: { each: 0.045, from: 'start' }, clearProps: 'transform' });
    return () => { t.kill(); gsap.set(cards, { opacity: 1, clearProps: 'transform' }); };
  }, [sig]);

  const start = useCallback(async (tpl: TemplateDef) => {
    setBusy(tpl.id); setErr('');
    try {
      const d = await post('/api/builder', { action: 'create', templateId: tpl.id });
      router.push(`/builder/edit?id=${d.id}&key=${encodeURIComponent(d.key)}`);
    } catch (e: any) { setErr(e.message); setBusy(null); }
  }, [router]);

  const openLink = () => {
    try {
      const u = new URL(link.trim(), window.location.origin);
      const id = u.searchParams.get('id'), key = u.searchParams.get('key');
      if (id && key) { router.push(`/builder/edit?id=${encodeURIComponent(id)}&key=${encodeURIComponent(key)}`); return; }
    } catch { /* ignore */ }
    setErr('Paste the full edit link you saved (it contains id= and key=).');
  };

  const price = (t: TemplateDef) => {
    const u = ugx(t);
    return (
      <div>
        <div className="font-mono text-sm text-cyan-300">{formatMoney(u, cur, rates)}</div>
        {u !== null && u > 0 && cur !== 'UGX' && <div className="text-[10px] font-mono text-zinc-500">≈ {formatMoney(u, 'UGX', rates)} · pay in UGX</div>}
      </div>
    );
  };

  // NOTE: a render function, NOT a nested component — a nested component would remount (and reload every live thumbnail) on each keystroke
  const card = (t: TemplateDef) => (
    <article key={t.id} className="tpl-card group rounded-xl overflow-hidden border border-zinc-800 bg-zinc-900/40 hover:border-cyan-500/50 hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(6,182,212,0.12)] transition-[transform,box-shadow,border-color] duration-300 flex flex-col focus-within:border-cyan-500/60">
      <button onClick={() => setPreview(t)} aria-label={`Preview ${t.name}`} className="block w-full text-left cursor-pointer">
        <div className="relative">
          <Thumb t={t} />
          {t.tag && <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-cyan-500 text-black text-[10px] font-mono font-bold">{t.tag}</span>}
          <span className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-colors"><span className="opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300 px-4 py-2 rounded-full bg-white text-black text-xs font-semibold shadow-lg">👁 Click to view</span></span>
        </div>
      </button>
      <div className="p-4 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-2"><h3 className="font-bold">{t.name}</h3><span className="text-[11px] font-mono text-zinc-500 whitespace-nowrap">{categoryOf(t.category).icon} {categoryOf(t.category).label.split(' ')[0]}</span></div>
        <p className="text-sm text-zinc-400 mt-1 flex-1">{t.description}</p>
        <div className="mt-4 flex items-end justify-between gap-2">
          {price(t)}
          <div className="flex gap-2">
            <button onClick={() => setPreview(t)} className="px-3 py-2 rounded border border-zinc-700 text-xs font-mono hover:border-zinc-400 cursor-pointer">View</button>
            <button disabled={busy !== null} onClick={() => start(t)} className="px-3 py-2 rounded bg-cyan-500 text-black text-xs font-mono font-semibold hover:bg-cyan-400 disabled:opacity-50 cursor-pointer">{busy === t.id ? '…' : 'Edit →'}</button>
          </div>
        </div>
      </div>
    </article>
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans">
      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-8 space-y-10">
        <Link href="/" className="font-mono text-xs text-cyan-400 hover:opacity-80">← Home</Link>

        <header data-hero className="max-w-3xl">
          <div data-hero-item className="font-mono text-xs text-cyan-400 mb-3">// WEBSITE_SHOWCASE</div>
          <h1 data-hero-title className="text-3xl sm:text-5xl font-extrabold leading-tight">Pick a design. Make it yours. Download it.</h1>
          <p data-hero-item className="mt-4 text-zinc-400 text-base sm:text-lg">Browse ready-made websites by category. Click any one to explore it live, then edit every word, picture and colour in a Figma-style editor — with an AI assistant and a code editor if you want them.</p>
        </header>

        {saved.length > 0 && (
          <section aria-labelledby="mine">
            <h2 id="mine" className="font-mono text-xs text-zinc-400 mb-3">YOUR PROJECTS ON THIS DEVICE</h2>
            <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {saved.map((s) => (
                <li key={s.id} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 flex items-center gap-2">
                  <div className="flex-1 min-w-0"><div className="text-sm font-semibold truncate">{s.name}</div><div className="text-[11px] font-mono text-zinc-500 truncate">{s.id}{s.template ? ` · ${s.template}` : ''}</div></div>
                  <Link href={`/builder/view?id=${s.id}`} className="px-2.5 py-1.5 rounded border border-zinc-700 text-xs font-mono hover:border-zinc-400">View</Link>
                  <Link href={`/builder/edit?id=${s.id}`} className="px-2.5 py-1.5 rounded bg-cyan-500 text-black text-xs font-mono font-semibold hover:bg-cyan-400">Edit</Link>
                  <button aria-label={`Remove ${s.name} from this device`} onClick={() => { forgetProject(s.id); setSaved(readSaved()); }} className="text-zinc-500 hover:text-red-400 cursor-pointer px-1">✕</button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* toolbar */}
        <section aria-label="Filter templates" className="sticky top-0 z-30 -mx-4 sm:-mx-8 px-4 sm:px-8 py-3 bg-zinc-950/90 backdrop-blur border-b border-zinc-800 space-y-3">
          <div className="flex gap-2 overflow-x-auto pb-1 -mb-1" role="tablist" aria-label="Categories">
            {[{ id: 'all', label: 'All', icon: '✨' }, ...CATEGORIES.filter((c) => counts[c.id])].map((c) => {
              const on = cat === c.id;
              return (
                <button key={c.id} role="tab" aria-selected={on} onClick={() => setCat(c.id)} className={`shrink-0 px-3 py-1.5 rounded-full border text-xs font-mono cursor-pointer transition-colors ${on ? 'bg-cyan-500 border-cyan-500 text-black font-semibold' : 'border-zinc-700 text-zinc-300 hover:border-zinc-400'}`}>
                  {c.icon} {c.label} <span className={on ? 'opacity-70' : 'text-zinc-500'}>{c.id === 'all' ? templates?.length ?? '' : counts[c.id]}</span>
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search designs…" aria-label="Search templates" className="flex-1 min-w-[10rem] bg-zinc-900 border border-zinc-800 rounded px-3 py-2 focus:outline-none focus:border-cyan-500" />
            <select value={sort} onChange={(e) => setSort(e.target.value as any)} aria-label="Sort" className="bg-zinc-900 border border-zinc-800 rounded px-2 py-2"><option value="featured">Featured</option><option value="low">Price: low → high</option><option value="high">Price: high → low</option><option value="name">Name A–Z</option></select>
            <select value={cur} onChange={(e) => setCur(e.target.value)} aria-label="Currency" className="bg-zinc-900 border border-zinc-800 rounded px-2 py-2">{CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.label}</option>)}</select>
          </div>
        </section>

        {err && <p role="alert" className="text-sm text-red-300">{err}</p>}

        <div ref={grid} className="space-y-12 min-h-[40vh]">
          {templates === null ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-72 rounded-xl bg-zinc-900/60 animate-pulse" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-zinc-400"><div className="text-4xl mb-2">🔍</div>No designs match. <button className="underline text-cyan-400 cursor-pointer" onClick={() => { setQ(''); setCat('all'); }}>Clear filters</button></div>
          ) : grouped ? (
            groups.map(({ c, items }) => (
              <section key={c.id} aria-labelledby={`cat-${c.id}`}>
                <div className="flex items-baseline justify-between mb-4"><h2 id={`cat-${c.id}`} className="text-xl font-bold">{c.icon} {c.label} <span className="text-sm font-mono text-zinc-500">({items.length})</span></h2><button className="text-xs font-mono text-cyan-400 hover:underline cursor-pointer" onClick={() => setCat(c.id)}>Only show this →</button></div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">{items.map(card)}</div>
              </section>
            ))
          ) : (
            <section><p className="text-xs font-mono text-zinc-500 mb-4">{filtered.length} design{filtered.length === 1 ? '' : 's'}</p><div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">{filtered.map(card)}</div></section>
          )}
        </div>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-5 grid md:grid-cols-2 gap-6 text-sm">
          <div>
            <h2 className="font-mono text-xs text-zinc-400 mb-2">HOW PRICING WORKS</h2>
            <p className="text-zinc-400">Prices follow what comparable premium website templates typically cost on the big marketplaces (roughly US$15–60), converted <strong className="text-zinc-200">live</strong> into your currency. You pay once, in UGX by mobile money, then download your site — no monthly fees.</p>
            <p className="text-[11px] font-mono text-zinc-500 mt-2">1 USD = {Math.round(rates.rates.UGX).toLocaleString()} UGX · {rates.source === 'fallback' ? 'estimated rate (live rate unavailable)' : `${rates.source} rate, updated ${new Date(rates.updatedAt).toLocaleString('en-UG', { dateStyle: 'medium', timeStyle: 'short' })}`}</p>
          </div>
          <div>
            <h2 className="font-mono text-xs text-zinc-400 mb-2">OPEN A PROJECT FROM ANOTHER DEVICE</h2>
            <div className="flex gap-2"><input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Paste your edit link…" aria-label="Edit link" className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-3 py-2 focus:outline-none focus:border-cyan-500" /><button onClick={openLink} className="px-3 py-2 rounded border border-zinc-700 text-xs font-mono hover:border-zinc-500 cursor-pointer">Open</button></div>
            <p className="text-[11px] text-zinc-500 mt-2">Projects save automatically. Keep your edit link private — anyone with it can edit your site.</p>
            <div className="mt-3 flex flex-wrap gap-2 font-mono text-xs"><Link href="/contact?type=design" className="px-3 py-2 rounded border border-zinc-700 hover:border-zinc-500">Need a custom site? Request a design</Link>{hasWhatsApp() && <a href={whatsappLink('Hello, I have a question about the website builder. ')} target="_blank" rel="noopener noreferrer" className="px-3 py-2 rounded border border-emerald-500/50 text-emerald-400">💬 WhatsApp</a>}</div>
          </div>
        </section>
      </main>

      {preview && (
        <div className="fixed inset-0 z-50 bg-zinc-950" role="dialog" aria-modal="true" aria-label={`${preview.name} preview`}>
          <SiteViewer
            config={preview.config}
            title={preview.name}
            subtitle={`${categoryOf(preview.category).icon} ${categoryOf(preview.category).label}`}
            onClose={() => setPreview(null)}
            actions={<>
              <div className="hidden md:block text-right mr-1">{price(preview)}</div>
              <button disabled={busy !== null} onClick={() => start(preview)} className="px-4 py-2 rounded bg-cyan-500 text-black text-xs font-mono font-semibold hover:bg-cyan-400 disabled:opacity-50 cursor-pointer">{busy === preview.id ? 'Starting…' : '✎ Edit this design →'}</button>
            </>}
          />
        </div>
      )}
    </div>
  );
}
