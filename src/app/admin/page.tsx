// src/app/admin/page.tsx — owner dashboard (tickets · portfolio CMS · insights). Auth: ADMIN_PASSWORD env var.
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api, box, primary, needsAttention, useAdminTickets } from '@/components/admin/adminKit';
import Overview from '@/components/admin/Overview';
import AdminShell, { deskTabFromUrl, goDeskTab } from '@/components/admin/AdminShell';
import { PageHead } from '@/components/admin/ui';
import { SITE } from '@/utils/chatEngine/siteConfig';
import TicketsPanel from '@/components/admin/TicketsPanel';
import TicketEditor from '@/components/admin/TicketEditor';
import PortfolioPanel from '@/components/admin/PortfolioPanel';
import TemplatesPanel from '@/components/admin/TemplatesPanel';
import SitesPanel from '@/components/admin/SitesPanel';
import InsightsPanel from '@/components/admin/InsightsPanel';
import DataPanel from '@/components/admin/DataPanel';
import CustomersPanel from '@/components/admin/CustomersPanel';
import ContentPanel from '@/components/admin/ContentPanel';
import SettingsPanel from '@/components/admin/SettingsPanel';
import StudioPanel from '@/components/studio/StudioPanel';

import Icon, { type IconName } from '@/components/ui/Icon';
type Tab = 'overview' | 'tickets' | 'customers' | 'content' | 'settings' | 'studio' | 'templates' | 'sites' | 'portfolio' | 'insights' | 'data';
const TAB_META: Record<Tab, { label: string; icon: IconName; title: string; sub: string }> = {
  overview: { label: 'Overview', icon: 'home', title: 'Overview', sub: 'What needs you now, and how the business is doing.' },
  tickets: { label: 'Requests', icon: 'mail', title: 'Requests', sub: 'Repairs, design briefs and website orders: search, update and reply.' },
  customers: { label: 'Customers', icon: 'user', title: 'Customers', sub: 'Everyone who has contacted you, grouped from their requests.' },
  studio: { label: 'Studio', icon: 'layout', title: 'Studio', sub: 'Complete business websites you design for clients.' },
  templates: { label: 'Templates', icon: 'cube', title: 'Website templates', sub: 'The starting points customers pick in the builder, and their prices.' },
  sites: { label: 'Customer sites', icon: 'globe', title: 'Customer sites', sub: 'Sites customers are building or have ordered.' },
  portfolio: { label: 'Portfolio', icon: 'star', title: 'Portfolio', sub: 'The projects shown on your public site.' },
  content: { label: 'Content', icon: 'lightbulb', title: 'Site content', sub: 'Reviews, prices, FAQ, guides, your repair promise and map: what visitors see and trust.' },
  settings: { label: 'Settings', icon: 'wrench', title: 'Site settings', sub: 'Business details, maintenance mode and optional features.' },
  insights: { label: 'Activity', icon: 'compass', title: 'Activity log', sub: 'Visits, unanswered chat questions, errors and sign-ins.' },
  data: { label: 'Data', icon: 'disk', title: 'Backup & data', sub: 'Download a backup, restore one, or export your requests.' },
};
const TAB_ORDER = Object.keys(TAB_META) as Tab[];
const isTab = (v: string): v is Tab => (TAB_ORDER as string[]).includes(v);

