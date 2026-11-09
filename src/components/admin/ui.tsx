// src/components/admin/ui.tsx — the admin panel's small design kit: toasts, cards, charts, privacy ("ghost") mode.
'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Icon, { type IconName } from '@/components/ui/Icon';
import { fmtNum } from '@/lib/admin/client';

/* ------------------------------ toasts ------------------------------ */
type Tone = 'ok' | 'err' | 'info';
interface ToastItem { id: number; text: string; tone: Tone }
const ToastCtx = createContext<(text: string, tone?: Tone) => void>(() => undefined);
export const useToast = () => useContext(ToastCtx);

/* ------------------------------ ghost mode (hide private data for screen sharing) ------------------------------ */
const GhostCtx = createContext<{ ghost: boolean; setGhost: (v: boolean) => void }>({ ghost: false, setGhost: () => undefined });
export const useGhost = () => useContext(GhostCtx);
/** Wrap anything personal (names, emails, message text). Blurred while ghost mode is on. */
export function Priv({ children, className = '' }: { children: ReactNode; className?: string }) {
  const { ghost } = useGhost();
  return <span className={`${ghost ? 'select-none blur-[5px] transition' : 'transition'} ${className}`} aria-hidden={ghost || undefined}>{children}</span>;
}

export function AdminProviders({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const [ghost, setGhostState] = useState(false);
  const n = useRef(0);
  const push = useCallback((text: string, tone: Tone = 'ok') => {
    const id = ++n.current;
    setItems((a) => [...a.slice(-3), { id, text, tone }]);
    window.setTimeout(() => setItems((a) => a.filter((t) => t.id !== id)), tone === 'err' ? 6000 : 3200);
  }, []);
  useEffect(() => { try { setGhostState(localStorage.getItem('sys_admin_ghost') === '1'); } catch { /* ignore */ } }, []);
  const setGhost = useCallback((v: boolean) => { setGhostState(v); try { localStorage.setItem('sys_admin_ghost', v ? '1' : '0'); } catch { /* ignore */ } }, []);
  const gv = useMemo(() => ({ ghost, setGhost }), [ghost, setGhost]);
  return (
    <ToastCtx.Provider value={push}>
      <GhostCtx.Provider value={gv}>
        {children}
        <div className="pointer-events-none fixed bottom-4 left-1/2 z-[1100] flex w-[min(92vw,26rem)] -translate-x-1/2 flex-col gap-2" role="status" aria-live="polite">
          {items.map((t) => (
            <div key={t.id} className={`g-pop pointer-events-auto flex items-center gap-2 rounded-lg border px-3 py-2 font-mono text-xs shadow-xl backdrop-blur ${t.tone === 'err' ? 'border-red-500/50 bg-red-950/80 text-red-200' : t.tone === 'info' ? 'border-zinc-600 bg-zinc-900/90 text-zinc-200' : 'border-accent/50 bg-zinc-900/90 text-accent'}`}>
              <Icon name={t.tone === 'err' ? 'bell' : 'check'} size={14} /> {t.text}
            </div>
          ))}
        </div>
      </GhostCtx.Provider>
    </ToastCtx.Provider>
  );
}

/* ------------------------------ building blocks ------------------------------ */
export function Card({ title, icon, right, children, className = '', pad = true }: { title?: string; icon?: IconName; right?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={`rounded-xl border border-zinc-800 bg-zinc-900/50 ${className}`}>
      {(title || right) && (
        <header className="flex items-center justify-between gap-3 border-b border-zinc-800/80 px-4 py-2.5">
          <h2 className="flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-wider text-zinc-300">{icon && <Icon name={icon} size={14} className="text-accent" />}{title}</h2>
          {right}
        </header>
      )}
      <div className={pad ? 'p-4' : ''}>{children}</div>
    </section>
  );
}

export function Delta({ value }: { value: number | null }) {
  if (value === null) return <span className="font-mono text-[10px] text-zinc-600">new</span>;
  const up = value >= 0;
  return <span className={`font-mono text-[10px] ${value === 0 ? 'text-zinc-500' : up ? 'text-emerald-400' : 'text-rose-400'}`}>{value === 0 ? '±0%' : `${up ? '+' : ''}${value}%`}</span>;
}
export function Stat({ label, value, delta, icon, hint, spark }: { label: string; value: ReactNode; delta?: number | null; icon: IconName; hint?: string; spark?: number[] }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="flex items-center justify-between"><span className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">{label}</span><Icon name={icon} size={14} className="text-accent/70" /></div>
      <div className="mt-1 flex items-end gap-2"><span className="font-mono text-2xl font-bold tabular-nums text-zinc-100">{value}</span>{delta !== undefined && <Delta value={delta} />}</div>
      {hint && <div className="mt-0.5 text-[11px] text-zinc-500">{hint}</div>}
      {spark && spark.length > 1 && <div className="pointer-events-none absolute inset-x-0 bottom-0 opacity-60"><Spark data={spark} h={26} /></div>}
    </div>
  );
}

