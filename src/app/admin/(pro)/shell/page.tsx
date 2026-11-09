// src/app/admin/shell/page.tsx — a command line for the panel (stats, inbox, banner, backups…). History with ↑/↓, Tab completion.
'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/context/ThemeContext';
import { api } from '@/lib/admin/client';
import { runShell, suggest, COMMANDS, type Line } from '@/lib/admin/shell';
import { PageHead, useGhost } from '@/components/admin/ui';
import { useAdmin } from '@/components/admin/AdminShell';
import MatrixRain from '@/components/admin/MatrixRain';

const TONE: Record<Line['t'], string> = { out: 'text-zinc-200', dim: 'text-zinc-500', ok: 'text-emerald-300', err: 'text-rose-300', head: 'font-bold text-accent' };

export default function ShellPage() {
  const router = useRouter();
  const { cycleTheme } = useTheme();
  const { ghost, setGhost } = useGhost();
  const { signOut } = useAdmin();
  const [lines, setLines] = useState<Line[]>([{ t: 'head', s: 'SYS_ADMIN shell' }, { t: 'dim', s: 'Type "help" for commands. Tab completes, ↑/↓ recalls history.' }]);
  const [val, setVal] = useState('');
  const [busy, setBusy] = useState(false);
  const [rain, setRain] = useState(false);
  const hist = useRef<string[]>([]); const hi = useRef(-1);
  const endRef = useRef<HTMLDivElement>(null); const input = useRef<HTMLInputElement>(null);

  useEffect(() => { try { hist.current = JSON.parse(sessionStorage.getItem('sys_admin_hist') || '[]'); } catch { /* ignore */ } input.current?.focus(); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'nearest' }); }, [lines]);

  const deps = useMemo(() => ({
    get: <T,>(p: string) => api<T>(p), send: <T,>(p: string, m: string, b: unknown) => api<T>(p, { method: m, body: b }),
    go: (h: string) => router.push(h), toggleGhost: () => setGhost(!ghost), cycleTheme, signOut,
    download: (name: string, text: string) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); },
    now: () => Date.now(),
  }), [router, ghost, setGhost, cycleTheme, signOut]);

  const submit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = val.trim(); if (!cmd || busy) return;
    setVal(''); hi.current = -1; hist.current = [cmd, ...hist.current.filter((h) => h !== cmd)].slice(0, 50);
    try { sessionStorage.setItem('sys_admin_hist', JSON.stringify(hist.current)); } catch { /* ignore */ }
    setLines((l) => [...l, { t: 'dim', s: '$ ' + cmd }]); setBusy(true);
    const r = await runShell(cmd, deps);
    setBusy(false);
    setLines((l) => (r.clear ? [] : [...l, ...r.lines])); if (r.matrix) setRain(true);
    input.current?.focus();
  }, [val, busy, deps]);

  const onKey = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key === 'ArrowUp') { e.preventDefault(); if (hi.current < hist.current.length - 1) { hi.current++; setVal(hist.current[hi.current]); } }
    else if (e.key === 'ArrowDown') { e.preventDefault(); if (hi.current > 0) { hi.current--; setVal(hist.current[hi.current]); } else { hi.current = -1; setVal(''); } }
    else if (e.key === 'Tab') { e.preventDefault(); const m = suggest(val); if (m.length === 1) setVal(m[0] + ' '); else if (m.length > 1) setLines((l) => [...l, { t: 'dim', s: m.join('  ') }]); }
    else if (e.key === 'l' && e.ctrlKey) { e.preventDefault(); setLines([]); }
  };

  return (
    <>
      <PageHead title="Shell" sub="Do things faster than clicking: numbers, messages, the banner, backups." icon="cpu" />
      {rain && <MatrixRain onDone={() => setRain(false)} />}
      <div className="overflow-hidden rounded-xl border border-zinc-800 bg-black/60" onClick={() => input.current?.focus()}>
        <div className="flex items-center gap-1.5 border-b border-zinc-800 bg-zinc-900/60 px-3 py-2"><span className="h-2.5 w-2.5 rounded-full bg-rose-400/70" /><span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" /><span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" /><span className="ml-2 font-mono text-[11px] text-zinc-500">admin@sys ~</span></div>
        <div className="h-[55vh] min-h-72 overflow-y-auto p-3 font-mono text-xs leading-relaxed" role="log" aria-live="polite">
          {lines.map((l, i) => <div key={i} className={`whitespace-pre-wrap break-words ${TONE[l.t]}`}>{l.s || ' '}</div>)}
          {busy && <div className="animate-pulse text-zinc-500">…</div>}
          <div ref={endRef} />
        </div>
        <form onSubmit={submit} className="flex items-center gap-2 border-t border-zinc-800 px-3 py-2 font-mono text-xs"><span className="text-accent">$</span><input ref={input} value={val} onChange={(e) => setVal(e.target.value)} onKeyDown={onKey} aria-label="Command" autoCapitalize="off" autoCorrect="off" spellCheck={false} className="min-h-8 flex-1 bg-transparent text-zinc-100 outline-none placeholder:text-zinc-700" placeholder="stats 14" /></form>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">{COMMANDS.slice(1, 12).map((c) => <button key={c.name} type="button" onClick={() => setVal(c.name + (c.usage.includes('<') || c.usage.includes('[') ? ' ' : ''))} className="cursor-pointer rounded-full border border-zinc-700 px-2.5 py-1 font-mono text-[10px] text-zinc-400 hover:border-accent hover:text-accent">{c.name}</button>)}</div>
    </>
  );
}
