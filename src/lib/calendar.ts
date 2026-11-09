// src/lib/calendar.ts
//
// "Add to calendar" for a booked repair visit: builds a standard .ics file (works with Apple, Google
// and Outlook calendars) in the browser. Booking times are Africa/Kampala (UTC+3, no daylight saving).

const pad = (n: number) => String(n).padStart(2, '0');
const stamp = (d: Date) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

export function buildIcs(o: { title: string; date: string; time: string; minutes?: number; description?: string; location?: string; uid?: string }): string | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(o.date);
  const t = /^(\d{1,2}):(\d{2})$/.exec(o.time);
  if (!d || !t) return null;
  const start = new Date(Date.UTC(+d[1], +d[2] - 1, +d[3], +t[1] - 3, +t[2]));
  if (Number.isNaN(start.getTime())) return null;
  const end = new Date(start.getTime() + (o.minutes ?? 60) * 60000);
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//System Portfolio//Booking//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${o.uid || `${start.getTime()}@system-portfolio`}`,
    `DTSTAMP:${stamp(new Date())}`, `DTSTART:${stamp(start)}`, `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(o.title)}`,
    ...(o.description ? [`DESCRIPTION:${esc(o.description)}`] : []),
    ...(o.location ? [`LOCATION:${esc(o.location)}`] : []),
    'BEGIN:VALARM', 'TRIGGER:-PT60M', 'ACTION:DISPLAY', 'DESCRIPTION:Repair visit in 1 hour', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
}

export function downloadIcs(filename: string, ics: string) {
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
