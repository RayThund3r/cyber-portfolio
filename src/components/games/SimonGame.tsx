// src/components/games/SimonGame.tsx — pattern memory. Watch the sequence, repeat it. Tones via WebAudio (mutable).
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Banner, Btn, Panel, Pill, Segmented, useRecord } from './ui';

const PADS = [
  { id: 0, on: 'bg-emerald-400', off: 'bg-emerald-800', freq: 261.6, key: 'q', name: 'green' },
  { id: 1, on: 'bg-rose-400', off: 'bg-rose-900', freq: 329.6, key: 'w', name: 'red' },
  { id: 2, on: 'bg-amber-300', off: 'bg-amber-700', freq: 392, key: 'a', name: 'yellow' },
  { id: 3, on: 'bg-sky-400', off: 'bg-sky-900', freq: 523.3, key: 's', name: 'blue' },
];
type Speed = 'chill' | 'normal' | 'fast';
const BASE: Record<Speed, number> = { chill: 750, normal: 520, fast: 340 };

export default function SimonGame() {
  const { rec, best } = useRecord('simon');
  const [seq, setSeq] = useState<number[]>([]);
  const [phase, setPhase] = useState<'idle' | 'show' | 'input' | 'over'>('idle');
  const [lit, setLit] = useState(-1);
  const [pos, setPos] = useState(0);
  const [speed, setSpeed] = useState<Speed>('normal');
  const [strict, setStrict] = useState(true);
  const [muted, setMuted] = useState(false);
  const timers = useRef<number[]>([]);
  const audio = useRef<AudioContext | null>(null);

  const tone = useCallback((freq: number, ms: number) => {
    if (muted) return;
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audio.current = audio.current || new Ctx();
      const a = audio.current, o = a.createOscillator(), g = a.createGain();
      o.type = 'sine'; o.frequency.value = freq; g.gain.value = 0.08;
      o.connect(g); g.connect(a.destination); o.start();
      g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + ms / 1000);
      o.stop(a.currentTime + ms / 1000 + 0.02);
    } catch { /* audio is optional */ }
  }, [muted]);

  const clear = () => { timers.current.forEach((t) => window.clearTimeout(t)); timers.current = []; };
  useEffect(() => clear, []);

  const flash = useCallback((id: number, ms: number) => { setLit(id); tone(PADS[id].freq, ms); timers.current.push(window.setTimeout(() => setLit(-1), ms)); }, [tone]);

  const play = useCallback((s: number[]) => {
    clear(); setPhase('show'); setPos(0);
    const step = Math.max(180, BASE[speed] - s.length * 14);
    s.forEach((id, i) => timers.current.push(window.setTimeout(() => flash(id, step * 0.7), 600 + i * step)));
    timers.current.push(window.setTimeout(() => setPhase('input'), 600 + s.length * step));
  }, [speed, flash]);

  const start = () => { const s = [Math.floor(Math.random() * 4)]; setSeq(s); play(s); };

  const press = useCallback((id: number) => {
    if (phase !== 'input') return;
    flash(id, 220);
    if (id !== seq[pos]) {
      if (!strict) { play(seq); return; }
      tone(110, 500); setPhase('over'); best(seq.length - 1); return;
    }
    if (pos + 1 === seq.length) {
      const s = [...seq, Math.floor(Math.random() * 4)];
      setSeq(s); setPhase('show');
      timers.current.push(window.setTimeout(() => play(s), 500));
    } else setPos(pos + 1);
  }, [phase, seq, pos, strict, flash, play, tone, best]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { const t = e.target as HTMLElement; if (/INPUT|TEXTAREA/.test(t?.tagName || '')) return; const p = PADS.find((x) => x.key === e.key.toLowerCase()); if (p) press(p.id); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [press]);

  const level = phase === 'over' ? seq.length - 1 : seq.length;
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,26rem)_1fr]">
      <div className="space-y-3">
        <div className="mx-auto grid aspect-square w-full max-w-sm grid-cols-2 gap-3 rounded-full" role="group" aria-label="Simon pads">
          {PADS.map((p) => (
            <button key={p.id} type="button" onClick={() => press(p.id)} disabled={phase !== 'input'} aria-label={`${p.name} pad (key ${p.key})`}
              className={`cursor-pointer rounded-3xl transition duration-100 disabled:cursor-default ${lit === p.id ? `${p.on} scale-[1.03] shadow-[0_0_40px_rgba(255,255,255,0.35)]` : p.off} ${p.id === 0 ? 'rounded-tl-[100%]' : p.id === 1 ? 'rounded-tr-[100%]' : p.id === 2 ? 'rounded-bl-[100%]' : 'rounded-br-[100%]'}`} />
          ))}
        </div>
        {phase === 'over' ? <Banner tone="lose" title={`Wrong pad. You reached round ${level}`} action={<Btn variant="solid" icon="play" onClick={start}>Try again</Btn>} />
          : <p className="min-h-6 text-center font-mono text-xs text-zinc-400" role="status" aria-live="polite">{phase === 'idle' ? 'Press Start, watch the pattern, repeat it.' : phase === 'show' ? <span className="text-accent">Watch…</span> : `Your turn: ${pos + 1} of ${seq.length}`}</p>}
      </div>
      <Panel className="space-y-4">
        <div className="flex flex-wrap gap-2"><Pill label="Round" value={level} tone="accent" /><Pill label="Best" value={rec.best ?? 0} /></div>
        <div className="flex flex-wrap items-center gap-2">
          <Btn variant="solid" icon="play" onClick={start} disabled={phase === 'show'}>{phase === 'idle' ? 'Start' : 'Restart'}</Btn>
          <Segmented label="Speed" value={speed} onChange={setSpeed} options={[{ id: 'chill', label: 'Chill' }, { id: 'normal', label: 'Normal' }, { id: 'fast', label: 'Fast' }]} disabled={phase === 'show' || phase === 'input'} />
        </div>
        <div className="flex flex-wrap gap-2"><Btn active={strict} onClick={() => setStrict((s) => !s)}>Strict {strict ? 'on' : 'off'}</Btn><Btn active={muted} onClick={() => setMuted((m) => !m)}>{muted ? 'Sound off' : 'Sound on'}</Btn></div>
        <p className="text-[11px] leading-relaxed text-zinc-500">Each round adds one more step. The pattern also speeds up as it grows. Keys: Q W / A S. Strict mode ends the game on a mistake; with it off you just get the pattern replayed.</p>
      </Panel>
    </div>
  );
}
