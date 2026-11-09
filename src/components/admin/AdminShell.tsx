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
import MatrixRain from './MatrixRain';

export interface Me { ok: boolean; sid: string; exp: number; store: 'upstash' | 'file' | 'memory'; totp: boolean }
const MeCtx = createContext<{ me: Me | null; signOut: () => Promise<void>; openPalette: () => void }>({ me: null, signOut: async () => undefined, openPalette: () => undefined });
export const useAdmin = () => useContext(MeCtx);

export const NAV: Array<{ href: string; label: string; icon: IconName; key: string; hint: string }> = [
  { href: '/admin', label: 'Desk', icon: 'home', key: 'd', hint: 'Requests, bookings, portfolio, builder, studio' },
  { href: '/admin/overview', label: 'Overview', icon: 'spark', key: 'o', hint: 'The big picture' },
  { href: '/admin/analytics', label: 'Analytics', icon: 'grid', key: 'a', hint: 'Traffic, pages, devices' },
  { href: '/admin/chat', label: 'Chat Lab', icon: 'brain', key: 'c', hint: 'Questions, gaps, playground' },
  { href: '/admin/site', label: 'Site', icon: 'wrench', key: 's', hint: 'Banner, availability, content' },
  { href: '/admin/health', label: 'Health', icon: 'bolt', key: 'h', hint: 'Env, SEO audit, uptime' },
  { href: '/admin/security', label: 'Security', icon: 'shield', key: 'e', hint: 'Sessions, 2FA, audit' },
  { href: '/admin/board', label: 'Board', icon: 'puzzle', key: 'b', hint: 'Your to-do kanban' },
  { href: '/admin/shell', label: 'Shell', icon: 'cpu', key: 't', hint: 'Command-line for the panel' },
  { href: '/admin/lab', label: 'Lab', icon: 'spark', key: 'l', hint: 'Pulse, digest, link builder' },
];

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

  useEffect(() => { document.documentElement.dataset.admin = '1'; return () => { delete document.documentElement.dataset.admin; }; }, []);

  const check = useCallback(async () => {
    try { const m = await api<Me>('/api/admin/me'); setMe(m); setState('in'); }
    catch (e) { setMe(null); setState('out'); if (e instanceof ApiError && e.status !== 401 && e.status !== 503) toast(e.message, 'err'); }
  }, [toast]);
  useEffect(() => { void check(); }, [check]);
  useEffect(() => { const f = () => { setMe(null); setState('out'); }; window.addEventListener('admin:signed-out', f); return () => window.removeEventListener('admin:signed-out', f); }, []);
  useEffect(() => { if (state === 'out') window.location.assign('/admin'); }, [state]);
  useEffect(() => { setNavOpen(false); }, [path]);

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
      if (Date.now() - gAt.current < 1200) { const n = NAV.find((x) => x.key === e.key.toLowerCase()); gAt.current = 0; if (n) { router.push(n.href); return; } }
      if (e.key === 'g') gAt.current = Date.now();
      if (e.key === '/') { e.preventDefault(); setPalette(true); }
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, [router, toast]);

  const ctx = useMemo(() => ({ me, signOut, openPalette: () => setPalette(true) }), [me, signOut]);

  return (
    <MeCtx.Provider value={ctx}>
      <div className="fixed inset-0 z-[1000] overflow-hidden bg-zinc-950 text-zinc-100" data-admin-root>
        {matrix && <MatrixRain onDone={() => setMatrix(false)} />}
        {state !== 'in' ? (
          <div className="flex h-full items-center justify-center font-mono text-xs text-zinc-500"><span className="animate-pulse">AUTHENTICATING…</span></div>
        ) : (
          <div className="flex h-full">
            {navOpen && <button aria-label="Close menu" className="fixed inset-0 z-10 bg-black/60 md:hidden" onClick={() => setNavOpen(false)} />}
            <aside className={`fixed inset-y-0 left-0 z-20 flex w-60 flex-col border-r border-zinc-800 bg-zinc-950 transition-transform md:static md:translate-x-0 ${navOpen ? 'translate-x-0' : '-translate-x-full'}`} aria-label="Admin navigation">
              <div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-4"><span className="h-2 w-2 animate-pulse rounded-full bg-accent shadow-[0_0_10px] shadow-accent" /><span className="font-mono text-sm font-bold tracking-wider text-accent">SYS_ADMIN</span></div>
              <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
                {NAV.map((n) => {
                  const active = n.href === '/admin' ? path === '/admin' : path === n.href || path.startsWith(n.href + '/');
                  return (
                    <Link key={n.href} href={n.href} aria-current={active ? 'page' : undefined} className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${active ? 'bg-accent/15 text-accent' : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100'}`}>
                      <Icon name={n.icon} size={16} /><span className="flex-1">{n.label}</span><kbd className="hidden font-mono text-[9px] uppercase text-zinc-600 group-hover:text-zinc-400 lg:inline">g {n.key}</kbd>
                    </Link>
                  );
                })}
              </nav>
              <div className="space-y-2 border-t border-zinc-800 p-3">
                <div className={`flex items-center justify-between rounded-lg border px-2.5 py-1.5 font-mono text-[10px] ${me?.store !== 'memory' ? 'border-emerald-500/30 text-emerald-300' : 'border-amber-500/40 text-amber-300'}`}>
                  <span>{me?.store === 'memory' ? 'TEMPORARY STORAGE' : 'PERMANENT STORAGE'}</span><Link href="/admin/health" className="underline decoration-dotted">{me?.store !== 'memory' ? 'ok' : 'why?'}</Link>
                </div>
                <Link href="/" target="_blank" className="flex items-center gap-2 rounded-lg px-2 py-1.5 font-mono text-[11px] text-zinc-400 hover:text-accent"><Icon name="globe" size={14} />View live site</Link>
              </div>
            </aside>
            <div className="flex min-w-0 flex-1 flex-col">
              <header className="flex items-center gap-2 border-b border-zinc-800 bg-zinc-950/90 px-3 py-2 backdrop-blur sm:px-5">
                <button type="button" className="mr-1 cursor-pointer rounded-lg border border-zinc-700 p-2 text-zinc-300 md:hidden" aria-label="Open menu" onClick={() => setNavOpen(true)}><Icon name="grid" size={16} /></button>
                <button type="button" onClick={() => setPalette(true)} className="flex min-h-9 flex-1 cursor-pointer items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 text-left font-mono text-xs text-zinc-500 transition hover:border-accent/40 sm:max-w-sm"><Icon name="search" size={14} />Jump to anything…<kbd className="ml-auto hidden rounded border border-zinc-700 px-1 text-[9px] sm:inline">Ctrl K</kbd></button>
                <div className="ml-auto flex items-center gap-1.5">
                  <button type="button" onClick={() => { setGhost(!ghost); toast(ghost ? 'Private details visible' : 'Ghost mode on: names and messages are blurred', 'info'); }} aria-pressed={ghost} title="Ghost mode (hide private details for screen sharing)" className={`flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 font-mono text-[11px] transition ${ghost ? 'border-accent bg-accent/15 text-accent' : 'border-zinc-700 text-zinc-400 hover:text-zinc-100'}`}><Icon name={ghost ? 'lock' : 'key'} size={14} /><span className="hidden sm:inline">{ghost ? 'GHOST' : 'ghost'}</span></button>
                  <button type="button" onClick={cycleTheme} title={`Theme: ${theme}`} aria-label={`Change colour theme (now ${theme})`} className="flex min-h-9 min-w-9 cursor-pointer items-center justify-center rounded-lg border border-zinc-700 text-zinc-400 hover:text-accent"><span className="h-3 w-3 rounded-full bg-accent" /></button>
                  <span className="hidden font-mono text-[10px] text-zinc-600 lg:inline" title="Time until you are signed out">session {left}</span>
                  <button type="button" onClick={signOut} className="flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-700 px-2.5 font-mono text-[11px] text-zinc-400 hover:border-rose-500/50 hover:text-rose-300"><Icon name="lock" size={14} /><span className="hidden sm:inline">Sign out</span></button>
                </div>
              </header>
              <main id="admin-main" className="min-h-0 flex-1 overflow-y-auto px-3 py-5 sm:px-6" tabIndex={-1}><div className="mx-auto w-full max-w-6xl">{children}</div></main>
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
    const go = (href: string) => () => { router.push(href); };
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
