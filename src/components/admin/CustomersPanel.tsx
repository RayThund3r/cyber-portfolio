// src/components/admin/CustomersPanel.tsx — everyone who has contacted you, grouped from the requests (no extra data to maintain).
'use client';

import { useMemo, useState } from 'react';
import Icon from '@/components/ui/IconAny';
import { formatUGX, STATUS_LABEL } from '@/lib/shared';
import { AButton, Avatar, Badge, Empty, Priv, Stat, compactUGX } from './ui';
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
    <section className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Customers" value={customers.length} icon="user" />
        <Stat label="Repeat" value={repeat} icon="heart" tone="ok" hint={customers.length ? `${Math.round((repeat / customers.length) * 100)}% came back` : undefined} />
        <Stat label="Lifetime quoted" value={compactUGX(customers.reduce((a, c) => a + c.quoted, 0))} icon="money" tone="warn" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1 sm:max-w-sm">
          <Icon name="search" size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input className={`${box} pl-9`} placeholder="Search name, phone or email…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search customers" />
        </div>
        <select className={`${box} !w-auto`} value={sort} onChange={(e) => setSort(e.target.value as any)} aria-label="Sort"><option value="recent">Most recent</option><option value="value">Highest value</option><option value="count">Most requests</option></select>
        <div className="ml-auto"><AButton onClick={exportCsv} disabled={!shown.length} icon="download">CSV</AButton></div>
      </div>
      {shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-800"><Empty icon="user" title={customers.length ? 'No customers match' : 'No customers yet'} text={customers.length ? 'Try a different search.' : 'Customers appear here once requests come in.'} /></div>
      ) : (
        <ul className="space-y-2.5">
          {shown.map((c) => {
            const wa = [...c.phones][0]?.replace(/\D/g, '');
            const isOpen = open === c.key;
            return (
              <li key={c.key} className={`overflow-hidden rounded-2xl border bg-zinc-900/50 transition ${isOpen ? 'border-zinc-600' : 'border-zinc-800/80 hover:border-zinc-700'}`}>
                <button type="button" onClick={() => setOpen(isOpen ? null : c.key)} aria-expanded={isOpen} className="flex w-full cursor-pointer items-center gap-3 p-3.5 text-left">
                  <Avatar name={c.name} size={42} />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2"><strong className="truncate text-sm font-semibold text-zinc-100"><Priv>{c.name}</Priv></strong>{c.tickets.length > 1 && <Badge tone="ok">Repeat</Badge>}{c.tickets.some(isOpenTicket) && <Badge tone="accent">{c.tickets.filter(isOpenTicket).length} open</Badge>}</span>
                    <span className="mt-0.5 block truncate text-xs text-zinc-500"><Priv>{[...c.phones][0] || [...c.emails][0] || 'No contact details'}</Priv></span>
                  </span>
                  <span className="flex-none text-right text-xs"><span className="block font-semibold text-zinc-200">{c.tickets.length} request{c.tickets.length > 1 ? 's' : ''}</span><span className="block text-zinc-500">{c.quoted ? compactUGX(c.quoted) : 'no quote'} · {timeAgo(c.last)}</span></span>
                  <Icon name="arrow" size={14} className={`hidden flex-none text-zinc-600 transition sm:block ${isOpen ? 'rotate-90' : ''}`} />
                </button>
                {isOpen && (
                  <div className="space-y-3 border-t border-zinc-800/80 bg-zinc-950/40 p-4 ios-enter">
                    <div className="flex flex-wrap gap-2 text-xs">
                      {wa && <a className={btn} href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer"><Icon name="message-circle" size={14} /> WhatsApp</a>}
                      {[...c.phones].map((p) => <a key={p} className={btn} href={`tel:${p.replace(/[^\d+]/g, '')}`}><Icon name="phone" size={14} /> <Priv>{p}</Priv></a>)}
                      {[...c.emails].map((e) => <a key={e} className={btn} href={`mailto:${e}`}><Icon name="mail" size={14} /> <Priv>{e}</Priv></a>)}
                    </div>
                    <ul className="space-y-1.5">
                      {[...c.tickets].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((t) => (
                        <li key={t.id}><button type="button" onClick={() => onOpenTicket(t.id)} className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-left text-xs transition hover:border-accent/40">
                          <span><span className="font-mono text-accent">{t.id}</span> <span className="ml-1 text-zinc-300">{t.kind}</span></span><span className="text-zinc-500">{STATUS_LABEL[t.status]} · {timeAgo(t.createdAt)}</span>
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
