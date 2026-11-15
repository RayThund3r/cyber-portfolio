// src/lib/events/calendar.ts — the site's "world calendar": holidays, national days and awareness days the site can react to.
// Pure and offline (no news feed, no API): fixed dates, Easter computed, and a small table for moon-based dates (approximate: the real day
// can differ by one in some countries). Surprise events (a national mourning, a big sports night) are added by the owner in Admin → Events.
import type { IconName } from '@/components/ui/Icon';

export type FxName = 'confetti' | 'snow' | 'hearts' | 'lanterns' | 'stars' | 'leaves' | 'rain' | 'matrix' | 'barrel' | 'none';
export type Scope = 'uganda' | 'africa' | 'world' | 'faith' | 'seasonal' | 'tech' | 'custom';
export type Tone = 'celebrate' | 'solemn' | 'awareness';

export interface WorldEvent {
  id: string;
  name: string;
  scope: Scope;
  tone: Tone;
  icon: IconName;
  fx: FxName;
  /** One line for the ribbon at the top of the site. */
  ribbon: string;
  /** What the assistant says (short, warm). */
  say: string;
  /** Higher wins when several events overlap. */
  weight: number;
  /** Optional page to open from the ribbon. */
  href?: string;
  /** For moon-based dates the table is approximate. */
  approx?: boolean;
}

interface Rule { id: string; m?: number; d?: number; /** days the window lasts, starting at (m,d) minus `lead` */ span?: number; lead?: number; easter?: number; table?: Record<number, string>; nth?: { m: number; dow: number; n: number }; programmer?: boolean }
interface Def extends WorldEvent { rule: Rule }

const D = (id: string, name: string, scope: Scope, tone: Tone, icon: IconName, fx: FxName, weight: number, ribbon: string, say: string, rule: Omit<Rule, 'id'>, extra: Partial<WorldEvent> = {}): Def =>
  ({ id, name, scope, tone, icon, fx, weight, ribbon, say, ...extra, rule: { id, ...rule } });

