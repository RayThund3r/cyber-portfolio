// src/app/admin/page.tsx — owner dashboard (tickets · portfolio CMS · insights). Auth: ADMIN_PASSWORD env var.
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { ProjectItem } from '@/data/portfolioData';
import { STATUS_FLOW, STATUS_LABEL, formatUGX, type TicketStatus } from '@/lib/shared';
import { buildSite } from '@/lib/builder/generate';
import { CATEGORIES, type SiteConfig } from '@/lib/builder/schema';
import { FALLBACK_RATES, effectiveUGX, type Rates } from '@/lib/builder/pricing';
import { api, box, btn, primary, needsAttention, printJobCard, useAdminTickets, type AdminTicket, type Stats } from '@/components/admin/adminKit';
import Overview from '@/components/admin/Overview';
import TicketsPanel from '@/components/admin/TicketsPanel';
import DataPanel from '@/components/admin/DataPanel';
import StudioPanel from '@/components/studio/StudioPanel';

/** The extra tools live on their own pages (shared frame, same sign-in). */
const TOOLS: Array<[string, string]> = [['/admin/overview', 'Pulse'], ['/admin/analytics', 'Analytics'], ['/admin/chat', 'Chat Lab'], ['/admin/site', 'Site'], ['/admin/health', 'Health'], ['/admin/security', 'Security'], ['/admin/board', 'Board'], ['/admin/shell', 'Shell'], ['/admin/lab', 'Lab']];

type Tab = 'overview' | 'tickets' | 'studio' | 'templates' | 'sites' | 'portfolio' | 'insights' | 'data';

export default function AdminPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [totp, setTotp] = useState(false);
  const [storage, setStorage] = useState<{ persistent: boolean; where: string; note: string } | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => { api('me').then((r: any) => { setStorage(r?.storage ?? null); setAuthed(true); }).catch((e) => { setTotp(!!e.data?.totp); setAuthed(false); }); }, []);

  // One live copy of the requests, shared by the Overview and Tickets tabs (refreshes every 45 s while visible).
  const onAuthLost = useCallback(() => setAuthed(false), []);
  const live = useAdminTickets(authed === true, onAuthLost);
  const attention = useMemo(() => live.tickets.filter(needsAttention).length, [live.tickets]);

  // Browser tab title shows how many things are waiting, so you notice it from another tab.
  useEffect(() => {
    document.title = `${attention > 0 ? `(${attention}) ` : ''}Admin · System Portfolio`;
  }, [attention]);

  if (authed === null) return <div className="min-h-screen bg-zinc-950" />;
  if (!authed) return <Login totp={totp} onDone={() => { api('me').then((r: any) => setStorage(r?.storage ?? null)).catch(() => undefined); setAuthed(true); }} />;

  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: 'overview', label: 'OVERVIEW' },
    { id: 'tickets', label: 'TICKETS', badge: attention },
    { id: 'studio', label: 'STUDIO' },
    { id: 'templates', label: 'TEMPLATES' },
    { id: 'sites', label: 'SITES' },
    { id: 'portfolio', label: 'PORTFOLIO' },
    { id: 'insights', label: 'INSIGHTS' },
    { id: 'data', label: 'DATA' },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans">
      <header className="sticky top-0 z-40 bg-zinc-950/90 backdrop-blur border-b border-zinc-800">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <nav className="flex gap-2 overflow-x-auto" aria-label="Admin sections">
            {tabs.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)} aria-current={tab === t.id ? 'page' : undefined} className={`${btn} flex-shrink-0 ${tab === t.id ? 'border-cyan-500 text-cyan-400' : ''}`}>
                {t.label}
                {!!t.badge && <span className="ml-1.5 rounded-full bg-amber-500 px-1.5 text-[10px] font-semibold text-black">{t.badge}</span>}
              </button>
            ))}
          </nav>
          <div className="flex gap-2"><Link href="/" className={btn}>Site</Link><button className={btn} onClick={async () => { await api('logout'); setAuthed(false); }}>Log out</button></div>
        </div>
        <nav className="max-w-5xl mx-auto px-4 pb-2 flex items-center gap-2 overflow-x-auto font-mono text-[10px]" aria-label="More tools">
          <span className="flex-shrink-0 uppercase tracking-wider text-zinc-600">More tools</span>
          {TOOLS.map(([href, label]) => <Link key={href} href={href} className="flex-shrink-0 rounded-md border border-zinc-800 px-2 py-1 text-zinc-400 transition hover:border-cyan-500/60 hover:text-cyan-300">{label}</Link>)}
        </nav>
      </header>
      {storage && !storage.persistent && (
        <div role="alert" className="max-w-5xl mx-auto mt-4 mx-4 rounded-xl border border-amber-500/40 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
          <strong className="font-semibold">Temporary storage.</strong> {storage.note}
        </div>
      )}
      <div key={tab} className="max-w-5xl mx-auto px-4 py-6 ios-enter">
        {tab === 'overview' && (
          <Overview tickets={live.tickets} loading={live.loading} goTab={setTab} onOpenTicket={(id) => { setOpenId(id); setTab('tickets'); }} />
        )}
        {tab === 'tickets' && (
          <TicketsPanel
            tickets={live.tickets} setTickets={(fn) => live.setTickets(fn)} reload={() => live.reload()} error={live.error}
            fresh={live.fresh} clearFresh={live.clearFresh} openId={openId} setOpenId={setOpenId}
            renderEditor={(t, onSaved) => <TicketEditor t={t} onSaved={onSaved} />}
          />
        )}
        {tab === 'studio' && <StudioPanel onAuthLost={onAuthLost} />}
        {tab === 'templates' && <Templates />}
        {tab === 'sites' && <Sites />}
        {tab === 'portfolio' && <Portfolio />}
        {tab === 'insights' && <Insights />}
        {tab === 'data' && <DataPanel tickets={live.tickets} />}
      </div>
    </div>
  );
}

