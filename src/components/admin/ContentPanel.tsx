// src/components/admin/ContentPanel.tsx — owner editor for the trust content on the public site:
// customer reviews, price list, FAQ, guides, repair promise, headline numbers and local-search details.
'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { api, box, primary } from './adminKit';
import { AButton, Badge, Chips, Empty, Field, Notice } from './ui';
import { DEFAULT_CONTENT, LIMITS, slugify, type FaqItem, type Guide, type PriceItem, type Review, type SiteContent } from '@/lib/siteContent';

type Sec = 'reviews' | 'prices' | 'faqs' | 'guides' | 'promise' | 'local';
const uid = () => Math.random().toString(36).slice(2, 8);
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Kampala' });
const ta = `${box} min-h-[5.5rem] resize-y py-2 leading-relaxed`;

const Row = ({ children, off }: { children: ReactNode; off?: boolean }) => <li className={`adm-rise space-y-3 rounded-2xl border bg-zinc-900/50 p-4 transition ${off ? 'border-zinc-800/50 opacity-60' : 'border-zinc-800/80'}`}>{children}</li>;
const Switch = ({ on, set, label }: { on: boolean; set: (v: boolean) => void; label: string }) => (
  <button type="button" role="switch" aria-checked={on} onClick={() => set(!on)} className="inline-flex cursor-pointer items-center gap-2 text-xs text-zinc-300">
    <span className={`relative h-5 w-9 rounded-full transition-colors ${on ? 'bg-accent-strong' : 'bg-zinc-700'}`}><span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${on ? 'left-[18px]' : 'left-0.5'}`} /></span>{label}
  </button>
);
function Move({ i, n, move, del }: { i: number; n: number; move: (from: number, to: number) => void; del: () => void }) {
  return (
    <span className="flex gap-1">
      <AButton small icon="arrowUp" title="Move up" disabled={i === 0} onClick={() => move(i, i - 1)} />
      <AButton small icon="arrow" className="rotate-90" title="Move down" disabled={i === n - 1} onClick={() => move(i, i + 1)} />
      <AButton small icon="trash" danger title="Delete" onClick={del} />
    </span>
  );
}
const reorder = <T,>(list: T[], from: number, to: number): T[] => { const a = [...list]; const [x] = a.splice(from, 1); a.splice(to, 0, x); return a; };

export default function ContentPanel() {
  const [c, setC] = useState<SiteContent | null>(null);
  const [saved, setSaved] = useState('');
  const [sec, setSec] = useState<Sec>('reviews');
  const [openGuide, setOpenGuide] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => { api('content.get').then((r: any) => { setC(r.content); setSaved(JSON.stringify(r.content)); }).catch((e) => setMsg({ ok: false, text: e.message })); }, []);
  const dirty = useMemo(() => !!c && JSON.stringify(c) !== saved, [c, saved]);
  useEffect(() => { if (!dirty) return; const h = (e: BeforeUnloadEvent) => { e.preventDefault(); }; window.addEventListener('beforeunload', h); return () => window.removeEventListener('beforeunload', h); }, [dirty]);

  if (!c) return msg ? <p className="text-sm text-rose-300">{msg.text}</p> : <div className="space-y-4" aria-busy="true"><div className="adm-skel h-12 rounded-2xl" /><div className="adm-skel h-64 rounded-2xl" /></div>;

  const set = <K extends keyof SiteContent>(k: K, v: SiteContent[K]) => setC((p) => (p ? { ...p, [k]: v } : p));
  const save = async () => {
    setBusy(true); setMsg(null);
    try { const r: any = await api('content.save', { content: c }); setC(r.content); setSaved(JSON.stringify(r.content)); setMsg({ ok: true, text: 'Saved. The public site is updated.' }); }
    catch (e: any) { setMsg({ ok: false, text: e.message }); } finally { setBusy(false); }
  };

  const live = { reviews: c.reviews.filter((r) => r.shown).length, prices: c.prices.filter((p) => p.shown).length, faqs: c.faqs.filter((f) => f.shown).length, guides: c.guides.filter((g) => g.published).length };

  /* ───── Reviews ───── */
  const rev = (i: number, p: Partial<Review>) => set('reviews', c.reviews.map((r, j) => (j === i ? { ...r, ...p } : r)));
  const reviews = (
    <div className="space-y-4">
      <Notice title="Real reviews only">Use words your customers actually sent you (a WhatsApp message, a Google review). Ask permission and use a first name. Invented reviews break Google&apos;s rules and customers can tell.</Notice>
      {c.reviews.length === 0 && <div className="rounded-2xl border border-dashed border-zinc-800"><Empty icon="star" title="No reviews yet" text="Add your first one below. Three to six is enough to start." /></div>}
      <ul className="space-y-3">
        {c.reviews.map((r, i) => (
          <Row key={r.id} off={!r.shown}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Customer name"><input className={box} value={r.name} maxLength={50} onChange={(e) => rev(i, { name: e.target.value })} placeholder="e.g. Sarah N." /></Field>
              <Field label="What they had done"><input className={box} value={r.detail} maxLength={80} onChange={(e) => rev(i, { detail: e.target.value })} placeholder="e.g. Laptop screen replacement" /></Field>
            </div>
            <Field label="Their words"><textarea className={ta} value={r.text} maxLength={500} onChange={(e) => rev(i, { text: e.target.value })} placeholder="Fixed my laptop the same day and the price was fair." /></Field>
            <div className="flex flex-wrap items-center gap-3">
              <select className={`${box} !w-auto`} value={r.rating} onChange={(e) => rev(i, { rating: Number(e.target.value) })} aria-label="Stars">{[5, 4, 3].map((n) => <option key={n} value={n}>{'★'.repeat(n)} {n} stars</option>)}</select>
              <select className={`${box} !w-auto`} value={r.source} onChange={(e) => rev(i, { source: e.target.value })} aria-label="Where it came from"><option value="">Source: none</option><option value="google">Google</option><option value="whatsapp">WhatsApp</option><option value="facebook">Facebook</option><option value="instagram">Instagram</option><option value="other">Other</option></select>
              <Switch on={r.shown} set={(v) => rev(i, { shown: v })} label="Show on site" />
              <span className="ml-auto"><Move i={i} n={c.reviews.length} move={(a, b) => set('reviews', reorder(c.reviews, a, b))} del={() => set('reviews', c.reviews.filter((_, j) => j !== i))} /></span>
            </div>
          </Row>
        ))}
      </ul>
      <AButton icon="gift" variant="solid" disabled={c.reviews.length >= LIMITS.reviews} onClick={() => set('reviews', [...c.reviews, { id: uid(), name: '', detail: '', text: '', rating: 5, source: '', shown: true }])}>Add a review</AButton>
      <p className="text-[11px] text-zinc-500">Rows without a name or text are dropped when you save. They appear on the home page (first 6).</p>
    </div>
  );

  /* ───── Prices ───── */
  const pr = (i: number, p: Partial<PriceItem>) => set('prices', c.prices.map((r, j) => (j === i ? { ...r, ...p } : r)));
  const STARTER: Array<[string, string]> = [['Repairs', 'Phone screen replacement'], ['Repairs', 'Phone battery replacement'], ['Repairs', 'Laptop screen replacement'], ['Repairs', 'Laptop diagnosis'], ['Repairs', 'Windows reinstall and clean-up'], ['Design', 'Logo design'], ['Design', 'Flyer or poster'], ['Websites', 'One-page business website'], ['Websites', 'Multi-page website']];
  const prices = (
    <div className="space-y-4">
      <Notice title="Prices in UGX">Put the lowest realistic price in &ldquo;From&rdquo;. Add &ldquo;To&rdquo; if you want to show a range. Leave both empty to show &ldquo;Ask for a quote&rdquo;.</Notice>
      {c.prices.length === 0 && (
        <div className="space-y-3 rounded-2xl border border-dashed border-zinc-800 p-6 text-center">
          <p className="text-sm text-zinc-400">No prices yet. Start from a ready list of common jobs and fill in your amounts. They stay hidden until you switch them on.</p>
          <AButton variant="solid" icon="gift" onClick={() => set('prices', STARTER.map(([group, name]) => ({ id: uid(), group, name, from: 0, to: 0, note: '', shown: false })))}>Add starter list</AButton>
        </div>
      )}
      <datalist id="price-groups">{['Repairs', 'Design', 'Websites', 'Other'].map((g) => <option key={g} value={g} />)}</datalist>
      <ul className="space-y-3">
        {c.prices.map((p, i) => (
          <Row key={p.id} off={!p.shown}>
            <div className="grid gap-3 sm:grid-cols-[9rem_1fr]">
              <Field label="Group"><input className={box} list="price-groups" value={p.group} maxLength={30} onChange={(e) => pr(i, { group: e.target.value })} /></Field>
              <Field label="Service"><input className={box} value={p.name} maxLength={80} onChange={(e) => pr(i, { name: e.target.value })} placeholder="e.g. Phone screen replacement" /></Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="From (UGX)"><input className={box} inputMode="numeric" value={p.from || ''} onChange={(e) => pr(i, { from: Number(e.target.value.replace(/\D/g, '')) || 0 })} placeholder="50000" /></Field>
              <Field label="To (UGX, optional)"><input className={box} inputMode="numeric" value={p.to || ''} onChange={(e) => pr(i, { to: Number(e.target.value.replace(/\D/g, '')) || 0 })} /></Field>
              <Field label="Note (optional)"><input className={box} value={p.note} maxLength={120} onChange={(e) => pr(i, { note: e.target.value })} placeholder="parts included" /></Field>
            </div>
            <div className="flex flex-wrap items-center gap-3"><Switch on={p.shown} set={(v) => pr(i, { shown: v })} label="Show on site" /><span className="ml-auto"><Move i={i} n={c.prices.length} move={(a, b) => set('prices', reorder(c.prices, a, b))} del={() => set('prices', c.prices.filter((_, j) => j !== i))} /></span></div>
          </Row>
        ))}
      </ul>
      <AButton icon="gift" variant="solid" disabled={c.prices.length >= LIMITS.prices} onClick={() => set('prices', [...c.prices, { id: uid(), group: c.prices[c.prices.length - 1]?.group || 'Repairs', name: '', from: 0, to: 0, note: '', shown: true }])}>Add a price</AButton>
    </div>
  );

  /* ───── FAQ ───── */
  const fq = (i: number, p: Partial<FaqItem>) => set('faqs', c.faqs.map((r, j) => (j === i ? { ...r, ...p } : r)));
  const faqs = (
    <div className="space-y-4">
      <Notice title="Added to the Services page">These appear below the built-in questions and help Google show your answers in search. Good ones: &ldquo;Do you collect and deliver?&rdquo;, &ldquo;How do I pay?&rdquo;, &ldquo;Do you repair water-damaged phones?&rdquo;.</Notice>
      {c.faqs.length === 0 && <div className="rounded-2xl border border-dashed border-zinc-800"><Empty icon="lightbulb" title="No extra questions yet" text="Think of the questions customers ask you most on WhatsApp." /></div>}
      <ul className="space-y-3">
        {c.faqs.map((f, i) => (
          <Row key={f.id} off={!f.shown}>
            <Field label="Question"><input className={box} value={f.q} maxLength={160} onChange={(e) => fq(i, { q: e.target.value })} /></Field>
            <Field label="Answer"><textarea className={ta} value={f.a} maxLength={1200} onChange={(e) => fq(i, { a: e.target.value })} /></Field>
            <div className="flex flex-wrap items-center gap-3"><Switch on={f.shown} set={(v) => fq(i, { shown: v })} label="Show on site" /><span className="ml-auto"><Move i={i} n={c.faqs.length} move={(a, b) => set('faqs', reorder(c.faqs, a, b))} del={() => set('faqs', c.faqs.filter((_, j) => j !== i))} /></span></div>
          </Row>
        ))}
      </ul>
      <AButton icon="gift" variant="solid" disabled={c.faqs.length >= LIMITS.faqs} onClick={() => set('faqs', [...c.faqs, { id: uid(), q: '', a: '', shown: true }])}>Add a question</AButton>
    </div>
  );

  /* ───── Guides ───── */
  const gd = (id: string, p: Partial<Guide>) => set('guides', c.guides.map((g) => (g.id === id ? { ...g, ...p } : g)));
  const guideSlugLocked = (id: string) => saved.includes(`"id":"${id}"`);
  const guides = (
    <div className="space-y-4">
      <Notice title="Short helpful articles">Write 300 to 600 words answering one question people search for, like &ldquo;How much does a website cost in Uganda?&rdquo;. They live at /guides and are listed in your sitemap for Google.</Notice>
      {c.guides.length === 0 && <div className="rounded-2xl border border-dashed border-zinc-800"><Empty icon="pencil" title="No guides yet" text="Write your first one. Drafts stay hidden until you publish." /></div>}
      <ul className="space-y-3">
        {c.guides.map((g, i) => {
          const open = openGuide === g.id;
          return (
            <Row key={g.id} off={!g.published}>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setOpenGuide(open ? null : g.id)} aria-expanded={open} className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left">
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-zinc-100">{g.title || 'Untitled guide'}</span><span className="block truncate text-xs text-zinc-500">/guides/{g.id}</span></span>
                  <Badge tone={g.published ? 'ok' : 'default'}>{g.published ? 'Published' : 'Draft'}</Badge>
                </button>
                <Move i={i} n={c.guides.length} move={(a, b) => set('guides', reorder(c.guides, a, b))} del={() => { if (confirm('Delete this guide?')) set('guides', c.guides.filter((x) => x.id !== g.id)); }} />
              </div>
              {open && (
                <div className="space-y-3 border-t border-zinc-800/80 pt-3 ios-enter">
                  <Field label="Title"><input className={box} value={g.title} maxLength={90} onChange={(e) => gd(g.id, { title: e.target.value })} /></Field>
                  <Field label="Short summary (shown on Google and in the list)"><input className={box} value={g.summary} maxLength={200} onChange={(e) => gd(g.id, { summary: e.target.value })} /></Field>
                  <Field label="Guide text" hint="## Heading  ·  - bullet  ·  1. numbered  ·  **bold**  ·  [link text](https://…)  ·  blank line = new paragraph"><textarea className={`${ta} min-h-[16rem] font-mono text-[13px]`} value={g.body} maxLength={12000} onChange={(e) => gd(g.id, { body: e.target.value })} /></Field>
                  <div className="flex flex-wrap items-center gap-3">
                    <Field label="Date"><input type="date" className={`${box} !w-auto`} value={g.date} onChange={(e) => gd(g.id, { date: e.target.value })} /></Field>
                    <Switch on={g.published} set={(v) => gd(g.id, { published: v, date: v && !g.date ? today() : g.date })} label="Published" />
                    {guideSlugLocked(g.id) && g.published && <Link href={`/guides/${g.id}`} target="_blank" className="ml-auto text-xs text-accent hover:underline">View live ↗</Link>}
                  </div>
                  {!guideSlugLocked(g.id) && <p className="text-[11px] text-zinc-500">The web address is made from the title when you save: <span className="font-mono">/guides/{slugify(g.title) || '…'}</span></p>}
                </div>
              )}
            </Row>
          );
        })}
      </ul>
      <AButton icon="pencil" variant="solid" disabled={c.guides.length >= LIMITS.guides} onClick={() => { const id = `new-${uid()}`; set('guides', [{ id, title: 'New guide', summary: '', body: '## Introduction\n\nWrite your first paragraph here.', date: '', published: false }, ...c.guides]); setOpenGuide(id); }}>Write a guide</AButton>
    </div>
  );

  /* ───── Promise + numbers ───── */
  const promise = (
    <div className="space-y-5">
      <section className="adm-rise space-y-3.5 rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-semibold text-zinc-100">Repair promise / warranty</h3><p className="text-xs text-zinc-500">Shown on the Services and Contact pages. Only promise what you will really honour.</p></div><Switch on={c.promise.enabled} set={(v) => set('promise', { ...c.promise, enabled: v })} label={c.promise.enabled ? 'Showing' : 'Hidden'} /></div>
        <Field label="Heading"><input className={box} value={c.promise.title} maxLength={60} onChange={(e) => set('promise', { ...c.promise, title: e.target.value })} /></Field>
        <Field label="Short intro"><input className={box} value={c.promise.intro} maxLength={300} onChange={(e) => set('promise', { ...c.promise, intro: e.target.value })} placeholder="What you stand behind" /></Field>
        <div className="space-y-2">
          <span className="block text-xs font-medium text-zinc-400">Points (up to {LIMITS.points})</span>
          {c.promise.points.map((p, i) => (
            <div key={i} className="flex gap-2"><input className={box} value={p} maxLength={140} onChange={(e) => set('promise', { ...c.promise, points: c.promise.points.map((x, j) => (j === i ? e.target.value : x)) })} /><AButton small icon="trash" danger title="Remove" onClick={() => set('promise', { ...c.promise, points: c.promise.points.filter((_, j) => j !== i) })} /></div>
          ))}
          <div className="flex flex-wrap gap-2">
            <AButton icon="gift" disabled={c.promise.points.length >= LIMITS.points} onClick={() => set('promise', { ...c.promise, points: [...c.promise.points, ''] })}>Add a point</AButton>
            {c.promise.points.length === 0 && <AButton onClick={() => set('promise', { ...c.promise, intro: 'We stand behind our work.', points: ['Warranty on repairs (edit the length to match your policy)', 'We quote before any work starts', 'No fix, no charge for diagnosis (edit to match your policy)', 'Your data is kept private'] })}>Fill with an example to edit</AButton>}
          </div>
        </div>
      </section>
      <section className="adm-rise space-y-3.5 rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-4 sm:p-5">
        <div><h3 className="text-sm font-semibold text-zinc-100">Headline numbers</h3><p className="text-xs text-zinc-500">Up to {LIMITS.stats} proof points on the home page, such as &ldquo;250+ devices repaired&rdquo;. Use true figures only.</p></div>
        {c.stats.map((s, i) => (
          <div key={i} className="grid grid-cols-[6rem_1fr_auto] gap-2">
            <input className={box} value={s.value} maxLength={20} placeholder="250+" aria-label="Number" onChange={(e) => set('stats', c.stats.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />
            <input className={box} value={s.label} maxLength={40} placeholder="Devices repaired" aria-label="Label" onChange={(e) => set('stats', c.stats.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
            <AButton small icon="trash" danger title="Remove" onClick={() => set('stats', c.stats.filter((_, j) => j !== i))} />
          </div>
        ))}
        <AButton icon="gift" disabled={c.stats.length >= LIMITS.stats} onClick={() => set('stats', [...c.stats, { value: '', label: '' }])}>Add a number</AButton>
      </section>
    </div>
  );

  /* ───── Local ───── */
  const local = (
    <section className="adm-rise space-y-4 rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-4 sm:p-5">
      <div><h3 className="text-sm font-semibold text-zinc-100">Local search &amp; map</h3><p className="text-xs leading-relaxed text-zinc-500">Your address, phone and hours come from Settings. They are used for the map and for Google&apos;s local-business information. Make sure they match your Google Business Profile exactly.</p></div>
      <Field label="Areas you serve" hint="Separate with commas. Mentioning real place names helps people nearby find you."><input className={box} value={c.local.areas} maxLength={200} onChange={(e) => set('local', { ...c.local, areas: e.target.value })} placeholder="Ndejje, Ssabagabo, Makindye, Entebbe Road, Kampala" /></Field>
      <Field label="How to find you" hint="A landmark helps, e.g. “Opposite the main stage, second floor”."><input className={box} value={c.local.directions} maxLength={300} onChange={(e) => set('local', { ...c.local, directions: e.target.value })} /></Field>
      <Field label="Google Maps link" hint="In Google Maps, open your place, press Share, then Copy link. Must start with https://"><input className={box} value={c.local.mapsUrl} onChange={(e) => set('local', { ...c.local, mapsUrl: e.target.value })} placeholder="https://maps.app.goo.gl/…" /></Field>
      <Field label="Google review link" hint="In your Google Business Profile press “Ask for reviews” and copy the link."><input className={box} value={c.local.reviewUrl} onChange={(e) => set('local', { ...c.local, reviewUrl: e.target.value })} placeholder="https://g.page/r/…/review" /></Field>
      <Switch on={c.local.showMap} set={(v) => set('local', { ...c.local, showMap: v })} label="Show the map on the Contact page" />
      <p className="text-[11px] text-zinc-500">The WhatsApp number and social links are in <Link className="text-accent hover:underline" href="/admin?tab=settings">Settings</Link>.</p>
    </section>
  );

  return (
    <div className="space-y-5">
      <div className="sb-slim -mx-1 overflow-x-auto px-1">
        <Chips<Sec> value={sec} onChange={setSec} items={[
          { id: 'reviews', label: 'Reviews', count: live.reviews }, { id: 'prices', label: 'Prices', count: live.prices }, { id: 'faqs', label: 'FAQ', count: live.faqs },
          { id: 'guides', label: 'Guides', count: live.guides }, { id: 'promise', label: 'Promise & numbers' }, { id: 'local', label: 'Local & map' },
        ]} />
      </div>
      <div key={sec}>{sec === 'reviews' ? reviews : sec === 'prices' ? prices : sec === 'faqs' ? faqs : sec === 'guides' ? guides : sec === 'promise' ? promise : local}</div>

      <div className="sticky bottom-3 z-20 flex flex-wrap items-center gap-3 rounded-2xl border border-zinc-700/80 bg-zinc-950/90 p-3 shadow-xl shadow-black/40 backdrop-blur">
        <button className={`${primary} !min-h-10 !px-5`} onClick={save} disabled={busy || !dirty}>{busy ? 'Saving…' : 'Save changes'}</button>
        {dirty && <span className="flex items-center gap-1.5 text-xs text-amber-300"><span className="h-1.5 w-1.5 rounded-full bg-amber-400" />Unsaved changes</span>}
        {msg && <span role="status" className={`text-xs ${msg.ok ? 'text-emerald-300' : 'text-rose-300'}`}>{msg.text}</span>}
        <button type="button" className="ml-auto cursor-pointer text-xs text-zinc-500 hover:text-zinc-200 disabled:opacity-40" disabled={!dirty} onClick={() => setC(JSON.parse(saved) as SiteContent)}>Discard</button>
      </div>
    </div>
  );
}

export { DEFAULT_CONTENT };