export function AButton({ children, onClick, icon, variant = 'ghost', disabled, small, danger, className = '', type = 'button', title }: { children?: ReactNode; onClick?: () => void; icon?: IconName; variant?: 'ghost' | 'solid'; disabled?: boolean; small?: boolean; danger?: boolean; className?: string; type?: 'button' | 'submit'; title?: string }) {
  const base = `inline-flex ${small ? 'min-h-8 px-2.5' : 'min-h-9 px-3.5'} cursor-pointer items-center justify-center gap-1.5 rounded-lg font-mono text-[11px] transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-accent`;
  const look = variant === 'solid' ? 'bg-accent-strong font-bold text-zinc-950 hover:opacity-90' : danger ? 'border border-rose-500/40 text-rose-300 hover:bg-rose-500/10' : 'border border-zinc-700 text-zinc-300 hover:border-accent/50 hover:text-accent';
  return <button type={type} onClick={onClick} disabled={disabled} title={title} aria-label={title} className={`${base} ${look} ${className}`}>{icon && <Icon name={icon} size={14} />}{children}</button>;
}

export function Badge({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'ok' | 'warn' | 'bad' | 'accent' }) {
  const t = { default: 'border-zinc-700 text-zinc-400', ok: 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10', warn: 'border-amber-500/40 text-amber-300 bg-amber-500/10', bad: 'border-rose-500/40 text-rose-300 bg-rose-500/10', accent: 'border-accent/40 text-accent bg-accent/10' }[tone];
  return <span className={`inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide ${t}`}>{children}</span>;
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2.5">
      <span><span className="block text-sm text-zinc-200">{label}</span>{hint && <span className="block text-[11px] text-zinc-500">{hint}</span>}</span>
      <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className={`relative h-6 w-11 shrink-0 rounded-full border transition ${checked ? 'border-accent bg-accent/30' : 'border-zinc-600 bg-zinc-800'}`}>
        <span className={`absolute top-0.5 rounded-full transition-all ${checked ? 'bg-accent' : 'bg-zinc-400'}`} style={{ width: 18, height: 18, left: checked ? 22 : 2 }} />
      </button>
    </label>
  );
}

export const inputCls = 'min-h-10 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 font-mono text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-accent';
export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <label className="block"><span className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-zinc-500">{label}</span>{children}{hint && <span className="mt-1 block text-[11px] text-zinc-600">{hint}</span>}</label>;
}

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: Array<{ id: T; label: string; badge?: number }> }) {
  return (
    <div role="tablist" className="inline-flex max-w-full overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-900/60 p-0.5 font-mono text-[11px]">
      {items.map((t) => (
        <button key={t.id} role="tab" aria-selected={value === t.id} type="button" onClick={() => onChange(t.id)} className={`flex min-h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-3 transition ${value === t.id ? 'bg-accent/20 text-accent' : 'text-zinc-400 hover:text-zinc-100'}`}>
          {t.label}{!!t.badge && <span className="rounded bg-accent/20 px-1 text-[9px] text-accent">{t.badge}</span>}
        </button>
      ))}
    </div>
  );
}