function greeting(): string {
  const h = Number(new Date().toLocaleString('en-GB', { hour: '2-digit', hour12: false, timeZone: 'Africa/Kampala' }));
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export default function AdminPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [tab, setTabState] = useState<Tab>('overview');
  const [totp, setTotp] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [storage, setStorage] = useState<{ persistent: boolean; where: string; note: string } | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => { api('me').then((r: any) => { setStorage(r?.storage ?? null); setAuthed(true); }).catch((e) => { setTotp(!!e.data?.totp); setConfigured(e.data?.configured !== false); setAuthed(false); }); }, []);

  // The section lives in the address (/admin?tab=tickets) so Back works and links can be shared; the sidebar and this page stay in step.
  useEffect(() => {
    const sync = () => { const t = deskTabFromUrl(); setTabState(isTab(t) ? t : 'overview'); };
    sync();
    window.addEventListener('admin:tab', sync); window.addEventListener('popstate', sync);
    return () => { window.removeEventListener('admin:tab', sync); window.removeEventListener('popstate', sync); };
  }, []);
  const setTab = useCallback((t: Tab) => goDeskTab(t), []);

  // One live copy of the requests, shared by the Overview and Requests sections (refreshes every 45 s while visible).
  const onAuthLost = useCallback(() => setAuthed(false), []);
  const live = useAdminTickets(authed === true, onAuthLost);
  const attention = useMemo(() => live.tickets.filter(needsAttention).length, [live.tickets]);

  // Browser tab title shows how many things are waiting, and the sidebar shows the same count.
  useEffect(() => {
    document.title = `${attention > 0 ? `(${attention}) ` : ''}Admin · System Portfolio`;
    window.dispatchEvent(new CustomEvent('admin:badges', { detail: { tickets: attention } }));
  }, [attention]);

  if (authed === null) return <div className="min-h-screen bg-zinc-950" />;
  if (!authed) return <Login totp={totp} configured={configured} onDone={() => { api('me').then((r: any) => setStorage(r?.storage ?? null)).catch(() => undefined); setAuthed(true); }} />;

  const meta = TAB_META[tab];
  const openTicket = (id: string) => { setOpenId(id); setTab('tickets'); };

  return (
    <AdminShell>
      {/* phone/tablet: the sidebar is a drawer, so keep a quick section switcher here */}
      <nav className="sb-slim -mx-3 mb-4 flex gap-1.5 overflow-x-auto px-3 pb-1 md:hidden" aria-label="Sections">
        {TAB_ORDER.map((id) => (
          <button key={id} type="button" onClick={() => setTab(id)} aria-current={tab === id ? 'page' : undefined}
            className={`flex min-h-9 flex-none cursor-pointer items-center gap-1.5 rounded-full border px-3 text-xs transition ${tab === id ? 'border-accent bg-accent/15 font-semibold text-accent' : 'border-zinc-800 text-zinc-400'}`}>
            <Icon name={TAB_META[id].icon} size={13} />{TAB_META[id].label}{id === 'tickets' && attention > 0 && <span className="rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-zinc-950">{attention}</span>}
          </button>
        ))}
      </nav>

      <PageHead icon={meta.icon} title={tab === 'overview' ? `${greeting()}, ${SITE.ownerName.split(' ')[0]}` : meta.title} sub={tab === 'overview' ? meta.sub : meta.sub} />

      <div key={tab} className="adm-fade">
        {tab === 'overview' && <Overview tickets={live.tickets} loading={live.loading} goTab={setTab} onOpenTicket={openTicket} storageNote={storage && !storage.persistent ? storage.note : null} />}
        {tab === 'tickets' && (
          <TicketsPanel
            tickets={live.tickets} setTickets={(fn) => live.setTickets(fn)} reload={() => live.reload()} error={live.error}
            fresh={live.fresh} clearFresh={live.clearFresh} openId={openId} setOpenId={setOpenId}
            renderEditor={(t, onSaved) => <TicketEditor t={t} onSaved={onSaved} />}
          />
        )}
        {tab === 'customers' && <CustomersPanel tickets={live.tickets} onOpenTicket={openTicket} />}
        {tab === 'content' && <ContentPanel />}
        {tab === 'settings' && <SettingsPanel />}
        {tab === 'studio' && <StudioPanel onAuthLost={onAuthLost} />}
        {tab === 'templates' && <TemplatesPanel />}
        {tab === 'sites' && <SitesPanel />}
        {tab === 'portfolio' && <PortfolioPanel />}
        {tab === 'insights' && <InsightsPanel />}
        {tab === 'data' && <DataPanel tickets={live.tickets} />}
      </div>
    </AdminShell>
  );
}

