// src/components/admin/CustomersPanel.tsx — everyone who has contacted you, grouped from the requests (no extra data to maintain).
'use client';

import { useMemo, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { formatUGX, STATUS_LABEL } from '@/lib/shared';
import { box, btn, downloadText, isOpenTicket, kampalaDay, timeAgo, type AdminTicket } from './adminKit';

interface Customer { key: string; name: string; phones: Set<string>; emails: Set<string>; tickets: AdminTicket[]; quoted: number; paid: number; last: string; first: string }
const norm = (t: AdminTicket) => { const d = t.phone.replace(/\D/g, '').slice(-9); return d ? `p${d}` : t.email ? `e${t.email.toLowerCase()}` : `n${t.name.toLowerCase()}`; };

export default function CustomersPanel({ tickets, onOpenTicket }: { tickets: AdminTicket[]; onOpenTicket: (id: string) => void }) {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'recent' | 'value' | 'count'>('recent');
  const [open, setOpen] = useState<string | null>(null);

  const customers = useMemo(() => {
    const m = new Map<string, Customer>();
    for (const t of tickets) {
      const k = norm(t);
      const c = m.get(k) ?? { key: k, name: t.name, phones: new Set<string>(), emails: new Set<string>(), tickets: [], quoted: 0, paid: 0, last: t.createdAt, first: t.createdAt };
      if (t.phone) c.phones.add(t.phone);
      if (t.email) c.emails.add(t.email);
      c.tickets.push(t); c.quoted += t.quoteUGX || 0;
      c.paid += t.payments.filter((p) => p.status === 'CONFIRMED').reduce((a, p) => a + (p.amountUGX || 0), 0) || (t.payments.some((p) => p.status === 'CONFIRMED') ? t.depositUGX || 0 : 0);
      if (t.createdAt > c.last) { c.last = t.createdAt; c.name = t.name; }
      if (t.createdAt < c.first) c.first = t.createdAt;
      m.set(k, c);
    }
    return [...m.values()];
  }, [tickets]);

  const shown = useMemo(() => {
    const n = q.trim().toLowerCase();
    const list = customers.filter((c) => !n || `${c.name} ${[...c.phones].join(' ')} ${[...c.emails].join(' ')}`.toLowerCase().includes(n));
    return list.sort((a, b) => (sort === 'value' ? b.quoted - a.quoted : sort === 'count' ? b.tickets.length - a.tickets.length : b.last.localeCompare(a.last)));
  }, [customers, q, sort]);

  const exportCsv = () => {
    const rows = [['name', 'phone', 'email', 'requests', 'open', 'quoted_ugx', 'paid_ugx', 'first_contact', 'last_contact'], ...shown.map((c) => [c.name, [...c.phones].join(' | '), [...c.emails].join(' | '), c.tickets.length, c.tickets.filter(isOpenTicket).length, c.quoted, c.paid, c.first, c.last])];
    const cell = (v: unknown) => { let s = String(v ?? ''); if (/^[=+\-@\t\r]/.test(s) && !/^\+?[\d\s-]+$/.test(s)) s = `'${s}`; return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    downloadText(`customers-${kampalaDay()}.csv`, '\uFEFF' + rows.map((r) => r.map(cell).join(',')).join('\r\n'), 'text/csv');
  };

  const repeat = customers.filter((c) => c.tickets.length > 1).length;
  return (
    <section className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {([['Customers', customers.length], ['Repeat customers', repeat], ['Lifetime quoted', formatUGX(customers.reduce((a, c) => a + c.quoted, 0))]] as [string, string | number][]).map(([t, v]) => (
          <div key={t} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3"><div className="font-mono text-[10px] uppercase text-zinc-400">{t}</div><div className="mt-1 text-lg font-bold text-zinc-100 sm:text-2xl">{v}</div></div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <input className={`${box} sm:max-w-xs`} placeholder="Search name, phone or email…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search customers" />
        <select className={`${box} sm:max-w-[11rem]`} value={sort} onChange={(e) => setSort(e.target.value as any)} aria-label="Sort"><option value="recent">Most recent</option><option value="value">Highest value</option><option value="count">Most requests</option></select>
        <button className={btn} onClick={exportCsv} disabled={!shown.length}><Icon name="download" /> CSV</button>
      </div>
      {shown.length === 0 ? <p className="text-sm text-zinc-400">{customers.length ? 'No customers match.' : 'Customers appear here once requests come in.'}</p> : (
        <ul className="space-y-2">
          {shown.map((c) => {
            const wa = [...c.phones][0]?.replace(/\D/g, '');
            return (
              <li key={c.key} className="rounded-xl border border-zinc-800 bg-zinc-900/40">
                <button type="button" onClick={() => setOpen(open === c.key ? null : c.key)} aria-expanded={open === c.key} className="flex w-full flex-wrap items-center justify-between gap-2 p-4 text-left">
                  <span className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-cyan-500/15 font-mono text-sm text-cyan-300">{c.name.trim().charAt(0).toUpperCase() || '?'}</span><span><strong className="text-sm text-zinc-100">{c.name}</strong>{c.tickets.length > 1 && <span className="ml-2 rounded bg-emerald-500/15 px-1.5 py-0.5 font-mono text-[10px] text-emerald-300">REPEAT</span>}<span className="block text-[11px] text-zinc-500">{[...c.phones][0] || [...c.emails][0] || 'no contact'}</span></span></span>
                  <span className="text-right font-mono text-[11px] text-zinc-400">{c.tickets.length} request{c.tickets.length > 1 ? 's' : ''} · {c.quoted ? formatUGX(c.quoted) : 'no quote'}<span className="block text-zinc-600">last {timeAgo(c.last)}</span></span>
                </button>
                {open === c.key && (
                  <div className="space-y-3 border-t border-zinc-800 p-4 ios-enter">
                    <div className="flex flex-wrap gap-2 text-xs">
                      {wa && <a className={btn} href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer"><Icon name="message-circle" /> WhatsApp</a>}
                      {[...c.phones].map((p) => <a key={p} className={btn} href={`tel:${p.replace(/[^\d+]/g, '')}`}><Icon name="phone" /> {p}</a>)}
                      {[...c.emails].map((e) => <a key={e} className={btn} href={`mailto:${e}`}><Icon name="mail" /> {e}</a>)}
                    </div>
                    <ul className="space-y-1.5">
                      {[...c.tickets].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((t) => (
                        <li key={t.id}><button type="button" onClick={() => onOpenTicket(t.id)} className="flex w-full items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-left text-xs hover:border-zinc-600">
                          <span><span className="font-mono text-cyan-400">{t.id}</span> <span className="text-zinc-300">{t.kind}</span></span><span className="font-mono text-zinc-400">{STATUS_LABEL[t.status]} · {timeAgo(t.createdAt)}</span>
                        </button></li>
                      ))}
                    </ul>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