export function PageHead({ title, sub, right, icon }: { title: string; sub?: string; right?: ReactNode; icon?: IconName }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="flex items-center gap-2 text-xl font-extrabold tracking-tight text-zinc-100 sm:text-2xl">{icon && <Icon name={icon} size={20} className="text-accent" />}{title}</h1>{sub && <p className="mt-0.5 text-sm text-zinc-500">{sub}</p>}</div>
      {right}
    </div>
  );
}
export function Empty({ icon = 'search', title, text }: { icon?: IconName; title: string; text?: string }) {
  return <div className="flex flex-col items-center gap-2 px-4 py-10 text-center"><Icon name={icon} size={26} className="text-zinc-600" /><div className="text-sm font-semibold text-zinc-300">{title}</div>{text && <p className="max-w-sm text-xs text-zinc-500">{text}</p>}</div>;
}
export const Skel = ({ h = 'h-24' }: { h?: string }) => <div className={`${h} animate-pulse rounded-xl bg-zinc-900/70`} aria-hidden />;
export function ErrorBox({ text, retry }: { text: string; retry?: () => void }) {
  return <div className="flex items-center justify-between gap-3 rounded-xl border border-rose-500/40 bg-rose-950/30 p-4 text-sm text-rose-200"><span>{text}</span>{retry && <AButton small onClick={retry} icon="refresh">Retry</AButton>}</div>;
}
export function CopyBtn({ text, label = 'Copy', small = true }: { text: string; label?: string; small?: boolean }) {
  const toast = useToast();
  return <AButton small={small} icon="check" onClick={async () => { try { await navigator.clipboard.writeText(text); toast('Copied'); } catch { toast('Copy failed: select the text manually', 'err'); } }}>{label}</AButton>;
}
export function Notice({ tone = 'info', title, children }: { tone?: 'info' | 'warn'; title: string; children?: ReactNode }) {
  return <div className={`rounded-xl border p-3 text-sm ${tone === 'warn' ? 'border-amber-500/40 bg-amber-500/5 text-amber-100' : 'border-accent/30 bg-accent/5 text-zinc-200'}`}><div className="flex items-center gap-2 font-semibold"><Icon name={tone === 'warn' ? 'bell' : 'lightbulb'} size={14} className={tone === 'warn' ? 'text-amber-300' : 'text-accent'} />{title}</div>{children && <div className="mt-1 text-xs leading-relaxed text-zinc-400">{children}</div>}</div>;
}

/* ------------------------------ charts (plain SVG) ------------------------------ */
export function Spark({ data, h = 32, className = '' }: { data: number[]; h?: number; className?: string }) {
  const w = 120, max = Math.max(1, ...data), step = w / Math.max(1, data.length - 1);
  const pts = data.map((v, i) => `${(i * step).toFixed(1)},${(h - 2 - (v / max) * (h - 4)).toFixed(1)}`);
  return <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={`block w-full ${className}`} style={{ height: h }} aria-hidden><polyline points={`0,${h} ${pts.join(' ')} ${w},${h}`} fill="rgb(var(--accent-rgb) / 0.15)" stroke="none" /><polyline points={pts.join(' ')} fill="none" stroke="var(--accent)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" /></svg>;
}

export function AreaChart({ labels, a, b, aName, bName, height = 180 }: { labels: string[]; a: number[]; b?: number[]; aName: string; bName?: string; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640, H = height, pad = { l: 34, r: 8, t: 8, b: 20 };
  const max = Math.max(1, ...a, ...(b || []));
  const nice = Math.max(1, Math.ceil(max / 4) * 4);
  const x = (i: number) => pad.l + (a.length <= 1 ? 0 : (i / (a.length - 1)) * (W - pad.l - pad.r));
  const y = (v: number) => pad.t + (1 - v / nice) * (H - pad.t - pad.b);
  const line = (d: number[]) => d.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = (d: number[]) => `${line(d)} L${x(d.length - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`;
  const i = hover ?? a.length - 1;
  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] text-zinc-400" aria-live="polite">
        <span className="text-zinc-500">{labels[i]}</span>
        <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-accent" />{aName} <b className="text-zinc-100">{fmtNum(a[i] ?? 0)}</b></span>
        {b && <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-400" />{bName} <b className="text-zinc-100">{fmtNum(b[i] ?? 0)}</b></span>}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full touch-none" style={{ height }} role="img" aria-label={`${aName} over time`}
        onPointerMove={(e) => { const r = (e.currentTarget as unknown as Element).getBoundingClientRect(); const px = ((e.clientX - r.left) / r.width) * W; setHover(Math.max(0, Math.min(a.length - 1, Math.round(((px - pad.l) / (W - pad.l - pad.r)) * (a.length - 1))))); }}
        onPointerLeave={() => setHover(null)}>
        {[0, 1, 2, 3, 4].map((g) => { const v = (nice / 4) * g; return <g key={g}><line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="#27272a" strokeWidth="1" /><text x={pad.l - 5} y={y(v) + 3} textAnchor="end" fontSize="9" fill="#71717a" fontFamily="monospace">{fmtNum(Math.round(v))}</text></g>; })}
        {b && <><path d={area(b)} fill="rgb(251 191 36 / 0.10)" /><path d={line(b)} fill="none" stroke="#fbbf24" strokeWidth="1.6" strokeLinejoin="round" /></>}
        <path d={area(a)} fill="rgb(var(--accent-rgb) / 0.16)" /><path d={line(a)} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" />
        {labels.map((l, k) => (k % Math.ceil(labels.length / 7) === 0 ? <text key={k} x={x(k)} y={H - 5} textAnchor="middle" fontSize="9" fill="#71717a" fontFamily="monospace">{l.slice(5)}</text> : null))}
        <line x1={x(i)} x2={x(i)} y1={pad.t} y2={H - pad.b} stroke="var(--accent)" strokeOpacity="0.4" strokeDasharray="3 3" />
        <circle cx={x(i)} cy={y(a[i] ?? 0)} r="3.5" fill="var(--accent)" />
      </svg>
    </div>
  );
}

