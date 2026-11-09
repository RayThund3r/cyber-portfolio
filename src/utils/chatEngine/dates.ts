// src/utils/chatEngine/dates.ts
//
// Date questions answered exactly, with no model: countdowns ("how many days until Christmas"),
// "days since", "what day is 25 December 2026", "what's the date in 3 weeks", "date 90 days from now",
// and "how many days left this year/month". Day-first for numeric dates (25/12/2026), as in Uganda.

export interface DateAnswer {
  human: string;
  expert: string;
  suggestions?: string[];
}

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const MON_ABBR = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const DAY_MS = 86_400_000;

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const daysBetween = (a: Date, b: Date) => Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / DAY_MS);
const plural = (n: number, w: string) => `${n.toLocaleString('en-US')} ${w}${Math.abs(n) === 1 ? '' : 's'}`;
const long = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

/** Easter Sunday (Anonymous Gregorian algorithm). */
function easter(year: number): Date {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}
function nthWeekday(year: number, month: number, weekday: number, n: number): Date {
  const first = new Date(year, month, 1);
  return new Date(year, month, 1 + ((7 + weekday - first.getDay()) % 7) + (n - 1) * 7);
}

interface Named {
  names: RegExp;
  label: string;
  at: (year: number) => Date;
}
const NAMED: Named[] = [
  { names: /\b(christmas|xmas)\b/, label: 'Christmas', at: (y) => new Date(y, 11, 25) },
  { names: /\bchristmas eve\b/, label: 'Christmas Eve', at: (y) => new Date(y, 11, 24) },
  { names: /\bnew year'?s? eve\b/, label: "New Year's Eve", at: (y) => new Date(y, 11, 31) },
  { names: /\bnew year'?s?( day)?\b/, label: "New Year's Day", at: (y) => new Date(y, 0, 1) },
  { names: /\bvalentine'?s?( day)?\b/, label: "Valentine's Day", at: (y) => new Date(y, 1, 14) },
  { names: /\bhalloween\b/, label: 'Halloween', at: (y) => new Date(y, 9, 31) },
  { names: /\beaster\b/, label: 'Easter', at: (y) => easter(y) },
  { names: /\bgood friday\b/, label: 'Good Friday', at: (y) => new Date(easter(y).getTime() - 2 * DAY_MS) },
  { names: /\bindependence day\b.*\buganda\b|\buganda\b.*\bindependence\b|\bindependence day\b/, label: "Uganda's Independence Day", at: (y) => new Date(y, 9, 9) },
  { names: /\bheroes'? day\b/, label: "Heroes' Day (Uganda)", at: (y) => new Date(y, 5, 9) },
  { names: /\blabou?r day\b/, label: 'Labour Day', at: (y) => new Date(y, 4, 1) },
  { names: /\bwomen'?s day\b/, label: "International Women's Day", at: (y) => new Date(y, 2, 8) },
  { names: /\bblack friday\b/, label: 'Black Friday', at: (y) => new Date(nthWeekday(y, 10, 4, 4).getTime() + DAY_MS) },
  { names: /\bthanksgiving\b/, label: 'Thanksgiving (US)', at: (y) => nthWeekday(y, 10, 4, 4) },
];

function nextOccurrence(now: Date, at: (y: number) => Date): Date {
  const y = now.getFullYear();
  const t = at(y);
  return daysBetween(now, t) >= 0 ? t : at(y + 1);
}

/** Parse "25 dec", "december 25 2026", "2027-01-01", "25/12/2026", "next friday", or a named holiday. */
function parseTarget(s: string, now: Date): { date: Date; label: string; explicitYear: boolean } | null {
  for (const h of NAMED) if (h.names.test(s)) {
    const d = nextOccurrence(now, h.at);
    return { date: d, label: h.label, explicitYear: false };
  }
  if (/\b(tomorrow)\b/.test(s)) return { date: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1), label: 'tomorrow', explicitYear: false };
  if (/\b(today)\b/.test(s)) return { date: startOfDay(now), label: 'today', explicitYear: false };
  let m: RegExpExecArray | null;
  if ((m = /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/.exec(s))) {
    const d = new Date(+m[1], +m[2] - 1, +m[3]);
    if (d.getMonth() === +m[2] - 1) return { date: d, label: long(d), explicitYear: true };
  }
  if ((m = /\b(\d{1,2})[\/.](\d{1,2})[\/.](\d{2,4})\b/.exec(s))) {
    const y = +m[3] < 100 ? 2000 + +m[3] : +m[3];
    const d = new Date(y, +m[2] - 1, +m[1]);
    if (d.getMonth() === +m[2] - 1) return { date: d, label: long(d), explicitYear: true };
  }
  const monthRe = `(${MONTHS.join('|')}|${MON_ABBR.join('|')})`;
  const dm = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s*(?:of\\s+)?${monthRe}\\.?(?:,?\\s*(\\d{4}))?\\b`).exec(s);
  const md = new RegExp(`\\b${monthRe}\\.?\\s*(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s*(\\d{4}))?\\b`).exec(s);
  const hit = dm ? { day: +dm[1], mon: dm[2], year: dm[3] } : md ? { day: +md[2], mon: md[1], year: md[3] } : null;
  if (hit) {
    const mi = MON_ABBR.indexOf(hit.mon.slice(0, 3));
    if (mi >= 0 && hit.day >= 1 && hit.day <= 31) {
      if (hit.year) {
        const d = new Date(+hit.year, mi, hit.day);
        if (d.getMonth() === mi) return { date: d, label: long(d), explicitYear: true };
      } else {
        let d = new Date(now.getFullYear(), mi, hit.day);
        if (d.getMonth() !== mi) return null;
        if (daysBetween(now, d) < 0) d = new Date(now.getFullYear() + 1, mi, hit.day);
        return { date: d, label: long(d), explicitYear: false };
      }
    }
  }
  const wd = new RegExp(`\\b(?:next |this |coming )?(${DAYS.join('|')})\\b`).exec(s);
  if (wd) {
    const target = DAYS.indexOf(wd[1]);
    let delta = (target - now.getDay() + 7) % 7;
    if (delta === 0 || /\bnext\b/.test(s) && delta < 7 && !/\bthis\b/.test(s) && delta === 0) delta = 7;
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + delta);
    return { date: d, label: wd[1][0].toUpperCase() + wd[1].slice(1), explicitYear: false };
  }
  return null;
}

function phraseFor(days: number): string {
  if (days === 0) return '**today**';
  if (days === 1) return '**tomorrow**';
  if (days === -1) return '**yesterday**';
  return days > 0 ? `in **${plural(days, 'day')}**` : `**${plural(-days, 'day')} ago**`;
}
function weeksNote(days: number): string {
  const a = Math.abs(days);
  if (a < 14) return '';
  const w = Math.floor(a / 7), r = a % 7;
  return ` (about ${plural(w, 'week')}${r ? ` and ${plural(r, 'day')}` : ''})`;
}

const UNIT_DAYS: Record<string, number> = { day: 1, days: 1, week: 7, weeks: 7, fortnight: 14, fortnights: 14, month: 30, months: 30, year: 365, years: 365 };

export function tryDates(input: string, now: Date = new Date()): DateAnswer | null {
  const s = input.toLowerCase().replace(/[?!.]+$/g, '').replace(/\s+/g, ' ').trim();
  if (!s || s.length > 140) return null;
  let m: RegExpExecArray | null;

  // "how many days left this year / in this month"
  if ((m = /\b(?:how many )?(days|weeks) (?:are )?(?:left|remaining|remain)(?: in| this| of)?(?: this| the)? (year|month)\b/.exec(s)) || (m = /\bdays (?:left )?(?:in|of) (?:this|the) (year|month)\b/.exec(s))) {
    const unit = m[m.length - 1];
    const end = unit === 'year' ? new Date(now.getFullYear(), 11, 31) : new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const left = daysBetween(now, end);
    return {
      human: `There ${left === 1 ? 'is' : 'are'} **${plural(left, 'day')}** left this ${unit} (until ${long(end)}). 📅`,
      expert: `DATE // ${left} days remaining this ${unit}.`,
    };
  }
  // "how many days in february / in 2028"
  if ((m = new RegExp(`\\bhow many days (?:are )?(?:there )?in (${MONTHS.join('|')})(?: (\\d{4}))?\\b`).exec(s))) {
    const mi = MONTHS.indexOf(m[1]), y = m[2] ? +m[2] : now.getFullYear();
    const n = new Date(y, mi + 1, 0).getDate();
    return { human: `${m[1][0].toUpperCase() + m[1].slice(1)} ${y} has **${n} days**. 📅`, expert: `DATE // ${m[1]} ${y}: ${n} days.` };
  }
  if ((m = /\b(?:is|was) (\d{4}) a leap year\b/.exec(s)) || (m = /\bleap year (\d{4})\b/.exec(s))) {
    const y = +m[1], leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    return { human: `${y} ${leap ? 'is' : "isn't"} a leap year${leap ? ' (366 days)' : ' (365 days)'}. 📅`, expert: `DATE // ${y} leap: ${leap}.` };
  }
  // "N days/weeks from now", "in N weeks what date", "date 90 days ago"
  if ((m = /\b(\d{1,4}) (days?|weeks?|fortnights?|months?|years?) (from now|from today|ahead|later)\b/.exec(s)) || (m = /\bin (\d{1,4}) (days?|weeks?|fortnights?|months?|years?)\b.*\b(date|day)\b/.exec(s)) || (m = /\b(?:date|day) (?:in )?(\d{1,4}) (days?|weeks?|fortnights?|months?|years?)(?: from now)?$/.exec(s))) {
    const n = +m[1], unit = m[2];
    const d = /month/.test(unit) ? new Date(now.getFullYear(), now.getMonth() + n, now.getDate()) : /year/.test(unit) ? new Date(now.getFullYear() + n, now.getMonth(), now.getDate()) : new Date(now.getFullYear(), now.getMonth(), now.getDate() + n * UNIT_DAYS[unit]);
    return { human: `${plural(n, unit.replace(/s$/, ''))} from today is **${long(d)}**. 📅`, expert: `DATE // +${n} ${unit} = ${long(d)}.` };
  }
  if ((m = /\b(\d{1,4}) (days?|weeks?|fortnights?|months?|years?) ago\b/.exec(s))) {
    const n = +m[1], unit = m[2];
    const d = /month/.test(unit) ? new Date(now.getFullYear(), now.getMonth() - n, now.getDate()) : /year/.test(unit) ? new Date(now.getFullYear() - n, now.getMonth(), now.getDate()) : new Date(now.getFullYear(), now.getMonth(), now.getDate() - n * UNIT_DAYS[unit]);
    return { human: `${plural(n, unit.replace(/s$/, ''))} ago was **${long(d)}**. 📅`, expert: `DATE // -${n} ${unit} = ${long(d)}.` };
  }

  // countdown / days since
  const until = /\b(?:how many |how much )?(days?|weeks?|months?|sleeps?) (?:are )?(?:left |remaining )?(?:until|till|til|to|before|before the|left until|left till|left to)\b(.*)$/.exec(s) || /\bhow long (?:until|till|til|to|before)\b(.*)$/.exec(s) || /\bcountdown (?:to|until|for)\b(.*)$/.exec(s);
  if (until) {
    const tail = until[until.length - 1];
    const t = parseTarget(tail, now);
    if (t) {
      const days = daysBetween(now, t.date);
      const named = t.label !== long(t.date) && !['today', 'tomorrow', ...DAYS.map((d) => d[0].toUpperCase() + d.slice(1))].includes(t.label);
      return {
        human: `${named ? `**${t.label}** (${long(t.date)}) is ` : `**${long(t.date)}** is `}${phraseFor(days)}${weeksNote(days)}. ⏳`,
        expert: `DATE // ${t.label}: ${days} days (${t.date.toISOString().slice(0, 10)}).`,
      };
    }
  }
  const since = /\b(?:how many |how much )?(days?|weeks?|months?) (?:has it been )?(?:since|after)\b(.*)$/.exec(s) || /\bhow long (?:since|ago was)\b(.*)$/.exec(s);
  if (since) {
    const t = parseTarget(since[since.length - 1], now);
    if (t && (t.explicitYear || daysBetween(now, t.date) <= 0)) {
      const days = daysBetween(t.date, now);
      if (days >= 0) return { human: `It's been **${plural(days, 'day')}** since ${t.label}${weeksNote(days)}. ⏳`, expert: `DATE // ${days} days since ${t.label}.` };
    }
  }
  // "what day is 25 dec 2026" / "what day of the week is ..." / "when is christmas"
  if ((m = /\b(?:what day(?: of the week)?|which day|what weekday)\b.*?\b(?:is|was|will be|falls on|fall on)\b(.*)$/.exec(s)) || (m = /\bwhen (?:is|are|was)\b(.*)$/.exec(s))) {
    const t = parseTarget(m[1], now);
    if (t && (NAMED.some((h) => h.names.test(m![1])) || /\d/.test(m![1]))) {
      const days = daysBetween(now, t.date);
      return { human: `**${t.label === long(t.date) ? long(t.date) : `${t.label} — ${long(t.date)}`}** (${phraseFor(days)}). 📅`, expert: `DATE // ${long(t.date)}.` };
    }
  }
  return null;
}
