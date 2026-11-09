// src/lib/admin/desk.ts — bridges the admin tools to the request/booking desk (server/store tickets).
// Tickets are the one place customer requests live, so the "unread" numbers, digest, Lab score and shell all read them.
import 'server-only';
import { listTickets, type Ticket } from '@/server/store';
import { getStore } from './store';
import { notify } from './auth';
import { dayKey } from './track';

export interface DeskItem { id: string; kind: Ticket['kind']; name: string; status: string; createdAt: string; snippet: string; slot?: string }
export interface DeskSummary { total: number; fresh: number; open: number; awaitingDeposit: number; today: number; latest: DeskItem[] }

const CLOSED = new Set(['COMPLETED', 'CANCELLED']);

export async function deskSummary(limit = 10): Promise<DeskSummary> {
  const all = await listTickets();
  const today = new Date().toISOString().slice(0, 10);
  return {
    total: all.length,
    fresh: all.filter((t) => t.status === 'RECEIVED').length,
    open: all.filter((t) => !CLOSED.has(t.status)).length,
    awaitingDeposit: all.filter((t) => t.status === 'AWAITING_DEPOSIT').length,
    today: all.filter((t) => t.createdAt.slice(0, 10) === today).length,
    latest: all.slice(0, Math.max(1, Math.min(50, limit))).map((t) => ({
      id: t.id, kind: t.kind, name: t.name, status: t.status, createdAt: t.createdAt, snippet: (t.details || '').replace(/\s+/g, ' ').slice(0, 120),
      slot: t.slot ? `${t.slot.date} ${t.slot.time}` : undefined,
    })),
  };
}

/** Called once for every new request: counts it in the daily stats and pings the optional webhook / ntfy topic. Never throws. */
export async function noteNewTicket(t: Pick<Ticket, 'id' | 'kind' | 'name' | 'details'>): Promise<void> {
  try { await getStore().cmd('HINCRBY', 'inbox:count', dayKey(), 1); } catch { /* stats are best effort */ }
  try { await notify(`New ${t.kind} request ${t.id} from ${t.name}: ${(t.details || '').replace(/\s+/g, ' ').slice(0, 120)}`); } catch { /* ignore */ }
}
