// src/utils/chatEngine/fileAdvice.ts
//
// Turns what was read from a shared file into HELP: diagnoses error logs and crash screens, pulls the money, dates and
// reference numbers out of invoices/quotes, recognises a design/website brief, and says what to do next.
// Deterministic and local (no model). Everything it reports is found in the file; advice text is fixed and generic.
import type { FileInsight } from './types';

interface ErrRule { re: RegExp; label: string; meaning: string; next: string }

const ERRORS: ErrRule[] = [
  { re: /no space left on device|ENOSPC|disk (?:is )?full|insufficient disk space/i, label: 'Disk full', meaning: 'the drive has run out of space.', next: 'Free space (empty the recycle bin, uninstall unused apps, move photos/videos off). Keep 15%+ free.' },
  { re: /permission denied|EACCES|access is denied|not permitted|EPERM/i, label: 'Permission denied', meaning: 'the program was not allowed to read or write something.', next: 'Run it as administrator (or fix the file/folder permissions). If it is a phone app, check its permissions in Settings.' },
  { re: /ECONNREFUSED|connection refused/i, label: 'Connection refused', meaning: 'nothing was listening where the program tried to connect.', next: 'Check the service/server is running and the address and port are right.' },
  { re: /ETIMEDOUT|timed? ?out|timeout/i, label: 'Timeout', meaning: 'something took too long to answer.', next: 'Check the internet connection and try again; if it repeats, the server or network is the problem.' },
  { re: /ENOTFOUND|getaddrinfo|could not resolve host|dns[_ ]probe|name or service not known/i, label: 'Address not found (DNS)', meaning: 'the website or server name could not be looked up.', next: 'Check the spelling of the address and your internet/DNS; try another network.' },
  { re: /\b404\b.{0,20}not found|not found \(404\)/i, label: '404 Not Found', meaning: 'the page or file asked for does not exist at that address.', next: 'Fix the link/path or restore the missing page.' },
  { re: /\b40[13]\b.{0,20}(?:unauthori[sz]ed|forbidden)|unauthori[sz]ed|forbidden/i, label: 'Not authorised (401/403)', meaning: 'the login or key was missing, wrong or not allowed.', next: 'Check the password/API key and the account permissions.' },
  { re: /\b50[023]\b.{0,25}(?:error|bad gateway|unavailable)|internal server error|bad gateway|service unavailable/i, label: 'Server error (5xx)', meaning: 'the server failed while handling the request.', next: 'Look at the server logs; if it is someone else’s site, wait and retry.' },
  { re: /out of memory|OOM|heap out of memory|JavaScript heap|memory allocation failed|MemoryError/i, label: 'Out of memory', meaning: 'the program needed more RAM than was available.', next: 'Close other programs, restart, and consider more RAM or a lighter task.' },
  { re: /cannot find module|module not found|ModuleNotFoundError|No module named|package .* not found/i, label: 'Missing module/package', meaning: 'a library the code needs is not installed.', next: 'Install the missing package (npm install / pip install) and check the name.' },
  { re: /SyntaxError|unexpected token|unexpected end of (?:input|json)|parse error/i, label: 'Syntax error', meaning: 'the code or data is not written in valid form (often a stray comma, bracket or quote).', next: 'Look at the line number shown and check brackets, quotes and commas around it.' },
  { re: /CORS|cross-origin/i, label: 'CORS blocked', meaning: 'the browser blocked a request to another website that did not allow it.', next: 'Allow the origin on the server, or call it from your own server.' },
  { re: /certificate|SSL|TLS|ERR_CERT/i, label: 'Certificate / HTTPS problem', meaning: 'the secure connection could not be trusted.', next: 'Check the device date and time first, then the site’s certificate.' },
  { re: /KERNEL_DATA_INPAGE_ERROR|INACCESSIBLE_BOOT_DEVICE|disk read error|boot device not found|no bootable device|operating system not found|missing operating system/i, label: 'Drive or boot failure', meaning: 'Windows could not read the drive it starts from. This is often a failing or disconnected drive.', next: 'Do not keep forcing restarts; back up if you can and have the drive tested. A repair or SSD replacement is usually needed.' },
  { re: /CRITICAL_PROCESS_DIED|IRQL_NOT_LESS_OR_EQUAL|SYSTEM_SERVICE_EXCEPTION|PAGE_FAULT_IN_NONPAGED_AREA|MEMORY_MANAGEMENT|DRIVER_IRQL|BAD_POOL_HEADER|blue screen|bsod/i, label: 'Windows blue-screen (BSOD)', meaning: 'Windows crashed, usually from a faulty driver, bad RAM or a failing drive.', next: 'Note the stop code, update or roll back recent drivers, run Windows Memory Diagnostic, and check the drive’s health.' },
  { re: /DPC_WATCHDOG_VIOLATION|clock_watchdog/i, label: 'Watchdog timeout', meaning: 'a driver or the SSD stopped responding in time.', next: 'Update storage and chipset drivers and the SSD firmware.' },
  { re: /reallocated sector|pending sector|uncorrectable sector|bad sector|S\.?M\.?A\.?R\.?T\.?.{0,30}(?:bad|fail|caution)|SMART.{0,30}(?:bad|fail|caution)/i, label: 'Drive is wearing out (SMART)', meaning: 'the drive reports bad or failing sectors.', next: 'Back up important files now and plan to replace the drive.' },
  { re: /thermal throttl|overheat|temperature (?:is )?(?:too )?high|CPU temp.{0,10}(?:9\d|1\d\d)/i, label: 'Overheating', meaning: 'the processor is too hot and slowing itself down.', next: 'Clean the vents/fan, replace the thermal paste, and use the laptop on a hard surface.' },
  { re: /battery (?:health|wear|capacity).{0,30}(?:\d{1,2}%)|wear level|replace battery|service battery/i, label: 'Battery wear', meaning: 'the battery holds much less charge than when new.', next: 'If health is below about 80%, replacing the battery is the fix. Swelling is a safety issue.' },
  { re: /deprecat/i, label: 'Deprecation warning', meaning: 'something still works but is going away in a future version.', next: 'Not urgent; plan to update that part of the code.' },
];

