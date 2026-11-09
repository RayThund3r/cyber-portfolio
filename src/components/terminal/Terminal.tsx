// src/components/terminal/Terminal.tsx
//
// The interactive terminal on the home page. Rendering and side effects live here; what each command
// SAYS lives in lib/terminal/commands.ts (pure, tested). Features: scrollback, boot sequence, staggered
// output, Tab completion, command history (kept for this tab), Ctrl+L / Ctrl+C, a "did you mean", the
// hack / matrix effects, and a bridge so the chat assistant can run commands in it.
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { THEMES, Theme, useTheme } from '@/context/ThemeContext';
import { openChat } from '@/lib/chatBus';
import { safeSession } from '@/lib/safeStorage';
import { clearPendingTerminalCommand, takePendingTerminalCommand, TERMINAL_RUN_EVENT } from '@/lib/terminalBus';
import { complete, execute, TermEffect, TermLine } from '@/lib/terminal/commands';

interface Specs {
  os: string;
  resolution: string;
  cores: string;
  memory: string;
  platform: string;
}

type Row = TermLine & { id: number };

const MAX_ROWS = 220;
const HISTORY_KEY = 'sys_term_history';
const QUICK = ['help', 'ls projects', 'neofetch', 'repair', 'matrix', 'ask'];

