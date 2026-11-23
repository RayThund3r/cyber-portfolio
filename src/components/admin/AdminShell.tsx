// src/components/admin/AdminShell.tsx
//
// The admin frame: sign-in gate, sidebar, command palette (Ctrl/Cmd+K), "g then letter" shortcuts, privacy (ghost) mode,
// session countdown, and a hidden Konami-code surprise. It is a full-screen layer on top of the public site's chrome,
// so the public nav, footer and chat widget never show inside the admin area.
'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Icon, { type IconName } from '@/components/ui/Icon';
import { useTheme } from '@/context/ThemeContext';
import { api, ApiError } from '@/lib/admin/client';
import { AdminProviders, useGhost, useToast } from './ui';
import { SITE } from '@/utils/chatEngine/siteConfig';
import MatrixRain from './MatrixRain';

export interface Me { ok: boolean; sid: string; exp: number; store: 'upstash' | 'file' | 'memory'; totp: boolean }
const MeCtx = createContext<{ me: Me | null; signOut: () => Promise<void>; openPalette: () => void }>({ me: null, signOut: async () => undefined, openPalette: () => undefined });
export const useAdmin = () => useContext(MeCtx);

export interface NavItem { href: string; label: string; icon: IconName; key?: string; hint: string; tab?: string }
/** Sidebar structure. Items with `tab` open a section of the Desk (/admin?tab=…) without reloading the page. */
export const NAV_GROUPS: Array<{ label: string; items: NavItem[] }> = [
  { label: 'Work', items: [
    { href: '/admin?tab=overview', tab: 'overview', label: 'Overview', icon: 'home', key: 'd', hint: 'What needs you now' },
    { href: '/admin?tab=tickets', tab: 'tickets', label: 'Requests', icon: 'mail', key: 'r', hint: 'Repairs, design and website orders' },
    { href: '/admin?tab=customers', tab: 'customers', label: 'Customers', icon: 'user', hint: 'People grouped from their requests' },
  ] },
  { label: 'Build', items: [
    { href: '/admin?tab=studio', tab: 'studio', label: 'Studio', icon: 'layout', hint: 'Websites you design for clients' },
    { href: '/admin?tab=templates', tab: 'templates', label: 'Templates', icon: 'cube', hint: 'Builder starting templates and prices' },
    { href: '/admin?tab=sites', tab: 'sites', label: 'Customer sites', icon: 'globe', hint: 'Sites customers are building' },
    { href: '/admin?tab=portfolio', tab: 'portfolio', label: 'Portfolio', icon: 'star', hint: 'Your projects on the public site' },
  ] },
  { label: 'Website', items: [
    { href: '/admin?tab=settings', tab: 'settings', label: 'Settings', icon: 'wrench', hint: 'Business details, maintenance mode, optional features' },
    { href: '/admin/site', label: 'Banner & content', icon: 'flag', key: 's', hint: 'Announcement bar, availability, content check' },
    { href: '/admin/events', label: 'Events', icon: 'bell', key: 'v', hint: 'Holidays, national days, surprise banners' },
    { href: '/admin/games', label: 'Games', icon: 'gamepad', key: 'm', hint: 'Embed your own web games' },
  ] },
  { label: 'Insight', items: [
    { href: '/admin/overview', label: 'Pulse', icon: 'spark', key: 'o', hint: 'The big picture' },
    { href: '/admin/analytics', label: 'Analytics', icon: 'grid', key: 'a', hint: 'Traffic, pages, devices' },
    { href: '/admin?tab=insights', tab: 'insights', label: 'Activity log', icon: 'compass', hint: 'Unanswered chat questions, errors, sign-ins' },
    { href: '/admin/chat', label: 'Chat Lab', icon: 'brain', key: 'c', hint: 'Questions, gaps, playground' },
  ] },
  { label: 'System', items: [
    { href: '/admin/launch', label: 'Launch Pad', icon: 'bolt', key: 'x', hint: 'Readiness score and what is left to switch on' },
    { href: '/admin/ai-access', label: 'AI Access', icon: 'key', key: 'i', hint: 'Daily limits, plans, access codes' },
    { href: '/admin/ai-providers', label: 'AI Providers', icon: 'cpu', key: 'p', hint: 'Free AI services: switch on/off, order, limits' },
    { href: '/admin/health', label: 'Health', icon: 'shield', key: 'h', hint: 'Env, SEO audit, uptime' },
    { href: '/admin/security', label: 'Security', icon: 'lock', key: 'e', hint: 'Sessions, 2FA, audit' },
    { href: '/admin?tab=data', tab: 'data', label: 'Backup & data', icon: 'disk', hint: 'Backups, restore, CSV export' },
    { href: '/admin/board', label: 'Board', icon: 'puzzle', key: 'b', hint: 'Your to-do kanban' },
    { href: '/admin/shell', label: 'Shell', icon: 'terminal', key: 't', hint: 'Command-line for the panel' },
    { href: '/admin/lab', label: 'Lab', icon: 'lightbulb', key: 'l', hint: 'Pulse, digest, link builder' },
  ] },
];
export const NAV: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