function Login({ onDone, totp, configured }: { onDone: () => void; totp: boolean; configured: boolean }) {
  const [pw, setPw] = useState(''); const [code, setCode] = useState(''); const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false); const [show, setShow] = useState(false);
  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-zinc-950 px-4 py-10 text-zinc-100">
      <div className="pointer-events-none absolute inset-0 opacity-[0.35]" aria-hidden style={{ backgroundImage: 'linear-gradient(rgba(var(--accent-rgb),.07) 1px,transparent 1px),linear-gradient(90deg,rgba(var(--accent-rgb),.07) 1px,transparent 1px)', backgroundSize: '44px 44px', maskImage: 'radial-gradient(ellipse at 50% 30%,#000 10%,transparent 70%)', WebkitMaskImage: 'radial-gradient(ellipse at 50% 30%,#000 10%,transparent 70%)' }} />
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-accent/10 blur-3xl" aria-hidden />
      <main className="relative w-full max-w-[22rem] ios-enter">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-strong text-zinc-950 shadow-lg shadow-accent/25"><Icon name="terminal" size={26} /></span>
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight">Control Center</h1>
          <p className="mt-1 text-sm text-zinc-500">Sign in to manage {SITE.ownerName.split(' ')[0] ? 'your site' : 'the site'}</p>
        </div>
        <form className="space-y-4 rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-5 shadow-2xl shadow-black/40 backdrop-blur sm:p-6" onSubmit={async (e) => {
          e.preventDefault(); setBusy(true); setErr(null);
          try { await api('login', { password: pw, code }); onDone(); } catch (x: any) { setErr(x.message); } finally { setBusy(false); }
        }}>
          {!configured && (
            <div role="note" className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-200">
              <b>Admin isn&apos;t switched on yet.</b> In Vercel open <i>Settings → Environment Variables</i>, add <code className="font-mono">ADMIN_PASSWORD</code> (10+ characters), then redeploy. After that, sign in here.
            </div>
          )}
          <label className="block"><span className="mb-1.5 block text-xs font-medium text-zinc-400">Password</span>
            <span className="relative block">
              <Icon name="key" size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input type={show ? 'text' : 'password'} autoComplete="current-password" autoFocus className={`${box} !min-h-11 pl-9 pr-16`} placeholder="Your admin password" value={pw} onChange={(e) => setPw(e.target.value)} aria-label="Password" />
              <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-1.5 top-1/2 min-h-8 -translate-y-1/2 cursor-pointer rounded-md px-2 text-[11px] text-zinc-400 hover:text-accent" aria-pressed={show}>{show ? 'Hide' : 'Show'}</button>
            </span></label>
          {totp && <label className="block"><span className="mb-1.5 block text-xs font-medium text-zinc-400">Authenticator code</span>
            <span className="relative block"><Icon name="shield" size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input inputMode="text" autoComplete="one-time-code" maxLength={10} className={`${box} !min-h-11 pl-9 font-mono tracking-[0.2em]`} placeholder="000000" value={code} onChange={(e) => setCode(e.target.value)} aria-label="Authenticator code" /></span></label>}
          {totp && <p className="-mt-1 text-[11px] leading-relaxed text-zinc-500">Use the current 6-digit code from your authenticator app (it changes every 30 seconds, so wait for a fresh one if it fails). Lost your phone? Type one of your recovery codes instead.</p>}
          {err && <p role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{err}</p>}
          <button className={`${primary} w-full !min-h-11 !text-sm`} disabled={busy || !pw || (totp && code.replace(/\s/g, '').length < 6)}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>
        <Link href="/" className="mt-5 flex items-center justify-center gap-1.5 text-xs text-zinc-500 hover:text-accent"><Icon name="arrow" size={12} className="rotate-180" /> Back to the website</Link>
      </main>
    </div>
  );
}
