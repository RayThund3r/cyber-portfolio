// src/components/chat/RichText.tsx
//
// Small, safe markdown renderer for chat bubbles:
//   **bold**, `code`, [text](https://link), "- " / "• " bullets, "1." lists,
//   # headings, --- rules, ``` fenced code blocks (with a copy button) and | tables |.
// Everything is rendered as React nodes (never as HTML strings), and only https links are clickable.
// (Single-asterisk italics are deliberately NOT supported: "2*3*4" in a calculator answer must stay as typed.)
'use client';

import React, { useState } from 'react';

function renderInline(text: string) {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(https:\/\/[^)\s]+\))/g).map((p, i) => {
    const link = p.match(/^\[([^\]]+)\]\((https:\/\/[^)\s]+)\)$/);
    if (link) {
      return (
        <a key={i} href={link[2]} target="_blank" rel="noopener noreferrer" className="text-zinc-100 underline underline-offset-2 hover:text-white">
          {link[1]}
        </a>
      );
    }
    if (p.length > 4 && p.startsWith('**') && p.endsWith('**')) {
      return (
        <strong key={i} className="font-semibold text-zinc-50">
          {p.slice(2, -2)}
        </strong>
      );
    }
    if (p.length > 2 && p.startsWith('`') && p.endsWith('`')) {
      return (
        <code key={i} className="rounded bg-zinc-800 px-1 font-mono text-[0.85em]">
          {p.slice(1, -1)}
        </code>
      );
    }
    return <span key={i}>{p}</span>;
  });
}

type Block =
  | { t: 'blank' }
  | { t: 'hr' }
  | { t: 'heading'; text: string; level: number }
  | { t: 'bullet'; text: string }
  | { t: 'num'; n: string; text: string }
  | { t: 'code'; text: string }
  | { t: 'table'; head: string[]; rows: string[][] }
  | { t: 'p'; text: string };

const splitRow = (line: string) =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());
const isTableLine = (l: string) => /^\s*\|.*\|\s*$/.test(l);
const isSeparator = (l: string) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l) && l.includes('-');

export function parseBlocks(text: string): Block[] {
  const lines = text.split('\n');
  const out: Block[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (/^\s*```/.test(line)) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) body.push(lines[i++]);
      out.push({ t: 'code', text: body.join('\n').slice(0, 4000) });
      continue;
    }
    if (isTableLine(line) && i + 1 < lines.length && isSeparator(lines[i + 1])) {
      const head = splitRow(line).slice(0, 6);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && isTableLine(lines[i]) && rows.length < 30) rows.push(splitRow(lines[i++]).slice(0, 6));
      i--;
      out.push({ t: 'table', head, rows });
      continue;
    }
    if (!line.trim()) {
      out.push({ t: 'blank' });
      continue;
    }
    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
      out.push({ t: 'hr' });
      continue;
    }
    const h = line.match(/^\s{0,3}(#{1,3})\s+(.*)$/);
    if (h) {
      out.push({ t: 'heading', level: h[1].length, text: h[2] });
      continue;
    }
    const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
    if (bullet) {
      out.push({ t: 'bullet', text: bullet[1] });
      continue;
    }
    const num = line.match(/^\s*(\d+)[.)]\s+(.*)$/);
    if (num) {
      out.push({ t: 'num', n: num[1], text: num[2] });
      continue;
    }
    out.push({ t: 'p', text: line });
  }
  return out;
}

function CodeBlock({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard can be blocked; the text is still selectable */
    }
  };
  return (
    <div className="group relative my-1 overflow-hidden rounded-md border border-zinc-700/70 bg-zinc-950">
      <button
        type="button"
        onClick={copy}
        aria-label="Copy code"
        className="absolute right-1.5 top-1.5 min-h-7 cursor-pointer rounded border border-zinc-700 bg-zinc-900 px-2 font-mono text-[10px] text-zinc-400 transition-colors hover:text-accent"
      >
        {copied ? 'COPIED' : 'COPY'}
      </button>
      <pre className="overflow-x-auto p-3 pr-16 font-mono text-[11px] leading-relaxed text-zinc-200">
        <code>{text}</code>
      </pre>
    </div>
  );
}

export default function RichText({ text }: { text: string }) {
  const blocks = parseBlocks(text);
  return (
    <div className="space-y-0.5">
      {blocks.map((b, i) => {
        switch (b.t) {
          case 'blank':
            return <div key={i} className="h-1.5" />;
          case 'hr':
            return <hr key={i} className="my-1.5 border-zinc-700/70" />;
          case 'heading':
            return (
              <div key={i} className={`font-semibold text-zinc-50 ${b.level === 1 ? 'text-base' : 'text-[0.95em]'}`}>
                {renderInline(b.text)}
              </div>
            );
          case 'bullet':
            return (
              <div key={i} className="flex gap-1.5 pl-1">
                <span className="text-zinc-500">•</span>
                <span className="min-w-0">{renderInline(b.text)}</span>
              </div>
            );
          case 'num':
            return (
              <div key={i} className="flex gap-1.5 pl-1">
                <span className="tabular-nums text-zinc-500">{b.n}.</span>
                <span className="min-w-0">{renderInline(b.text)}</span>
              </div>
            );
          case 'code':
            return <CodeBlock key={i} text={b.text} />;
          case 'table':
            return (
              <div key={i} className="my-1.5 max-w-full overflow-x-auto rounded-md border border-zinc-700/70">
                <table className="w-full border-collapse text-left text-[0.92em]">
                  <thead>
                    <tr className="bg-zinc-800/70">
                      {b.head.map((c, j) => (
                        <th key={j} scope="col" className="whitespace-nowrap px-2 py-1.5 font-semibold text-zinc-100">
                          {renderInline(c)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.map((r, ri) => (
                      <tr key={ri} className="border-t border-zinc-800 align-top">
                        {r.map((c, j) => (
                          <td key={j} className={`px-2 py-1.5 ${j === 0 ? 'whitespace-nowrap text-zinc-300' : 'text-zinc-300'}`}>
                            {renderInline(c)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          default:
            return <div key={i}>{renderInline(b.text)}</div>;
        }
      })}
    </div>
  );
}