const MONEY = /(?:UGX|USh|Ush|UShs|KES|KSh|USD|US\$|\$|€|£)\s?\d[\d,]*(?:\.\d+)?|\d[\d,]*(?:\.\d+)?\s?(?:UGX|USD|shillings)/g;
const DATE = /\b(?:\d{1,2}(?:st|nd|rd|th)?\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?,?\s+\d{4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}|\d{4}-\d{2}-\d{2}|\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})\b/gi;

const uniq = <T,>(a: T[]) => [...new Set(a)];
const amountNum = (s: string) => Number(s.replace(/[^\d.]/g, '')) || 0;

export interface Advice {
  kind: 'errors' | 'invoice' | 'brief' | 'image' | 'data' | 'other';
  title: string;
  lines: string[];
  next: string[];
  asks: string[];
  handoff?: 'repair' | 'design';
}

export function diagnose(text: string): { label: string; meaning: string; next: string; sample: string }[] {
  const out: { label: string; meaning: string; next: string; sample: string }[] = [];
  const lines = text.split(/\r?\n/);
  for (const r of ERRORS) {
    const hit = lines.find((l) => r.re.test(l));
    if (hit) out.push({ label: r.label, meaning: r.meaning, next: r.next, sample: hit.trim().replace(/[\[\]*_`<>]/g, '').slice(0, 130) });
    if (out.length >= 4) break;
  }
  return out;
}

export function moneyFacts(text: string) {
  const amounts = uniq(text.match(MONEY) || []).slice(0, 12);
  const totalLine = text.split(/\r?\n/).find((l) => /\b(?:grand )?total\b|amount due|balance due|total due/i.test(l) && MONEY.test(l.replace(MONEY, (m) => m) ) && (l.match(MONEY) || []).length);
  MONEY.lastIndex = 0;
  const total = totalLine ? (totalLine.match(MONEY) || []).pop() : undefined;
  const ref = /\b(?:invoice|inv|receipt|quote|quotation|order|ticket|ref(?:erence)?)\s*(?:no\.?|number|#|:)?\s*[:#]?\s*([A-Z0-9][A-Z0-9-]{2,})/i.exec(text)?.[1];
  const dates = uniq(text.match(DATE) || []).slice(0, 4);
  const dueLine = text.split(/\r?\n/).find((l) => /\bdue\b|deadline|pay by|valid until/i.test(l) && DATE.test(l));
  DATE.lastIndex = 0;
  const due = dueLine ? (dueLine.match(DATE) || [])[0] : undefined;
  DATE.lastIndex = 0;
  const kind = /\binvoice\b/i.test(text) ? 'invoice' : /\breceipt\b/i.test(text) ? 'receipt' : /\bquot(?:e|ation)\b/i.test(text) ? 'quotation' : '';
  return { amounts, total, ref, dates, due, kind };
}

export function adviseFile(f: FileInsight): Advice | null {
  const text = f.text || f.excerpt || '';
  if (f.kind === 'image' && !(f.text && f.text.length >= 20)) {
    const poor = (f.imageNotes || []).some((n) => /blurry|dark/.test(n));
    return {
      kind: 'image', title: 'About this picture',
      lines: [poor ? 'It looks blurry or dark, so details may be hard to see.' : 'I can tell its size and main colours, but I can’t read what is in it.'],
      next: ['If it shows a damaged phone or laptop, I can pass it to the owner with a repair booking.', 'If it is a design to change, send it with a short note of what you want.'],
      asks: ['Book a repair', 'Send this to the owner'], handoff: 'repair',
    };
  }
  if (text.length < 20) return null;

  const errs = diagnose(text);
  const ext = /\.([a-z0-9]+)$/i.exec(f.name)?.[1]?.toLowerCase() || '';
  if (errs.length && (ext === 'log' || /error|exception|fail|stop code|crash|warning|denied/i.test(text.slice(0, 20000)))) {
    return {
      kind: 'errors', title: 'What I can see in the errors',
      lines: errs.map((e) => `**${e.label}**: ${e.meaning} (“${e.sample}”)`),
      next: errs.map((e) => e.next),
      asks: ['How do I fix this?', 'Send this to the owner'], handoff: /boot|drive|blue-screen|SMART|Overheating|Battery/.test(errs.map((e) => e.label).join()) ? 'repair' : undefined,
    };
  }
  const m = moneyFacts(text);
  if (m.kind || (m.total && m.amounts.length >= 2)) {
    const lines: string[] = [];
    if (m.kind) lines.push(`It looks like a **${m.kind}**${m.ref ? `, reference **${m.ref}**` : ''}.`);
    if (m.total) lines.push(`Total I can see: **${m.total}**.`);
    if (m.due) lines.push(`Due/deadline date: **${m.due}**.`);
    else if (m.dates.length) lines.push(`Dates in it: ${m.dates.join(', ')}.`);
    if (m.amounts.length) lines.push(`Amounts mentioned: ${m.amounts.slice(0, 6).join(', ')}.`);
    return { kind: 'invoice', title: 'Money and dates in this file', lines, next: ['Check the figures against the original before paying anything.', 'Pay mobile-money amounts only to the number you have verified.'], asks: ['What is the total?', 'When is it due?', 'Send this to the owner'] };
  }
  const brief = (text.toLowerCase().match(/\b(logo|brand(?:ing)?|website|web ?site|app|design|requirements?|scope|deliverables?|budget|deadline|brief|colou?rs?|pages?|features?)\b/g) || []).length;
  if (brief >= 4 && ['docx', 'pdf', 'txt', 'md'].includes(ext || 'pdf')) {
    return { kind: 'brief', title: 'This reads like a project brief', lines: ['It talks about design/website requirements, so the owner can quote from it directly.'], next: ['Send it to the owner so they can reply with a price and timeline.', 'Tell me the budget and deadline and I’ll include them.'], asks: ['Send this to the owner', 'How much would this cost?'], handoff: 'design' };
  }
  return null;
}

/** Specific questions about errors, money and next steps, answered from the file. null when not that kind of question. */
export function adviceAnswer(files: FileInsight[], raw: string): string | null {
  const q = raw.toLowerCase();
  const docs = [...files].reverse().filter((f) => (f.text && f.text.length > 20) || f.kind === 'image');
  if (!docs.length) return null;
  const wantsFix = /\b(what'?s wrong|what is wrong|fix|diagnos|why (?:is|does|did)|what (?:does|do) (?:this|it|these) (?:error|mean)|explain (?:the )?error|any errors?|any problems?|troubleshoot|help me with (?:this|it))\b/.test(q);
  const wantsMoney = /\b(total|how much|amount|price|cost|invoice number|reference|when is it due|due date|deadline|pay by)\b/.test(q);
  const f = docs[0];
  if (!f.text) return null;
  if (wantsFix) {
    const errs = diagnose(f.text);
    if (errs.length) return `Here's what I can see in **${f.name}**:\n${errs.map((e) => `- **${e.label}**: ${e.meaning}\n  Try: ${e.next}`).join('\n')}\n\nIf it keeps happening I can pass it to the owner.`;
  }
  if (wantsMoney) {
    const m = moneyFacts(f.text);
    if (/\b(total|how much|amount)\b/.test(q) && m.total) return `The total I can see in **${f.name}** is **${m.total}**${m.amounts.length > 1 ? ` (other amounts: ${m.amounts.filter((a) => a !== m.total).slice(0, 4).join(', ')})` : ''}.`;
    if (/\b(due|deadline|pay by)\b/.test(q) && (m.due || m.dates.length)) return `I can see **${m.due || m.dates[0]}** in **${f.name}**${m.due ? ' as the due date' : ''}.`;
    if (/\b(invoice number|reference)\b/.test(q) && m.ref) return `The reference in **${f.name}** is **${m.ref}**.`;
    if (/\b(total|amount|how much|price|cost)\b/.test(q) && m.amounts.length) return `I couldn't find a line marked “total”, but these amounts appear in **${f.name}**: ${m.amounts.slice(0, 6).join(', ')}.`;
  }
  return null;
}

export const amountForTest = amountNum;
