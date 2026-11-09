// src/server/booking.ts — appointment slots. All times are Africa/Kampala (UTC+3, no DST).
import 'server-only';
import { slotCounts } from './store';

const num = (v: string | undefined, d: number, min: number, max: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.floor(n))) : d;
};

export const BOOKING = {
  days: (process.env.BOOKING_DAYS || '1,2,3,4,5,6').split(',').map(Number).filter((n) => n >= 0 && n <= 6), // 0=Sun
  start: process.env.BOOKING_START || '09:00',
  end: process.env.BOOKING_END || '18:00',
  slotMinutes: num(process.env.BOOKING_SLOT_MINUTES, 60, 15, 480),
  capacity: num(process.env.BOOKING_CAPACITY, 2, 1, 50),
  leadHours: num(process.env.BOOKING_LEAD_HOURS, 2, 0, 72),
  maxDays: num(process.env.BOOKING_MAX_DAYS, 30, 1, 180),
  closed: (process.env.BOOKING_CLOSED_DATES || '').split(',').map((s) => s.trim()).filter(Boolean),
};

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};
const fmt = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

function kampalaNow() {
  const d = new Date(Date.now() + 3 * 3600 * 1000);
  return { date: d.toISOString().slice(0, 10), minutes: d.getUTCHours() * 60 + d.getUTCMinutes() };
}
const addDays = (date: string, n: number) => new Date(Date.parse(date + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);

export function bookingWindow() {
  const now = kampalaNow();
  return { min: now.date, max: addDays(now.date, BOOKING.maxDays), openDays: BOOKING.days, slotMinutes: BOOKING.slotMinutes };
}

export async function getSlots(date: string): Promise<{ slots: { time: string; available: boolean }[]; closed?: string }> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date + 'T00:00:00Z'))) return { slots: [], closed: 'Invalid date.' };
  const now = kampalaNow();
  if (date < now.date) return { slots: [], closed: 'That date has passed.' };
  if (date > addDays(now.date, BOOKING.maxDays)) return { slots: [], closed: `Bookings open up to ${BOOKING.maxDays} days ahead.` };
  const dow = new Date(date + 'T00:00:00Z').getUTCDay();
  if (!BOOKING.days.includes(dow) || BOOKING.closed.includes(date)) return { slots: [], closed: 'We are closed that day — please pick another date.' };

  const counts = await slotCounts(date);
  const earliest = date === now.date ? now.minutes + BOOKING.leadHours * 60 : 0;
  const slots: { time: string; available: boolean }[] = [];
  for (let m = toMin(BOOKING.start); m + BOOKING.slotMinutes <= toMin(BOOKING.end); m += BOOKING.slotMinutes) {
    const time = fmt(m);
    slots.push({ time, available: m >= earliest && (counts[time] || 0) < BOOKING.capacity });
  }
  return { slots };
}

export async function validateSlot(date: string, time: string): Promise<string | null> {
  const { slots, closed } = await getSlots(date);
  if (closed) return closed;
  const s = slots.find((x) => x.time === time);
  if (!s) return 'That time is not available.';
  return s.available ? null : 'Sorry, that slot was just taken — please choose another.';
}