/** The Desk section named in the address bar (?tab=…), or 'overview'. */
export function deskTabFromUrl(): string {
  try { return new URLSearchParams(window.location.search).get('tab') || 'overview'; } catch { return 'overview'; }
}
/** Switch Desk section without a page reload (sidebar, Overview shortcuts and the mobile tab strip all use this). */
export function goDeskTab(tab: string) {
  try { window.history.pushState(null, '', `/admin?tab=${tab}`); } catch { /* ignore */ }
  window.dispatchEvent(new Event('admin:tab'));
}

const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];

export default function AdminShell({ children }: { children: ReactNode }) {
  return <AdminProviders><Frame>{children}</Frame></AdminProviders>;
}

function Frame({ children }: { children: ReactNode }) {
  const path = usePathname() || '/admin';
  const router = useRouter();
  const toast = useToast();
  const { ghost, setGhost } = useGhost();
  const { theme, cycleTheme } = useTheme();
  const [me, setMe] = useState<Me | null>(null);
  const [state, setState] = useState<'checking' | 'in' | 'out'>('checking');
  const [navOpen, setNavOpen] = useState(false);
  const [palette, setPalette] = useState(false);
  const [matrix, setMatrix] = useState(false);
  const [left, setLeft] = useState('');
  const [deskTab, setDeskTab] = useState('overview');
  const [badges, setBadges] = useState<Record<string, number>>({});

  useEffect(() => { document.documentElement.dataset.admin = '1'; return () => { delete document.documentElement.dataset.admin; }; }, []);

  const check = useCallback(async () => {
    try { const m = await api<Me>('/api/admin/me'); setMe(m); setState('in'); }
    catch (e) { setMe(null); setState('out'); if (e instanceof ApiError && e.status !== 401 && e.status !== 503) toast(e.message, 'err'); }
  }, [toast]);
  useEffect(() => { void check(); }, [check]);
  useEffect(() => { const f = () => { setMe(null); setState('out'); }; window.addEventListener('admin:signed-out', f); return () => window.removeEventListener('admin:signed-out', f); }, []);
  useEffect(() => { if (state === 'out') window.location.assign('/admin'); }, [state]);
  useEffect(() => { setNavOpen(false); setDeskTab(deskTabFromUrl()); }, [path]);
  useEffect(() => {
    const sync = () => { setDeskTab(deskTabFromUrl()); setNavOpen(false); };
    const badge = (e: Event) => setBadges((b) => ({ ...b, ...((e as CustomEvent).detail || {}) }));
    window.addEventListener('admin:tab', sync); window.addEventListener('popstate', sync); window.addEventListener('admin:badges', badge);
    return () => { window.removeEventListener('admin:tab', sync); window.removeEventListener('popstate', sync); window.removeEventListener('admin:badges', badge); };
  }, []);

  const signOut = useCallback(async () => { try { await api('/api/admin', { method: 'POST', body: { action: 'logout' } }); } catch { /* ignore */ } setMe(null); setState('out'); window.location.assign('/admin'); }, []);

  // session countdown
  useEffect(() => {
    if (!me) return;
    const tick = () => { const s = Math.max(0, Math.round((me.exp - Date.now()) / 1000)); setLeft(s > 3600 ? `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m` : `${Math.floor(s / 60)}m`); if (s === 0) { setMe(null); setState('out'); } };
    tick(); const id = window.setInterval(tick, 20000); return () => window.clearInterval(id);
  }, [me]);

  // keyboard: palette, g-then-letter, konami
  const seq = useRef<string[]>([]); const gAt = useRef(0);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette((p) => !p); return; }
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable || t.tagName === 'SELECT');
      if (e.key === 'Escape') { setPalette(false); setNavOpen(false); }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      seq.current = [...seq.current, e.key.length === 1 ? e.key.toLowerCase() : e.key].slice(-10);
      if (seq.current.join() === KONAMI.join()) { setMatrix(true); toast('Welcome back, operator.', 'info'); seq.current = []; return; }
      if (Date.now() - gAt.current < 1200) { const n = NAV.find((x) => x.key === e.key.toLowerCase()); gAt.current = 0; if (n) { if (n.tab && window.location.pathname === '/admin') goDeskTab(n.tab); else router.push(n.href); return; } }
      if (e.key === 'g') gAt.current = Date.now();
      if (e.key === '/' && !(window.location.pathname === '/admin' && deskTabFromUrl() === 'tickets')) { e.preventDefault(); setPalette(true); }
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, [router, toast]);

  const here = NAV.find((n) => (n.tab ? path === '/admin' && deskTab === n.tab : path === n.href || path.startsWith(n.href + '/'))) ?? (path === '/admin' ? NAV[0] : undefined);
  const groupOf = (n: NavItem) => NAV_GROUPS.find((g) => g.items.includes(n))?.label ?? '';
  const ctx = useMemo(() => ({ me, signOut, openPalette: () => setPalette(true) }), [me, signOut]);

  return (
    <MeCtx.Provider value={ctx}>
      <div className="fixed inset-0 z-[1000] overflow-hidden bg-zinc-950 text-zinc-100" data-admin-root>
        {matrix && <MatrixRain onDone={() => setMatrix(false)} />}
        {state !== 'in' ? (
          <div className="flex h-full items-center justify-center font-mono text-xs text-zinc-500"><span className="animate-pulse">AUTHENTICATING…</span></div>
        ) : (
          <div className="flex h-full">
            {navOpen && <button aria-label="Close menu" className="fixed inset-0 z-10 bg-black/60 backdrop-blur-[2px] md:hidden" onClick={() => setNavOpen(false)} />}
            <aside className={`fixed inset-y-0 left-0 z-20 flex w-64 flex-col border-r border-zinc-800/80 bg-zinc-950 transition-transform md:static md:translate-x-0 ${navOpen ? 'translate-x-0' : '-translate-x-full'}`} aria-label="Admin navigation">
              <div className="flex items-center gap-3 px-4 pb-3 pt-4">
                <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-accent-strong text-zinc-950 shadow-lg shadow-accent/20"><Icon name="terminal" size={20} /></span>
                <span className="min-w-0 leading-tight"><span className="block truncate text-sm font-extrabold tracking-tight text-zinc-100">Control Center</span><span className="block truncate font-mono text-[10px] text-zinc-500">{SITE.ownerName} · admin</span></span>
              </div>
              <nav className="sb-slim flex-1 space-y-4 overflow-y-auto px-3 pb-3 pt-1">
                {NAV_GROUPS.map((g) => (
                  <div key={g.label}>
                    <div className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-600">{g.label}</div>
                    <div className="space-y-0.5">
                      {g.items.map((n) => {
                        const onDesk = path === '/admin';
                        const active = n.tab ? onDesk && deskTab === n.tab : n.href === '/admin' ? false : path === n.href || path.startsWith(n.href + '/');
                        const count = n.tab ? badges[n.tab] : 0;
                        return (
                          <Link key={n.href} href={n.href} prefetch={false} aria-current={active ? 'page' : undefined} title={n.hint}
                            onClick={(e) => { if (n.tab && onDesk && !(e.metaKey || e.ctrlKey || e.shiftKey)) { e.preventDefault(); goDeskTab(n.tab); } }}
                            className={`group relative flex min-h-9 items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] transition ${active ? 'bg-accent/12 font-semibold text-accent' : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100'}`}>
                            {active && <span className="absolute -left-3 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-accent" aria-hidden />}
                            <Icon name={n.icon} size={16} className={active ? '' : 'text-zinc-500 group-hover:text-zinc-300'} /><span className="flex-1 truncate">{n.label}</span>
                            {!!count && <span className="rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-zinc-950">{count}</span>}
                            {!count && n.key && <kbd className="hidden font-mono text-[9px] uppercase text-zinc-700 group-hover:text-zinc-500 lg:inline">g {n.key}</kbd>}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </nav>
              <div className="space-y-2 border-t border-zinc-800/80 p-3">
                <Link href="/admin/health" className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-[11px] ${me?.store !== 'memory' ? 'border-emerald-500/25 bg-emerald-500/5 text-emerald-300' : 'border-amber-500/40 bg-amber-500/10 text-amber-300'}`}>
                  <span className={`h-2 w-2 flex-none rounded-full ${me?.store !== 'memory' ? 'bg-emerald-400' : 'animate-pulse bg-amber-400'}`} />
                  <span className="flex-1 font-medium">{me?.store === 'memory' ? 'Temporary storage' : 'Permanent storage'}</span><span className="underline decoration-dotted">{me?.store !== 'memory' ? 'ok' : 'fix'}</span>
                </Link>
                <Link href="/" target="_blank" className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12px] text-zinc-400 transition hover:bg-zinc-900 hover:text-accent"><Icon name="external" size={14} />View live site</Link>
              </div>
            </aside>
            <div className="flex min-w-0 flex-1 flex-col">
              <header className="flex h-14 flex-none items-center gap-2 border-b border-zinc-800/80 bg-zinc-950/80 px-3 backdrop-blur-md sm:px-5">
                <button type="button" className="mr-1 flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-zinc-800 text-zinc-300 hover:border-zinc-600 md:hidden" aria-label="Open menu" onClick={() => setNavOpen(true)}><Icon name="grid" size={16} /></button>
                <div className="min-w-0 flex-1 md:flex-none md:basis-52">
                  <div className="truncate text-sm font-bold text-zinc-100">{here?.label ?? 'Admin'}</div>
                  <div className="hidden truncate font-mono text-[10px] text-zinc-600 sm:block">{here ? groupOf(here) : ''}</div>
                </div>
                <button type="button" onClick={() => setPalette(true)} className="hidden min-h-9 max-w-md flex-1 cursor-pointer items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 text-left text-xs text-zinc-500 transition hover:border-accent/40 sm:flex"><Icon name="search" size={14} />Jump to a page or action…<kbd className="ml-auto rounded border border-zinc-700 px-1.5 py-0.5 font-mono text-[9px] text-zinc-500">Ctrl K</kbd></button>
                <div className="ml-auto flex items-center gap-1.5">
                  <button type="button" onClick={() => setPalette(true)} aria-label="Search" className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-zinc-800 text-zinc-400 hover:text-accent sm:hidden"><Icon name="search" size={15} /></button>
                  <button type="button" onClick={() => { setGhost(!ghost); toast(ghost ? 'Private details visible' : 'Ghost mode on: names and messages are blurred', 'info'); }} aria-pressed={ghost} title="Ghost mode (hide private details for screen sharing)" className={`flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 text-[11px] transition ${ghost ? 'border-accent bg-accent/15 text-accent' : 'border-zinc-800 text-zinc-400 hover:text-zinc-100'}`}><Icon name={ghost ? 'lock' : 'eye'} size={14} /><span className="hidden lg:inline">{ghost ? 'Ghost on' : 'Ghost'}</span></button>
                  <button type="button" onClick={cycleTheme} title={`Theme: ${theme}`} aria-label={`Change colour theme (now ${theme})`} className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-zinc-800 hover:border-zinc-600"><span className="h-3.5 w-3.5 rounded-full bg-accent shadow-[0_0_10px] shadow-accent/50" /></button>
                  <span className="mx-1 hidden h-6 w-px bg-zinc-800 lg:block" />
                  <span className="hidden font-mono text-[10px] text-zinc-600 lg:inline" title="Time until you are signed out">{left} left</span>
                  <button type="button" onClick={signOut} title="Sign out" className="flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-800 px-2.5 text-[11px] text-zinc-400 transition hover:border-rose-500/50 hover:text-rose-300"><Icon name="lock" size={14} /><span className="hidden sm:inline">Sign out</span></button>
                </div>
              </header>
              <main id="admin-main" className="sb-slim min-h-0 flex-1 overflow-y-auto px-3 py-5 sm:px-6 sm:py-6" tabIndex={-1}><div className="mx-auto w-full max-w-6xl">{children}</div></main>
            </div>
          </div>
        )}
        {palette && state === 'in' && <Palette onClose={() => setPalette(false)} signOut={signOut} />}
      </div>
    </MeCtx.Provider>
  );
}

/* ------------------------------ command palette ------------------------------ */
function Palette({ onClose, signOut }: { onClose: () => void; signOut: () => Promise<void> }) {
  const router = useRouter();
  const toast = useToast();
  const { ghost, setGhost } = useGhost();
  const { cycleTheme } = useTheme();
  const [q, setQ] = useState('');
  const [i, setI] = useState(0);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  const items = useMemo(() => {
    const go = (href: string) => () => { const t = NAV.find((x) => x.href === href)?.tab; if (t && window.location.pathname === '/admin') goDeskTab(t); else router.push(href); };
    return [
      ...NAV.map((n) => ({ id: n.href, label: `Go to ${n.label}`, hint: n.hint, icon: n.icon, run: go(n.href), kw: n.label.toLowerCase() })),
      { id: 'ghost', label: ghost ? 'Turn ghost mode off' : 'Turn ghost mode on', hint: 'Blur names, emails and messages', icon: 'lock' as IconName, run: () => setGhost(!ghost), kw: 'privacy blur screen share' },
      { id: 'theme', label: 'Cycle colour theme', hint: 'cyan / amber / emerald', icon: 'spark' as IconName, run: cycleTheme, kw: 'colour color accent' },
      { id: 'banner', label: 'Write an announcement', hint: 'Opens Site settings', icon: 'bell' as IconName, run: go('/admin/site'), kw: 'announce banner notice' },
      { id: 'seo', label: 'Run the SEO audit', hint: 'Health → SEO', icon: 'search' as IconName, run: go('/admin/health'), kw: 'seo audit lighthouse' },
      { id: 'tfa', label: 'Set up two-factor sign-in', hint: 'Security', icon: 'shield' as IconName, run: go('/admin/security'), kw: '2fa totp authenticator' },
      { id: 'copy', label: 'Copy site address', hint: location.origin, icon: 'globe' as IconName, run: () => { void navigator.clipboard?.writeText(location.origin).then(() => toast('Copied')); }, kw: 'url link' },
      { id: 'site', label: 'Open the live site', hint: 'New tab', icon: 'arrow' as IconName, run: () => window.open('/', '_blank'), kw: 'public' },
      { id: 'out', label: 'Sign out', hint: 'End this session', icon: 'lock' as IconName, run: () => { void signOut(); }, kw: 'logout' },
    ];
  }, [router, ghost, setGhost, cycleTheme, signOut, toast]);
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    const score = (it: (typeof items)[number]) => { const hay = `${it.label} ${it.kw} ${it.hint}`.toLowerCase(); if (hay.includes(s)) return 2; let k = 0; for (const ch of s) { k = hay.indexOf(ch, k) + 1; if (!k) return 0; } return 1; };
    return items.map((it) => [it, score(it)] as const).filter(([, sc]) => sc > 0).sort((a, b) => b[1] - a[1]).map(([it]) => it);
  }, [q, items]);
  useEffect(() => setI(0), [q]);
  const run = (n: number) => { const it = shown[n]; if (!it) return; onClose(); it.run(); };
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-3 pt-[12vh] backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} role="dialog" aria-modal="true" aria-label="Command palette">
      <div className="g-pop w-full max-w-lg overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950 shadow-2xl">
        <div className="flex items-center gap-2 border-b border-zinc-800 px-3"><Icon name="search" size={15} className="text-zinc-500" />
          <input ref={ref} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type a page or action…" aria-label="Search commands" className="min-h-12 flex-1 bg-transparent font-mono text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
            onKeyDown={(e) => { if (e.key === 'ArrowDown') { e.preventDefault(); setI((n) => Math.min(shown.length - 1, n + 1)); } else if (e.key === 'ArrowUp') { e.preventDefault(); setI((n) => Math.max(0, n - 1)); } else if (e.key === 'Enter') { e.preventDefault(); run(i); } else if (e.key === 'Escape') onClose(); }} /></div>
        <ul className="max-h-[50vh] overflow-y-auto p-1.5" role="listbox">
          {shown.length === 0 && <li className="px-3 py-6 text-center font-mono text-xs text-zinc-600">Nothing matches “{q}”.</li>}
          {shown.map((it, n) => (
            <li key={it.id} role="option" aria-selected={n === i}><button type="button" onMouseEnter={() => setI(n)} onClick={() => run(n)} className={`flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-left ${n === i ? 'bg-accent/15 text-accent' : 'text-zinc-300'}`}><Icon name={it.icon} size={15} /><span className="flex-1 text-sm">{it.label}</span><span className="truncate font-mono text-[10px] text-zinc-500">{it.hint}</span></button></li>
          ))}
        </ul>
        <div className="flex justify-between border-t border-zinc-800 px-3 py-1.5 font-mono text-[10px] text-zinc-600"><span>↑↓ choose · Enter run · Esc close</span><span>tip: press g then a letter anywhere</span></div>
      </div>
    </div>
  );
}
