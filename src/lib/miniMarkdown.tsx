// src/lib/miniMarkdown.tsx — a tiny, safe formatter for guide text. No HTML is ever injected: it builds React elements.
// Supported: "## Heading", "### Subheading", "- bullet" / "1. numbered", blank line = new paragraph, **bold**, [text](https://link).
import type { ReactNode } from 'react';
import { safeLink } from './safeText';

function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = []; const re = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g; let last = 0, m: RegExpExecArray | null, i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1]) out.push(<strong key={`${key}b${i++}`} className="font-semibold text-zinc-100">{m[1]}</strong>);
    else { const href = safeLink(m[3], 300); out.push(href ? <a key={`${key}a${i++}`} href={href} {...(href.startsWith('/') ? {} : { target: '_blank', rel: 'noopener noreferrer' })} className="text-accent underline underline-offset-2 hover:opacity-80">{m[2]}</a> : m[2]); }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function renderGuide(body: string): ReactNode[] {
  const blocks = body.replace(/\r/g, '').split(/\n{2,}/); const out: ReactNode[] = [];
  blocks.forEach((raw, bi) => {
    const lines = raw.split('\n').map((l) => l.trimEnd()).filter(Boolean); if (!lines.length) return;
    const k = `b${bi}`;
    if (/^###\s+/.test(lines[0]) && lines.length === 1) out.push(<h3 key={k} className="mt-6 text-lg font-bold text-zinc-100">{inline(lines[0].replace(/^###\s+/, ''), k)}</h3>);
    else if (/^##\s+/.test(lines[0]) && lines.length === 1) out.push(<h2 key={k} className="mt-9 text-xl font-bold text-zinc-100 sm:text-2xl">{inline(lines[0].replace(/^##\s+/, ''), k)}</h2>);
    else if (lines.every((l) => /^[-*]\s+/.test(l))) out.push(<ul key={k} className="mt-3 list-disc space-y-1.5 pl-5 text-zinc-300 marker:text-accent">{lines.map((l, i) => <li key={i}>{inline(l.replace(/^[-*]\s+/, ''), `${k}${i}`)}</li>)}</ul>);
    else if (lines.every((l) => /^\d+[.)]\s+/.test(l))) out.push(<ol key={k} className="mt-3 list-decimal space-y-1.5 pl-5 text-zinc-300 marker:text-accent">{lines.map((l, i) => <li key={i}>{inline(l.replace(/^\d+[.)]\s+/, ''), `${k}${i}`)}</li>)}</ol>);
    else out.push(<p key={k} className="mt-4 leading-relaxed text-zinc-300">{inline(lines.join(' '), k)}</p>);
  });
  return out;
}
