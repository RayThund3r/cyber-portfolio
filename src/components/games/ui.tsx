// src/components/games/ui.tsx — small shared pieces for every game: buttons, segmented selector, stat pills,
// result banner, a timer hook and the saved-records hook (localStorage, failure-proof).
'use client';

import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { trackGame } from '@/utils/analytics';
import { safeLocal } from '@/lib/safeStorage';
import Icon, { IconName } from '@/components/ui/Icon';

/* ------------------------------ records ------------------------------ */
export interface Record_ {
  w: number;
  l: number;
  d: number;
  /** Best score / streak / level (higher is better) */
  best?: number;
  /** Best time in seconds (lower is better) keyed by variant */
  times?: { [variant: string]: number };
}
const KEY = 'sys_games_v1';
type All = { [game: string]: Record_ };

export const readAll = (): All => safeLocal.getJSON<All>(KEY, {});

export function useRecord(game: string) {
  const [rec, setRec] = useState<Record_>({ w: 0, l: 0, d: 0 });
  useEffect(() => setRec(readAll()[game] || { w: 0, l: 0, d: 0 }), [game]);
  const update = useCallback(
    (fn: (r: Record_) => Record_) => {
      const all = readAll();
      const next = fn(all[game] || { w: 0, l: 0, d: 0 });
      all[game] = next;
      safeLocal.setJSON(KEY, all);
      setRec(next);
    },
    [game]
  );
  const win = useCallback(() => { trackGame(game, 'w'); update((r) => ({ ...r, w: r.w + 1 })); }, [update, game]);
  const loss = useCallback(() => { trackGame(game, 'l'); update((r) => ({ ...r, l: r.l + 1 })); }, [update, game]);
  const draw = useCallback(() => { trackGame(game, 'd'); update((r) => ({ ...r, d: r.d + 1 })); }, [update, game]);
  const best = useCallback((v: number) => update((r) => (v > (r.best ?? 0) ? { ...r, best: v } : r)), [update]);
  const time = useCallback(
    (variant: string, sec: number) => update((r) => ({ ...r, times: { ...(r.times || {}), [variant]: Math.min(sec, r.times?.[variant] ?? Infinity) } })),
    [update]
  );
  return { rec, win, loss, draw, best, time };
}

/* ------------------------------ timer ------------------------------ */
export function useStopwatch(running: boolean, reset: unknown = 0) {
  const [s, setS] = useState(0);
  useEffect(() => setS(0), [reset]);
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setS((x) => x + 1), 1000);
    return () => window.clearInterval(id);
  }, [running]);
  return s;
}
export const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/* ------------------------------ ui bits ------------------------------ */
export function Btn({
  children,
  onClick,
  icon,
  variant = 'ghost',
  disabled,
  active,
  title,
  className = '',
}: {
  children?: ReactNode;
  onClick?: () => void;
  icon?: IconName;
  variant?: 'ghost' | 'solid';
  disabled?: boolean;
  active?: boolean;
  title?: string;
  className?: string;
}) {
  const base =
    'inline-flex min-h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-3 font-mono text-[11px] transition duration-150 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-accent';
  const look =
    variant === 'solid'
      ? 'bg-accent-strong font-bold text-zinc-950 hover:opacity-90'
      : `border ${active ? 'border-accent bg-accent/15 text-accent' : 'border-zinc-700 text-zinc-300 hover:border-accent/50 hover:text-accent'}`;
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title} aria-label={title} aria-pressed={active} className={`${base} ${look} ${className}`}>
      {icon && <Icon name={icon} size={14} />}
      {children}
    </button>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  disabled,
}: {
  value: T;
  options: ReadonlyArray<{ id: T; label: string }>;
  onChange: (v: T) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex overflow-hidden rounded-lg border border-zinc-700 font-mono text-[11px]">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          disabled={disabled}
          onClick={() => onChange(o.id)}
          className={`min-h-9 cursor-pointer px-3 transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
            value === o.id ? 'bg-accent/20 text-accent' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Pill({ label, value, tone = 'default' }: { label: string; value: ReactNode; tone?: 'default' | 'accent' | 'warn' }) {
  return (
    <div className={`rounded-lg border px-3 py-1.5 text-center ${tone === 'accent' ? 'border-accent/40 bg-accent/10' : tone === 'warn' ? 'border-amber-500/40 bg-amber-500/10' : 'border-zinc-800 bg-zinc-900/60'}`}>
      <div className="font-mono text-[9px] uppercase tracking-wider text-zinc-500">{label}</div>
      <div className={`font-mono text-sm font-bold tabular-nums ${tone === 'accent' ? 'text-accent' : tone === 'warn' ? 'text-amber-300' : 'text-zinc-100'}`}>{value}</div>
    </div>
  );
}

export function Banner({ tone, title, text, action }: { tone: 'win' | 'lose' | 'draw' | 'info'; title: string; text?: string; action?: ReactNode }) {
  const c = tone === 'win' ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300' : tone === 'lose' ? 'border-red-500/50 bg-red-500/10 text-red-300' : tone === 'draw' ? 'border-amber-500/50 bg-amber-500/10 text-amber-300' : 'border-accent/40 bg-accent/10 text-accent';
  return (
    <div role="status" aria-live="polite" className={`g-pop flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 ${c}`}>
      <div>
        <p className="font-mono text-sm font-bold">{title}</p>
        {text && <p className="mt-0.5 text-xs opacity-80">{text}</p>}
      </div>
      {action}
    </div>
  );
}

export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-zinc-800 bg-zinc-900/40 p-3 sm:p-5 ${className}`}>{children}</div>;
}

export function Record({ rec }: { rec: Record_ }) {
  return (
    <p className="font-mono text-[11px] text-zinc-500">
      Record: <span className="text-emerald-400">{rec.w}W</span> · <span className="text-red-400">{rec.l}L</span> · <span className="text-amber-300">{rec.d}D</span>
    </p>
  );
}

/** Runs `fn` on the next frame(s) after paint, so "thinking…" can render before heavy AI work blocks the thread. */
export function useDefer() {
  const t = useRef<number | null>(null);
  useEffect(() => () => { if (t.current) window.clearTimeout(t.current); }, []);
  return useCallback((fn: () => void, ms = 60) => {
    if (t.current) window.clearTimeout(t.current);
    t.current = window.setTimeout(fn, ms);
  }, []);
}
