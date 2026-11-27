// src/components/admin/CalendarPanel.tsx — a month view of booked visits, built from the requests' time slots.
'use client';

import { useMemo, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { STATUS_LABEL } from '@/lib/shared';
import { btn, kampalaDay, type AdminTicket } from './adminKit';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const pad = (n: number) => String(n).padStart(2, '0');
const dayKey = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const ENDED = new Set(['COMPLETED', 'CANCELLED', 'DONE', 'CLOSED']);

export default function CalendarPanel({ tickets, onOpenTicket }: { tickets: AdminTicket[]; onOpenTicket: (id: string) => void }) {
  const today = kampalaDay();
  const [cursor, setCursor] = useState(() => { const [y, m] = today.split('-').map(Number); return { y, m: m - 1 }; });
  const [selected, setSelected] = useState<string>(today);

  const byDay = useMemo(() => {
    const m = new Map<string, AdminTicket[]>();
    for (const t of tickets) if (t.slot?.date) m.set(t.slot.date, [...(m.get(t.slot.date) ?? []), t]);
    for (const list of m.values()) list.sort((a, b) => (a.slot!.time || '').localeCompare(b.slot!.time || ''));
    return m;
  }, [tickets]);

  const first = new Date(cursor.y, cursor.m, 1);
  const offset = (first.getDay() + 6) % 7; // Monday first
  const count = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(offset).fill(null), ...Array.from({ length: count }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const go = (d: number) => setCursor((c) => { const n = new Date(c.y, c.m + d, 1); return { y: n.getFullYear(), m: n.getMonth() }; });
  const upcoming = [...byDay.entries()].filter(([d]) => d >= today).sort(([a], [b]) => a.localeCompare(b)).slice(0, 5);
  const agenda = byDay.get(selected) ?? [];
  const monthTotal = [...byDay.entries()].filter(([d]) => d.startsWith(`${cursor.y}-${pad(cursor.m + 1)}`)).reduce((a, [, l]) => a + l.length, 0);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button className={btn} onClick={() => go(-1)} aria-label="Previous month"><Icon name="chevron-left" /></button>
          <h2 className="min-w-[10rem] text-center text-base font-bold text-zinc-100">{MONTHS[cursor.m]} {cursor.y}</h2>
          <button className={btn} onClick={() => go(1)} aria-label="Next month"><Icon name="chevron-right" /></button>
          <button className={btn} onClick={() => { const [y, m] = today.split('-').map(Number); setCursor({ y, m: m - 1 }); setSelected(today); }}>Today</button>
        </div>
        <span className="font-mono text-[11px] text-zinc-400">{monthTotal} visit{monthTotal === 1 ? '' : 's'} this month</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-2 sm:p-3">
          <div className="grid grid-cols-7 gap-1 text-center font-mono text-[10px] uppercase text-zinc-500">{DAYS.map((d) => <div key={d} className="py-1">{d}</div>)}</div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {cells.map((d, i) => {
              if (!d) return <div key={i} className="aspect-square" />;
              const key = dayKey(cursor.y, cursor.m, d); const list = byDay.get(key) ?? []; const active = list.filter((t) => !ENDED.has(t.status)).length;
              return (
                <button key={i} type="button" onClick={() => setSelected(key)} aria-pressed={selected === key} aria-label={`${d} ${MONTHS[cursor.m]}, ${list.length} visit${list.length === 1 ? '' : 's'}`}
                  className={`relative flex aspect-square flex-col items-center justify-start rounded-lg border p-1 text-xs transition-colors ${selected === key ? 'border-cyan-400 bg-cyan-500/15 text-cyan-100' : key === today ? 'border-cyan-500/50 text-cyan-200' : 'border-zinc-800 text-zinc-300 hover:border-zinc-600'}`}>
                  <span className="font-mono">{d}</span>
                  {list.length > 0 && <span className={`mt-auto rounded-full px-1.5 font-mono text-[10px] ${active ? 'bg-emerald-500/25 text-emerald-300' : 'bg-zinc-700/60 text-zinc-400'}`}>{list.length}</span>}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
            <h3 className="mb-2 font-mono text-xs text-cyan-400">{selected === today ? 'TODAY' : selected}</h3>
            {agenda.length === 0 ? <p className="text-sm text-zinc-500">No visits booked.</p> : (
              <ul className="space-y-2">
                {agenda.map((t) => (
                  <li key={t.id}><button type="button" onClick={() => onOpenTicket(t.id)} className="flex w-full items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-left text-xs hover:border-zinc-600">
                    <span><strong className="font-mono text-zinc-100">{t.slot!.time}</strong> <span className="text-zinc-300">{t.name}</span><span className="block text-[10px] text-zinc-500">{t.kind} · {t.id}</span></span>
                    <span className="font-mono text-[10px] text-zinc-400">{STATUS_LABEL[t.status]}</span>
                  </button></li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
            <h3 className="mb-2 font-mono text-xs text-cyan-400">COMING UP</h3>
            {upcoming.length === 0 ? <p className="text-sm text-zinc-500">Nothing booked ahead.</p> : (
              <ul className="space-y-1.5 text-xs">
                {upcoming.map(([d, l]) => <li key={d}><button type="button" onClick={() => { setSelected(d); const [y, m] = d.split('-').map(Number); setCursor({ y, m: m - 1 }); }} className="flex w-full justify-between rounded px-2 py-1.5 text-left text-zinc-300 hover:bg-zinc-800"><span className="font-mono">{d}</span><span className="text-zinc-500">{l.length} visit{l.length === 1 ? '' : 's'}</span></button></li>)}
              </ul>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