export function Bars({ items, empty = 'No data yet', unit = '', ghostNames = false }: { items: Array<{ name: string; n: number }>; empty?: string; unit?: string; ghostNames?: boolean }) {
  const max = Math.max(1, ...items.map((i) => i.n)); const total = items.reduce((a, i) => a + i.n, 0) || 1;
  if (!items.length) return <p className="py-6 text-center text-xs text-zinc-600">{empty}</p>;
  return (
    <ul className="space-y-1.5">
      {items.map((it) => (
        <li key={it.name} className="relative overflow-hidden rounded-md">
          <div className="absolute inset-y-0 left-0 rounded-md bg-accent/15" style={{ width: `${(it.n / max) * 100}%` }} />
          <div className="relative flex items-center justify-between gap-3 px-2 py-1 font-mono text-xs"><span className="truncate text-zinc-200">{ghostNames ? <Priv>{it.name}</Priv> : it.name}</span><span className="shrink-0 tabular-nums text-zinc-400">{fmtNum(it.n)}{unit} <span className="text-zinc-600">· {Math.round((it.n / total) * 100)}%</span></span></div>
        </li>
      ))}
    </ul>
  );
}

const DONUT = ['var(--accent)', '#fbbf24', '#a78bfa', '#fb7185', '#34d399', '#60a5fa'];
export function Donut({ items, size = 120, label }: { items: Array<{ name: string; n: number }>; size?: number; label?: string }) {
  const total = items.reduce((a, i) => a + i.n, 0);
  const r = 40, c = 2 * Math.PI * r; let off = 0;
  if (!total) return <p className="py-6 text-center text-xs text-zinc-600">No data yet</p>;
  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={label || 'Breakdown'} className="shrink-0 -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#27272a" strokeWidth="14" />
        {items.slice(0, 6).map((it, i) => { const len = (it.n / total) * c; const el = <circle key={it.name} cx="50" cy="50" r={r} fill="none" stroke={DONUT[i]} strokeWidth="14" strokeDasharray={`${Math.max(0, len - 1)} ${c - len + 1}`} strokeDashoffset={-off} />; off += len; return el; })}
      </svg>
      <ul className="space-y-1 font-mono text-[11px]">{items.slice(0, 6).map((it, i) => <li key={it.name} className="flex items-center gap-2 text-zinc-300"><span className="h-2 w-2 rounded-full" style={{ background: DONUT[i] }} />{it.name}<span className="text-zinc-500">{Math.round((it.n / total) * 100)}%</span></li>)}</ul>
    </div>
  );
}

export function HourBars({ hours }: { hours: number[] }) {
  const max = Math.max(1, ...hours);
  return (
    <div>
      <div className="flex h-24 items-end gap-[3px]" role="img" aria-label="Page views by hour of day (UTC)">
        {hours.map((v, h) => <div key={h} title={`${String(h).padStart(2, '0')}:00 UTC · ${v}`} className="flex-1 rounded-t bg-accent/70 transition-all hover:bg-accent" style={{ height: `${Math.max(3, (v / max) * 100)}%`, opacity: v ? 1 : 0.2 }} />)}
      </div>
      <div className="mt-1 flex justify-between font-mono text-[9px] text-zinc-600"><span>00</span><span>06</span><span>12</span><span>18</span><span>23 UTC</span></div>
    </div>
  );
}