export const EVENTS: Def[] = [
  // ---- Uganda -------------------------------------------------------------
  D('ug-independence', 'Uganda Independence Day', 'uganda', 'celebrate', 'flag', 'confetti', 95, 'Happy Independence Day, Uganda! 9 October. Black, yellow, red, and the crested crane.', 'Happy Independence Day, Uganda! 🇺🇬 Proud to build from Kampala. Here is to more years of making things.', { m: 10, d: 9, span: 1, lead: 1 }),
  D('ug-liberation', 'NRM Liberation Day', 'uganda', 'awareness', 'flag', 'none', 40, 'Liberation Day (26 January), a public holiday in Uganda.', 'It is Liberation Day in Uganda today, a public holiday. Orders and messages still reach us.', { m: 1, d: 26 }),
  D('ug-luwum', 'Archbishop Janani Luwum Day', 'uganda', 'solemn', 'bell', 'none', 40, 'Archbishop Janani Luwum Day (16 February), a day of remembrance in Uganda.', 'Today is Archbishop Janani Luwum Day in Uganda, a quiet day of remembrance.', { m: 2, d: 16 }),
  D('ug-womens', "International Women's Day", 'world', 'celebrate', 'heart', 'hearts', 70, "Happy International Women's Day, to the women who build, fix, design and lead.", "Happy International Women's Day! 💜 Hats off to every woman building something.", { m: 3, d: 8 }),
  D('ug-labour', 'Labour Day', 'world', 'celebrate', 'wrench', 'none', 55, 'Happy Labour Day. Rest well, makers and fixers.', 'Happy Labour Day! Rest up if you can. The work will still be there tomorrow.', { m: 5, d: 1 }),
  D('africa-day', 'Africa Day', 'africa', 'celebrate', 'compass', 'stars', 75, 'Happy Africa Day. Built in Africa, for the world.', 'Happy Africa Day! 🌍 Built in Africa, for the world.', { m: 5, d: 25 }),
  D('ug-martyrs', 'Uganda Martyrs Day', 'uganda', 'solemn', 'bell', 'none', 85, 'Uganda Martyrs Day (3 June). Namugongo remembers. Please travel safely.', 'Today is Uganda Martyrs Day. Many are making the pilgrimage to Namugongo. Travel safely, and peace to you.', { m: 6, d: 3 }),
  D('ug-heroes', 'National Heroes Day', 'uganda', 'celebrate', 'star', 'none', 60, 'National Heroes Day (9 June). We honour those who served Uganda.', 'It is National Heroes Day in Uganda. We honour those who served this country.', { m: 6, d: 9 }),
  // ---- Faith (moving) ------------------------------------------------------
  D('ramadan', 'Ramadan', 'faith', 'awareness', 'star', 'lanterns', 50, 'Ramadan Mubarak. Replies may be slower around sunset.', 'Ramadan Mubarak! 🌙 Wishing you a blessed month. We may reply a little slower around sunset.', { span: 30, table: { 2026: '02-18', 2027: '02-08', 2028: '01-28', 2029: '01-16', 2030: '01-05' } }, { approx: true }),
  D('eid-fitr', 'Eid al-Fitr', 'faith', 'celebrate', 'star', 'lanterns', 90, 'Eid Mubarak! Wishing you joy and peace.', 'Eid Mubarak! 🌙✨ Wishing you and your family joy and peace.', { span: 3, table: { 2026: '03-20', 2027: '03-09', 2028: '02-26', 2029: '02-14', 2030: '02-04' } }, { approx: true }),
  D('eid-adha', 'Eid al-Adha', 'faith', 'celebrate', 'star', 'lanterns', 90, 'Eid al-Adha Mubarak. Blessings to you and yours.', 'Eid al-Adha Mubarak! Blessings to you and yours.', { span: 3, table: { 2026: '05-27', 2027: '05-16', 2028: '05-05', 2029: '04-24', 2030: '04-13' } }, { approx: true }),
  D('good-friday', 'Good Friday', 'faith', 'solemn', 'bell', 'none', 80, 'Good Friday. A quiet day for many; wishing you a peaceful one.', 'Wishing you a peaceful Good Friday.', { easter: -2 }),
  D('easter', 'Easter', 'faith', 'celebrate', 'gift', 'confetti', 88, 'Happy Easter! Wishing you a joyful weekend.', 'Happy Easter! 🐣 Wishing you a joyful weekend with the people you love.', { easter: 0, span: 2 }),
  D('diwali', 'Diwali', 'faith', 'celebrate', 'spark', 'lanterns', 65, 'Happy Diwali, the festival of lights.', 'Happy Diwali! 🪔 May your year be bright.', { span: 3, table: { 2026: '11-08', 2027: '10-29', 2028: '10-17', 2029: '11-05', 2030: '10-26' } }, { approx: true }),
  D('lunar-new-year', 'Lunar New Year', 'faith', 'celebrate', 'gift', 'lanterns', 65, 'Happy Lunar New Year! Wishing you luck and prosperity.', 'Happy Lunar New Year! 🧧 Wishing you luck and prosperity.', { span: 3, table: { 2026: '02-17', 2027: '02-06', 2028: '01-26', 2029: '02-13', 2030: '02-03' } }, { approx: true }),
  // ---- World & seasonal ----------------------------------------------------
  D('new-year', 'New Year', 'seasonal', 'celebrate', 'spark', 'confetti', 99, 'Happy New Year! New year, new builds.', 'Happy New Year! 🎆 New year, new builds. What are we making?', { m: 12, d: 31, span: 3 }),
  D('valentine', "Valentine's Day", 'seasonal', 'celebrate', 'heart', 'hearts', 60, "Happy Valentine's Day. Show someone some love today.", "Happy Valentine's Day! 💌 Show someone some love, even a small message counts.", { m: 2, d: 13, span: 2 }),
  D('earth-day', 'Earth Day', 'world', 'awareness', 'compass', 'leaves', 45, 'Earth Day. Repair, reuse, keep devices out of the bin.', 'It is Earth Day! 🌱 Fun fact: repairing a device is almost always greener than replacing it.', { m: 4, d: 22 }),
  D('env-day', 'World Environment Day', 'world', 'awareness', 'compass', 'leaves', 40, 'World Environment Day (5 June). Repair before you replace.', 'It is World Environment Day. 🌿 Repairing before replacing is one of the easiest green habits.', { m: 6, d: 5 }),
  D('mandela', 'Mandela Day', 'world', 'awareness', 'heart', 'none', 40, 'Mandela Day (18 July). Do something good for 67 minutes.', 'It is Mandela Day. Do something good for someone for 67 minutes. 💛', { m: 7, d: 18 }),
  D('youth-day', 'International Youth Day', 'world', 'celebrate', 'spark', 'stars', 40, 'International Youth Day (12 August). Young builders, this is for you.', 'Happy International Youth Day! 🚀 Young builders, this one is for you.', { m: 8, d: 12 }),
  D('peace-day', 'International Day of Peace', 'world', 'awareness', 'heart', 'none', 40, 'International Day of Peace (21 September).', 'It is the International Day of Peace. 🕊️ A kind word costs nothing.', { m: 9, d: 21 }),
  D('mental-health', 'World Mental Health Day', 'world', 'awareness', 'heart', 'none', 45, 'World Mental Health Day (10 October). Check in on someone, and on yourself.', 'It is World Mental Health Day. 💚 Check in on someone today, and on yourself too.', { m: 10, d: 10 }),
  D('halloween', 'Halloween', 'seasonal', 'celebrate', 'terminal', 'matrix', 50, 'Spooky season. Beware of unplugged chargers.', 'Happy Halloween! 🎃 The scariest thing in tech: "it worked yesterday".', { m: 10, d: 28, span: 4 }),
  D('christmas', 'Christmas', 'seasonal', 'celebrate', 'gift', 'snow', 92, 'Merry Christmas! Wishing you peace, joy and good food.', 'Merry Christmas! 🎄 Wishing you peace, joy and a lot of good food.', { m: 12, d: 20, span: 7 }),
  D('boxing', 'Boxing Day', 'seasonal', 'celebrate', 'gift', 'none', 50, 'Boxing Day. Enjoy the rest, we are back soon.', 'Happy Boxing Day! Rest up.', { m: 12, d: 26 }),
  // ---- Tech & fun ----------------------------------------------------------
  D('pi-day', 'Pi Day', 'tech', 'celebrate', 'cpu', 'none', 30, 'Happy Pi Day (3.14159...). Slice responsibly.', 'Happy Pi Day! 🥧 3.14159265358979... I could go on, but you would stop reading.', { m: 3, d: 14 }),
  D('may-4', 'Star Wars Day', 'tech', 'celebrate', 'spark', 'stars', 30, 'May the 4th be with you.', 'May the 4th be with you! ✨', { m: 5, d: 4 }),
  D('programmer', "Programmers' Day", 'tech', 'celebrate', 'code', 'matrix', 55, "Happy Programmers' Day. The 256th day of the year.", "Happy Programmers' Day! 👾 It is the 256th day of the year, because 2⁸ was always going to be special.", { programmer: true }),
  D('internet-day', 'Internet Day', 'tech', 'celebrate', 'wifi', 'none', 30, 'Internet Day (29 October). Thank you for reading this over a cable somewhere.', 'It is Internet Day! 🌐 Thanks for being on it with us.', { m: 10, d: 29 }),
];