const KIND_CLASS: Record<TermLine['kind'], string> = {
  out: 'text-zinc-300',
  ok: 'text-emerald-400',
  err: 'text-red-400',
  dim: 'text-zinc-500',
  accent: 'text-accent',
  cmd: 'text-zinc-100',
  head: 'font-semibold text-accent',
};

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export default function Terminal({ specs }: { specs: Specs }) {
  const router = useRouter();
  const { setTheme, cycleTheme, setColorMode, toggleColorMode } = useTheme();

  const idRef = useRef(0);
  const startedAt = useRef(0);
  const timers = useRef<number[]>([]);
  const history = useRef<string[]>([]);
  const historyIdx = useRef(-1);
  const tabState = useRef<{ base: string; i: number } | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const specsRef = useRef(specs);
  specsRef.current = specs;

  const [rows, setRows] = useState<Row[]>([]);
  const [input, setInput] = useState('');
  const [hacking, setHacking] = useState(false);
  const [matrix, setMatrix] = useState(false);
  const [big, setBig] = useState(false);
  const [busy, setBusy] = useState(false);

  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);

  const push = useCallback((lines: TermLine[], stagger = true) => {
    if (!lines.length) return;
    const make = (l: TermLine): Row => ({ ...l, id: ++idRef.current });
    if (!stagger || reduced() || lines.length === 1) {
      setRows((r) => [...r, ...lines.map(make)].slice(-MAX_ROWS));
      return;
    }
    const step = Math.min(28, Math.floor(700 / lines.length));
    setBusy(true);
    lines.forEach((l, i) =>
      later(() => {
        setRows((r) => [...r, make(l)].slice(-MAX_ROWS));
        if (i === lines.length - 1) setBusy(false);
      }, i * step)
    );
  }, [later]);

  /* ---------- effects requested by a command ---------- */
  const stopFx = useCallback(() => {
    setMatrix(false);
    setHacking(false);
  }, []);

  const runEffects = useCallback(
    (effects: TermEffect[] = []) => {
      for (const e of effects) {
        switch (e.type) {
          case 'navigate':
            later(() => router.push(e.path), reduced() ? 0 : 450);
            break;
          case 'chat':
            later(() => openChat(e.send ? { send: e.send } : {}), 250);
            break;
          case 'mode':
            if (e.mode) setColorMode(e.mode);
            else toggleColorMode();
            break;
          case 'theme':
            if (e.theme && (THEMES as string[]).includes(e.theme)) setTheme(e.theme as Theme);
            else cycleTheme();
            break;
          case 'clear':
            setRows([]);
            break;
          case 'scroll':
            window.scrollTo({ top: 0, behavior: 'smooth' });
            break;
          case 'hack':
            setHacking(true);
            later(() => push([{ kind: 'err', text: 'SCANNING CLIENT TELEMETRY... ACCESS GRANTED. YOU ARE IN.' }], false), 1500);
            later(() => {
              setHacking(false);
              push([{ kind: 'dim', text: '(just kidding. nothing was touched.)' }], false);
            }, 2600);
            break;
          case 'matrix':
            setMatrix(true);
            later(() => setMatrix(false), 9000);
            break;
        }
      }
    },
    [router, setTheme, cycleTheme, setColorMode, toggleColorMode, later, push]
  );

  /* ---------- run a line ---------- */
  const run = useCallback(
    (raw: string, echo = true) => {
      const line = raw.trim().slice(0, 80);
      if (!line) return;
      if (echo) push([{ kind: 'cmd', text: `guest@node:~# ${line}` }], false);
      if (history.current[0] !== line) history.current = [line, ...history.current].slice(0, 30);
      historyIdx.current = -1;
      safeSession.set(HISTORY_KEY, JSON.stringify(history.current));

      const res = execute(line, {
        specs: specsRef.current,
        history: history.current,
        uptimeMs: Date.now() - startedAt.current,
        themes: THEMES as string[],
      });
      push(res.lines);
      runEffects(res.effects);
    },
    [push, runEffects]
  );

  /* ---------- mount: history, boot lines, queued command from the chat ---------- */
  useEffect(() => {
    startedAt.current = Date.now();
    try {
      const saved = JSON.parse(safeSession.get(HISTORY_KEY) || '[]');
      if (Array.isArray(saved)) history.current = saved.filter((x) => typeof x === 'string').slice(0, 30);
    } catch {
      /* ignore */
    }
    const boot: TermLine[] = [
      { kind: 'dim', text: 'cyber-term v3.0  //  boot ok' },
      { kind: 'accent', text: 'SYS_READY.' },
      { kind: 'out', text: 'Type "help", or try: ls projects · neofetch · repair · matrix' },
    ];
    if (reduced()) push(boot, false);
    else boot.forEach((l, i) => later(() => push([l], false), 120 + i * 260));

    const queued = takePendingTerminalCommand();
    if (queued) later(() => run(queued), reduced() ? 0 : 1100);

    const onRun = (e: Event) => {
      const cmd = (e as CustomEvent<string>).detail;
      if (typeof cmd !== 'string' || !cmd) return;
      clearPendingTerminalCommand();
      run(cmd);
    };
    window.addEventListener(TERMINAL_RUN_EVENT, onRun);
    const pending = timers.current;
    return () => {
      window.removeEventListener(TERMINAL_RUN_EVENT, onRun);
      pending.forEach((t) => window.clearTimeout(t));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- keep the newest line in view (inside the log only) ---------- */
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [rows, big]);

  /* ---------- matrix rain ---------- */
  useEffect(() => {
    if (!matrix) return;
    const canvas = canvasRef.current;
    const host = logRef.current;
    if (!canvas || !host) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = (canvas.width = host.clientWidth);
    const h = (canvas.height = host.clientHeight);
    const size = 13;
    const cols = Math.ceil(w / size);
    const drops = Array.from({ length: cols }, () => Math.random() * -20);
    const chars = 'アイウエオカキクケコサシスセソ0123456789ABCDEF<>/{}';
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#22d3ee';
    const id = window.setInterval(() => {
      ctx.fillStyle = 'rgba(9,9,11,0.18)';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = accent;
      ctx.font = `${size}px monospace`;
      drops.forEach((y, i) => {
        ctx.fillText(chars[Math.floor(Math.random() * chars.length)], i * size, y * size);
        drops[i] = y * size > h && Math.random() > 0.96 ? 0 : y + 1;
      });
    }, 55);
    return () => window.clearInterval(id);
  }, [matrix]);

  /* ---------- keyboard ---------- */
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const st = tabState.current;
      const base = st ? st.base : input;
      const opts = complete(base);
      if (!opts.length) return;
      if (opts.length === 1) {
        setInput(opts[0].trimStart() + (opts[0].includes(' ') ? '' : ' '));
        tabState.current = null;
        return;
      }
      const i = st ? (st.i + 1) % opts.length : 0;
      tabState.current = { base, i };
      setInput(opts[i].trimStart());
      if (!st) push([{ kind: 'dim', text: opts.map((o) => o.trim()).join('   ') }], false);
      return;
    }
    tabState.current = null;

    if (e.key === 'ArrowUp' && history.current.length) {
      e.preventDefault();
      historyIdx.current = Math.min(historyIdx.current + 1, history.current.length - 1);
      setInput(history.current[historyIdx.current]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      historyIdx.current = Math.max(historyIdx.current - 1, -1);
      setInput(historyIdx.current === -1 ? '' : history.current[historyIdx.current]);
    } else if (e.ctrlKey && e.key.toLowerCase() === 'l') {
      e.preventDefault();
      setRows([]);
    } else if (e.ctrlKey && e.key.toLowerCase() === 'c') {
      e.preventDefault();
      stopFx();
      push([{ kind: 'dim', text: `guest@node:~# ${input}^C` }], false);
      setInput('');
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    run(input);
    setInput('');
  };

  const status = useMemo(() => (hacking ? 'BREACH_DETECTED' : matrix ? 'MATRIX' : 'ONLINE'), [hacking, matrix]);

  return (
    <div
      id="terminal"
      className={`rise scroll-mt-20 overflow-hidden rounded-xl border bg-zinc-900/40 font-mono shadow-2xl transition-all duration-500 hover:border-zinc-700 lg:col-span-5 ${
        hacking ? 'border-red-500/80 shadow-[0_0_30px_rgba(239,68,68,0.3)]' : 'border-accent/40'
      }`}
      style={{ '--d': '200ms' } as React.CSSProperties}
    >
      {/* title bar */}
      <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/70 px-3.5 py-2 text-[11px] text-zinc-500">
        <div className="flex items-center gap-2">
          <span className="flex gap-1" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
          </span>
          <span className="ml-1">INTERACTIVE_TERMINAL // v3.0</span>
        </div>
        <div className="flex items-center gap-3">
          <span className={hacking ? 'animate-ping text-red-400' : 'text-accent'}>{status}</span>
          <button
            type="button"
            onClick={() => setBig((b) => !b)}
            aria-label={big ? 'Shrink terminal' : 'Enlarge terminal'}
            aria-pressed={big}
            className="hidden cursor-pointer rounded px-1 text-zinc-500 transition-colors hover:text-accent sm:block"
          >
            {big ? '▭' : '▢'}
          </button>
        </div>
      </div>

      {/* output */}
      <div className="relative">
        <div
          ref={logRef}
          role="log"
          aria-live="polite"
          aria-relevant="additions"
          aria-label="Terminal output"
          tabIndex={0}
          onClick={() => {
            if (!window.getSelection()?.toString()) inputRef.current?.focus();
          }}
          className={`overflow-y-auto overscroll-contain bg-zinc-950 px-3.5 py-3 text-xs leading-relaxed transition-[height] duration-300 ${
            big ? 'h-[26rem]' : 'h-56 sm:h-64'
          } ${hacking ? 'text-red-400' : ''}`}
        >
          {rows.map((r) => (
            <div key={r.id} className={`animate-msg-in whitespace-pre-wrap break-words ${hacking && r.kind === 'out' ? 'text-red-400' : KIND_CLASS[r.kind]}`}>
              {r.text}
            </div>
          ))}
        </div>
        {matrix && (
          <canvas
            ref={canvasRef}
            onClick={stopFx}
            aria-hidden="true"
            className="absolute inset-0 h-full w-full cursor-pointer bg-zinc-950/90"
          />
        )}
      </div>

      {/* prompt */}
      <form onSubmit={onSubmit} className="flex items-center gap-2 border-t border-zinc-800 bg-zinc-950 px-3.5">
        <label htmlFor="terminal-input" className="shrink-0 text-xs text-accent">
          guest@node:~#
        </label>
        <input
          id="terminal-input"
          ref={inputRef}
          type="text"
          placeholder="type 'help'…  Tab completes"
          value={input}
          maxLength={80}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="send"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          className="min-h-11 w-full min-w-0 bg-transparent text-xs text-zinc-100 placeholder-zinc-600 caret-[var(--accent)] focus:outline-none"
        />
        <button
          type="submit"
         
          className="min-h-9 shrink-0 cursor-pointer rounded border border-accent/30 bg-accent/10 px-3 py-1 text-xs text-accent transition-all duration-200 hover:scale-105"
        >
          RUN
        </button>
      </form>

      {/* quick commands */}
      <div className="flex flex-wrap gap-1.5 border-t border-zinc-900 bg-zinc-950/60 px-3.5 py-2.5 text-[11px]">
        {QUICK.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => run(c)}
            className="cursor-pointer rounded border border-zinc-800 px-2 py-1 text-accent transition-colors hover:border-accent/50 hover:bg-accent/10"
          >
            {c}
          </button>
        ))}
      </div>
    </div>
  );
}