function Login({ onDone, totp }: { onDone: () => void; totp: boolean }) {
  const [pw, setPw] = useState(''); const [code, setCode] = useState(''); const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center px-4">
      <form className="w-full max-w-sm bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 space-y-4" onSubmit={async (e) => {
        e.preventDefault(); setBusy(true); setErr(null);
        try { await api('login', { password: pw, code }); onDone(); } catch (x: any) { setErr(x.message); } finally { setBusy(false); }
      }}>
        <h1 className="font-mono text-sm text-cyan-400">ADMIN_LOGIN</h1>
        <input type="password" autoComplete="current-password" className={box} placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)} aria-label="Password" />
        {totp && <input inputMode="numeric" autoComplete="one-time-code" maxLength={7} className={box} placeholder="6-digit authenticator code" value={code} onChange={(e) => setCode(e.target.value)} aria-label="Authenticator code" />}
        {err && <p role="alert" className="text-xs text-red-400">{err}</p>}
        <button className={primary} disabled={busy || !pw || (totp && code.replace(/\s/g, '').length < 6)}>{busy ? '…' : 'ENTER'}</button>
      </form>
    </div>
  );
}

/* ───────────── Tickets ───────────── */
function TicketEditor({ t, onSaved }: { t: AdminTicket; onSaved: (t: AdminTicket) => void }) {
  const [status, setStatus] = useState<TicketStatus>(t.status);
  const [quote, setQuote] = useState(String(t.quoteUGX ?? '')); const [deposit, setDeposit] = useState(String(t.depositUGX ?? ''));
  const [note, setNote] = useState(''); const [priv, setPriv] = useState(t.adminNotes || ''); const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<string | null>(null);

  const save = async (extra: Record<string, unknown> = {}) => {
    setBusy(true); setMsg(null);
    try {
      const d = await api<{ ticket: AdminTicket }>('ticket.update', { id: t.id, status, quoteUGX: quote, depositUGX: deposit, adminNotes: priv, note, notify, ...extra });
      onSaved(d.ticket); setNote(''); setMsg('Saved ✓');
    } catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  };
  const waText = encodeURIComponent(`Hello ${t.name}, update on ${t.id}: ${STATUS_LABEL[status]}${note ? ` — ${note}` : ''}`);

  return (
    <div className="border-t border-zinc-800 p-4 space-y-4 text-sm">
      <div className="grid sm:grid-cols-2 gap-3 text-xs text-zinc-300">
        <div>📞 {t.phone || '—'} {t.wa && <a className="underline text-emerald-400" href={`https://wa.me/${t.wa}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>}<br />✉ {t.email || '—'}</div>
        <div className="text-zinc-400">Created {new Date(t.createdAt).toLocaleString('en-UG', { timeZone: 'Africa/Kampala' })}</div>
      </div>
      <p className="whitespace-pre-wrap bg-zinc-950 border border-zinc-800 rounded p-3 text-zinc-200">{t.details}</p>
      {t.kind === 'template' && <p className="text-xs text-cyan-300">🌐 Website order{t.projectId ? ` — project ${t.projectId} (see the SITES tab to preview / download)` : ''}. Confirming the payment below unlocks the customer&apos;s download automatically.</p>}

      <div className="grid sm:grid-cols-3 gap-3">
        <label className="text-xs font-mono text-zinc-400">STATUS
          <select className={box} value={status} onChange={(e) => setStatus(e.target.value as TicketStatus)}>{[...STATUS_FLOW, 'CANCELLED' as TicketStatus].map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select></label>
        <label className="text-xs font-mono text-zinc-400">QUOTE (UGX)<input className={box} inputMode="numeric" value={quote} onChange={(e) => setQuote(e.target.value.replace(/\D/g, ''))} /></label>
        <label className="text-xs font-mono text-zinc-400">DEPOSIT (UGX)<input className={box} inputMode="numeric" value={deposit} onChange={(e) => setDeposit(e.target.value.replace(/\D/g, ''))} /></label>
      </div>
      <div className="space-y-1">
        <div className="text-[11px] font-mono text-zinc-500">QUICK REPLIES (fill the status and message, then press SAVE)</div>
        <div className="flex flex-wrap gap-2">
          {([
            ['Quote ready', 'QUOTED', quote ? `Your quote is ready: UGX ${Number(quote).toLocaleString('en-UG')}. Reply to confirm and we will proceed.` : 'Your quote is ready. Reply to confirm and we will proceed.'],
            ['Deposit needed', 'AWAITING_DEPOSIT', 'Please pay the deposit to start the work. The payment details are on your tracking page.'],
            ['Work started', 'IN_PROGRESS', 'We have started working on it.'],
            ['Ready for pickup', 'READY', 'Your item is ready for pickup. See you soon!'],
            ['Completed', 'COMPLETED', 'All done. Thank you for choosing us!'],
          ] as [string, TicketStatus, string][]).map(([label, st, text]) => (
            <button key={label} type="button" className={btn} onClick={() => { setStatus(st); setNote(text); }}>{label}</button>
          ))}
        </div>
      </div>
      <label className="block text-xs font-mono text-zinc-400">MESSAGE TO CUSTOMER (shown on their tracking page)
        <input className={box} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Screen arrived, repair takes ~2 hours" maxLength={500} /></label>
      <label className="block text-xs font-mono text-zinc-400">PRIVATE NOTES (only you)
        <textarea className={box} rows={2} value={priv} onChange={(e) => setPriv(e.target.value)} /></label>

      {t.payments.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-mono text-zinc-400">PAYMENTS (check your wallet before confirming)</div>
          {t.payments.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-2 text-xs bg-zinc-950 border border-zinc-800 rounded p-2">
              <span className="font-mono">{p.network} · {p.txId}</span><span className={p.status === 'CONFIRMED' ? 'text-emerald-400' : p.status === 'REJECTED' ? 'text-red-400' : 'text-amber-400'}>{p.status}</span>
              {p.status === 'SUBMITTED' && <><button className={btn} disabled={busy} onClick={() => save({ paymentId: p.id, paymentStatus: 'CONFIRMED' })}>✓ Confirm</button><button className={btn} disabled={busy} onClick={() => save({ paymentId: p.id, paymentStatus: 'REJECTED' })}>✕ Reject</button></>}
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button className={primary} disabled={busy} onClick={() => save()}>{busy ? '…' : 'SAVE'}</button>
        <label className="text-xs text-zinc-400 flex items-center gap-1"><input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} /> email customer (needs a verified sender)</label>
        <button type="button" className={btn} onClick={() => { if (!printJobCard(t)) setMsg('Allow pop-ups to print the job card.'); }}>🖨 Job card</button>
        {t.wa && <a className={btn} href={`https://wa.me/${t.wa}?text=${waText}`} target="_blank" rel="noopener noreferrer">💬 Send via WhatsApp</a>}
        {msg && <span role="status" className="text-xs text-zinc-300">{msg}</span>}
      </div>
      <div className="text-[11px] font-mono text-zinc-400">Quote {formatUGX(t.quoteUGX)} · Deposit {formatUGX(t.depositUGX)}</div>
    </div>
  );
}

/* ───────────── Portfolio CMS ───────────── */
const EMPTY: ProjectItem = { id: '', title: '', category: 'WEBAPP', description: '', image: '', tools: [], gallery: [], featured: false } as ProjectItem;

function Portfolio() {
  const [items, setItems] = useState<ProjectItem[]>([]); const [edit, setEdit] = useState<ProjectItem | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { api<{ projects: ProjectItem[] }>('projects').then((d) => setItems(d.projects)).catch((e) => setMsg(e.message)); }, []);

  const run = async (action: string, data: Record<string, unknown>) => {
    setMsg(null);
    try { const d = await api<{ projects: ProjectItem[] }>(action, data); setItems(d.projects); setEdit(null); setMsg('Saved ✓ — the site updates on the next page load.'); } catch (e: any) { setMsg(e.message); }
  };

  return (
    <section className="space-y-4">
      <p className="text-xs text-zinc-400">Currently using Unsplash placeholders? Replace the image URL with your real photos any time (https:// link or a /path inside <code>public/</code>).</p>
      <div className="flex gap-2 items-center"><button className={primary} onClick={() => setEdit({ ...EMPTY })}>+ NEW PROJECT</button>{msg && <span role="status" className="text-xs text-zinc-300">{msg}</span>}</div>
      {edit && (
        <div className="bg-zinc-900/50 border border-zinc-700 rounded-xl p-4 space-y-3">
          <input className={box} placeholder="Title" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
          <select className={box} value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value as ProjectItem['category'] })}>{['UI/UX', 'BRANDING', 'WEBAPP', 'HARDWARE'].map((c) => <option key={c}>{c}</option>)}</select>
          <textarea className={box} rows={3} placeholder="Description" value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} />
          <input className={box} placeholder="Main image URL" value={edit.image} onChange={(e) => setEdit({ ...edit, image: e.target.value })} />
          <input className={box} placeholder="Tools (comma separated)" value={(edit.tools || []).join(', ')} onChange={(e) => setEdit({ ...edit, tools: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} />
          <textarea className={box} rows={3} placeholder="Gallery image URLs (one per line)" value={(edit.gallery || []).join('\n')} onChange={(e) => setEdit({ ...edit, gallery: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) })} />
          <input className={box} placeholder="Client type (optional)" value={edit.clientType || ''} onChange={(e) => setEdit({ ...edit, clientType: e.target.value })} />
          <input className={box} placeholder="Real result / metric (optional — leave empty if none)" value={edit.metrics || ''} onChange={(e) => setEdit({ ...edit, metrics: e.target.value })} />
          <input className={box} placeholder="Live site link (optional): /demo/your-site from the Studio, or https://…" value={edit.liveUrl || ''} onChange={(e) => setEdit({ ...edit, liveUrl: e.target.value })} />
          <label className="text-xs text-zinc-300 flex items-center gap-2"><input type="checkbox" checked={!!edit.featured} onChange={(e) => setEdit({ ...edit, featured: e.target.checked })} /> Show on home page (first 3 featured)</label>
          <div className="flex gap-2"><button className={primary} onClick={() => run('project.save', { project: edit })}>SAVE</button><button className={btn} onClick={() => setEdit(null)}>Cancel</button></div>
        </div>
      )}
      <ul className="space-y-2">
        {items.map((p, i) => (
          <li key={p.id} className="flex items-center gap-3 bg-zinc-900/40 border border-zinc-800 rounded-lg p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.image} alt="" className="w-14 h-14 object-cover rounded" loading="lazy" />
            <div className="flex-1 min-w-0"><div className="text-sm font-semibold truncate">{p.title} {p.featured && <span className="text-[10px] text-cyan-400 font-mono">★ FEATURED</span>}</div><div className="text-xs text-zinc-400 font-mono">{p.id} · {p.category}</div></div>
            <button className={btn} disabled={i === 0} onClick={() => run('project.move', { id: p.id, dir: 'up' })} aria-label="Move up">↑</button>
            <button className={btn} disabled={i === items.length - 1} onClick={() => run('project.move', { id: p.id, dir: 'down' })} aria-label="Move down">↓</button>
            <button className={btn} onClick={() => setEdit(p)}>Edit</button>
            <button className={btn} onClick={() => confirm(`Delete “${p.title}”?`) && run('project.delete', { id: p.id })}>Delete</button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ───────────── Insights ───────────── */
function Insights() {
  const [s, setS] = useState<Stats | null>(null); const [err, setErr] = useState<string | null>(null);
  useEffect(() => { api<Stats>('stats').then(setS).catch((e) => setErr(e.message)); }, []);
  if (err) return <p className="text-xs text-red-400">{err}</p>;
  if (!s) return <p className="text-sm text-zinc-400">Loading…</p>;
  const max = Math.max(1, ...s.daily.map((d) => d.views));
  const top = (Object.entries(s.pages) as [string, number][]).sort((a, b) => b[1] - a[1]).slice(0, 8);
  return (
    <section className="space-y-8 text-sm">
      <div>
        <h2 className="font-mono text-xs text-zinc-400 mb-2">PAGE VIEWS · LAST 14 DAYS</h2>
        <div className="flex items-end gap-1 h-24" role="img" aria-label="Daily page views">{s.daily.length ? s.daily.map((d) => <div key={d.day} title={`${d.day}: ${d.views}`} className="flex-1 bg-cyan-500/70 rounded-t" style={{ height: `${(d.views / max) * 100}%` }} />) : <span className="text-zinc-400 text-xs">No data yet.</span>}</div>
      </div>
      <div className="grid sm:grid-cols-2 gap-6">
        <div><h2 className="font-mono text-xs text-zinc-400 mb-2">TOP PAGES</h2>{top.map(([p, n]) => <div key={p} className="flex justify-between border-b border-zinc-900 py-1"><span>{p}</span><span className="font-mono text-zinc-400">{n}</span></div>)}</div>
        <div><h2 className="font-mono text-xs text-zinc-400 mb-2">ACTIONS</h2>{Object.entries(s.events).map(([p, n]) => <div key={p} className="flex justify-between border-b border-zinc-900 py-1"><span>{p}</span><span className="font-mono text-zinc-400">{n}</span></div>)}
          <h2 className="font-mono text-xs text-zinc-400 mt-4 mb-2">REQUESTS BY STATUS</h2>{Object.entries(s.byStatus).map(([p, n]) => <div key={p} className="flex justify-between border-b border-zinc-900 py-1"><span>{STATUS_LABEL[p as TicketStatus] || p}</span><span className="font-mono text-zinc-400">{n}</span></div>)}</div>
      </div>
      <div><h2 className="font-mono text-xs text-zinc-400 mb-2">QUESTIONS THE CHAT COULDN&apos;T ANSWER (add these to the knowledge base)</h2>
        {s.unanswered.length ? s.unanswered.map((u) => <div key={u.q} className="flex justify-between border-b border-zinc-900 py-1"><span>{u.q}</span><span className="font-mono text-zinc-400">×{u.n}</span></div>) : <p className="text-xs text-zinc-400">None recorded.</p>}</div>
      <div>
        <h2 className="font-mono text-xs text-zinc-400 mb-2">SECURITY · RECENT ADMIN ACTIVITY</h2>
        {s.audit?.length ? s.audit.map((a, i) => <div key={i} className="flex flex-wrap justify-between gap-2 border-b border-zinc-900 py-1 text-xs"><span className={a.ok ? 'text-emerald-400' : 'text-red-400'}>{a.event} {a.ok ? '✓' : '✕'}</span><span className="font-mono text-zinc-400">{a.ip} · {new Date(a.at).toLocaleString('en-UG', { timeZone: 'Africa/Kampala' })}</span><span className="w-full text-[10px] text-zinc-600 truncate">{a.ua}</span></div>) : <p className="text-xs text-zinc-400">Nothing yet.</p>}
        <div className="mt-3 flex flex-wrap gap-2"><button className={btn} onClick={async () => { if (confirm('Sign out every device, including this one?')) { await api('logoutAll'); location.reload(); } }}>Log out all devices</button>
          <button className={btn} onClick={async () => { if (confirm('Clear the sign-in log? One entry will remain saying it was cleared.')) { await api('clearAudit'); location.reload(); } }}>Clear log</button></div>
      </div>
      <div><h2 className="font-mono text-xs text-zinc-400 mb-2">ERRORS</h2>
        {s.errors.length ? s.errors.map((e, i) => <div key={i} className="border-b border-zinc-900 py-2"><div className="text-red-300">{e.msg}</div><div className="text-[11px] font-mono text-zinc-400">{e.where} · ×{e.n} · last {new Date(e.last).toLocaleString('en-UG', { timeZone: 'Africa/Kampala' })}</div></div>) : <p className="text-xs text-zinc-400">No errors recorded 🎉</p>}</div>
    </section>
  );
}


/* ───────────── Website templates ───────────── */
type TplRow = { id: string; name: string; description: string; category: string; tag?: string; priceUSD: number | null; priceUGX: number | null; enabled: boolean };

function Templates() {
  const [rows, setRows] = useState<TplRow[]>([]); const [msg, setMsg] = useState<string | null>(null);
  const [rates, setRates] = useState<Rates>(FALLBACK_RATES);
  useEffect(() => { api<{ templates: TplRow[]; rates: Rates }>('templates.list').then((d) => { setRows(d.templates); if (d.rates?.rates?.UGX) setRates(d.rates); }).catch((e) => setMsg(e.message)); }, []);
  const set = (id: string, patch: Partial<TplRow>) => setRows((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const act = async (action: string, data: Record<string, unknown>, ok = 'Saved ✓') => {
    setMsg(null);
    try { const d = await api<{ templates?: TplRow[] }>(action, data); if (d.templates) setRows(d.templates); setMsg(ok); } catch (e: any) { setMsg(e.message); }
  };
  const num = (v: string): number | null => (v.trim() === '' ? null : Number(v.replace(/\D/g, '')));
  return (
    <section className="space-y-4">
      <div className="text-xs text-zinc-400 space-y-1">
        <p><strong className="text-zinc-200">How prices work:</strong> each template has a <strong>market-reference USD price</strong> (what comparable premium website templates typically sell for, about US$15–60). Customers see it converted to their currency at the <strong>live exchange rate</strong> and pay in UGX by mobile money.</p>
        <p>Want a fixed shilling price instead? Fill the <strong>UGX override</strong> (0 = free). Leave both empty = not for sale.</p>
        <p className="font-mono text-zinc-500">Current rate: 1 USD = {Math.round(rates.rates.UGX).toLocaleString()} UGX ({rates.source}{rates.source === 'fallback' ? ' — estimate' : ''})</p>
      </div>
      {msg && <p role="status" className="text-xs text-zinc-300">{msg}</p>}
      <ul className="space-y-3">
        {rows.map((t) => {
          const eff = effectiveUGX(t, rates.rates.UGX);
          return (
            <li key={t.id} className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-4 space-y-3">
              <div className="grid sm:grid-cols-3 gap-3">
                <input className={box} value={t.name} onChange={(e) => set(t.id, { name: e.target.value })} aria-label="Template name" />
                <select className={box} value={t.category} onChange={(e) => set(t.id, { category: e.target.value })} aria-label="Category">{CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}</select>
                <input className={box} value={t.tag ?? ''} maxLength={16} placeholder="Badge (e.g. New)" onChange={(e) => set(t.id, { tag: e.target.value })} aria-label="Badge" />
              </div>
              <textarea className={box} rows={2} value={t.description} onChange={(e) => set(t.id, { description: e.target.value })} aria-label="Description" />
              <div className="flex flex-wrap items-center gap-3">
                <label className="text-xs font-mono text-zinc-400 flex items-center gap-2">USD<input className={`${box} w-24`} inputMode="numeric" placeholder="—" value={t.priceUSD ?? ''} onChange={(e) => set(t.id, { priceUSD: num(e.target.value) })} /></label>
                <label className="text-xs font-mono text-zinc-400 flex items-center gap-2">UGX override<input className={`${box} w-36`} inputMode="numeric" placeholder="auto (live rate)" value={t.priceUGX ?? ''} onChange={(e) => set(t.id, { priceUGX: num(e.target.value) })} /></label>
                <label className="text-xs text-zinc-300 flex items-center gap-1"><input type="checkbox" checked={t.enabled} onChange={(e) => set(t.id, { enabled: e.target.checked })} /> visible</label>
                <span className="text-xs font-mono text-cyan-300">{eff === null ? '🚫 not for sale' : eff === 0 ? '🎁 free' : `Customers pay ${formatUGX(eff)}`}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className={primary} onClick={() => act('template.save', { ...t })}>SAVE</button>
                <a className={btn} href={`/builder/edit?template=${t.id}`} target="_blank" rel="noopener noreferrer">✎ Edit design</a>
                <a className={btn} href={`/builder/view?t=${t.id}`} target="_blank" rel="noopener noreferrer">👁 View</a>
                <button className={btn} onClick={() => act('template.duplicate', { id: t.id }, 'Duplicated ✓ (hidden until you enable it)')}>⧉ Duplicate</button>
                <button className={btn} onClick={() => confirm(`Delete “${t.name}”?`) && act('template.delete', { id: t.id }, 'Deleted ✓')}>🗑 Delete</button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ───────────── Customer sites (template-builder projects) ───────────── */
type SiteRow = { id: string; name: string; template: string; siteName: string; updatedAt: string; status: 'DRAFT' | 'AWAITING_PAYMENT' | 'PAID'; ticket: string | null; price: number | null; contact: { name: string; email: string; phone: string } | null; kb: number };

function Sites() {
  const [rows, setRows] = useState<SiteRow[]>([]); const [msg, setMsg] = useState<string | null>(null);
  const [view, setView] = useState<{ id: string; html: string } | null>(null);
  const load = useCallback(() => api<{ sites: SiteRow[] }>('sites.list').then((d) => setRows(d.sites)).catch((e) => setMsg(e.message)), []);
  useEffect(() => { load(); }, [load]);

  const preview = async (id: string) => {
    try {
      const d = await api<{ config: SiteConfig; assets: Record<string, string> }>('site.get', { id });
      setView({ id, html: buildSite(d.config, { mode: 'preview', assetSrc: (a) => d.assets[a] || '' }).html });
    } catch (e: any) { setMsg(e.message); }
  };
  const badge = (st: SiteRow['status']) => st === 'PAID' ? 'text-emerald-400' : st === 'AWAITING_PAYMENT' ? 'text-amber-400' : 'text-zinc-400';

  return (
    <section className="space-y-4">
      <p className="text-xs text-zinc-400">Sites customers are building. Confirm their payment under <strong>Tickets</strong> — that unlocks their download. You can always preview or download any site here.</p>
      {msg && <p role="alert" className="text-xs text-red-400">{msg}</p>}
      {rows.length === 0 && <p className="text-sm text-zinc-400">No customer projects yet.</p>}
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.id} className="bg-zinc-900/40 border border-zinc-800 rounded-lg p-3 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[12rem]">
              <div className="text-sm font-semibold">{r.siteName} <span className="text-xs text-zinc-500 font-normal">· {r.template}</span></div>
              <div className="text-[11px] font-mono text-zinc-400">{r.id} · {r.kb} KB · {new Date(r.updatedAt).toLocaleDateString('en-UG')}{r.contact ? ` · ${r.contact.name} ${r.contact.phone || r.contact.email}` : ''}</div>
            </div>
            <span className={`text-xs font-mono ${badge(r.status)}`}>{r.status.replace('_', ' ')}{r.price ? ` · ${formatUGX(r.price)}` : ''}{r.ticket ? ` · ${r.ticket}` : ''}</span>
            <button className={btn} onClick={() => preview(r.id)}>👁 Preview</button>
            <a className={btn} href={`/api/admin/zip?id=${r.id}`}>⬇ Zip</a>
            <button className={btn} onClick={async () => { if (confirm(`Delete project ${r.id}? This cannot be undone.`)) { await api('site.delete', { id: r.id }); load(); } }}>🗑</button>
          </li>
        ))}
      </ul>
      {view && (
        <div className="fixed inset-0 z-50 bg-black/80 flex flex-col p-3" role="dialog" aria-modal="true" aria-label="Site preview">
          <div className="flex justify-between items-center mb-2 text-xs font-mono text-zinc-300"><span>Preview · {view.id}</span><button className={btn} onClick={() => setView(null)}>Close ✕</button></div>
          <iframe title="Customer site preview" sandbox="allow-scripts" srcDoc={view.html} className="flex-1 w-full rounded bg-white border-0" />
        </div>
      )}
    </section>
  );
}