const pad = (n: number) => String(n).padStart(2, '0');
const key = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const utc = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d);

/** Western Easter Sunday (Meeus/Jones/Butcher). */
export function easterDate(y: number): { m: number; d: number } {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return { m: month, d: day };
}

/** Start (UTC ms) of this rule's window in year y, or null when it has none (e.g. moon table has no row for that year). */
function startOf(r: Rule, y: number): number | null {
  if (r.easter !== undefined) { const e = easterDate(y); return utc(y, e.m, e.d) + r.easter * 864e5; }
  if (r.table) { const s = r.table[y]; if (!s) return null; const [m, d] = s.split('-').map(Number); return utc(y, m, d); }
  if (r.programmer) return utc(y, 1, 1) + 255 * 864e5; // day 256 of the year (13 Sep, or 12 Sep in a leap year)
  if (r.m && r.d) return utc(y, r.m, r.d) - (r.lead || 0) * 864e5;
  return null;
}

export interface Occurrence extends WorldEvent { start: string; end: string }
const strip = ({ rule: _r, ...e }: Def): WorldEvent => e;

/** Events whose window covers `now` (local calendar date of the visitor). Sorted most important first. */
export function activeEvents(now: Date = new Date(), off: string[] = []): WorldEvent[] {
  const today = utc(now.getFullYear(), now.getMonth() + 1, now.getDate());
  const out: Def[] = [];
  for (const e of EVENTS) {
    if (off.includes(e.id)) continue;
    for (const y of [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1]) {
      const s = startOf(e.rule, y); if (s === null) continue;
      const span = (e.rule.span || 1) + (e.rule.lead || 0);
      if (today >= s && today < s + span * 864e5) { out.push(e); break; }
    }
  }
  return out.sort((a, b) => b.weight - a.weight).map(strip);
}

/** The next occurrences after today (for the admin "coming up" list). */
export function upcomingEvents(now: Date = new Date(), count = 8, off: string[] = []): Occurrence[] {
  const today = utc(now.getFullYear(), now.getMonth() + 1, now.getDate());
  const list: Occurrence[] = [];
  for (const e of EVENTS) {
    if (off.includes(e.id)) continue;
    for (const y of [now.getFullYear(), now.getFullYear() + 1]) {
      const s = startOf(e.rule, y); if (s === null || s < today) continue;
      const span = (e.rule.span || 1) + (e.rule.lead || 0);
      const sd = new Date(s), ed = new Date(s + (span - 1) * 864e5);
      list.push({ ...strip(e), start: key(sd.getUTCFullYear(), sd.getUTCMonth() + 1, sd.getUTCDate()), end: key(ed.getUTCFullYear(), ed.getUTCMonth() + 1, ed.getUTCDate()) });
      break;
    }
  }
  return list.sort((a, b) => (a.start < b.start ? -1 : 1)).slice(0, count);
}

export const eventById = (id: string): WorldEvent | undefined => { const e = EVENTS.find((x) => x.id === id); return e ? strip(e) : undefined; };
