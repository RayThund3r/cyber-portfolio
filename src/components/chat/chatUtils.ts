// src/components/chat/chatUtils.ts
// Small, pure helpers shared by the chat components (no React in here).

import type { Message } from '@/utils/chatEngine/types';

export const nowTime = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
export const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

/** "Today", "Yesterday" or a short date, for the separators between days. */
export function dayLabel(ts: number, now = Date.now()): string {
  const d = new Date(ts);
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((startOf(new Date(now)) - startOf(d)) / 86_400_000);
  if (diff <= 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
}

export function sameDay(a?: number, b?: number): boolean {
  if (!a || !b) return true; // unknown dates never produce a separator
  const x = new Date(a);
  const y = new Date(b);
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate();
}

/**
 * While a reply is being revealed, a half-written "**bold" or "`code" would flash as raw symbols.
 * Close any dangling markers on the partial text so it always renders cleanly.
 */
export function balanceMarkdown(partial: string): string {
  let out = partial;
  if ((out.match(/\*\*/g) || []).length % 2 === 1) out += '**';
  if ((out.match(/`/g) || []).length % 2 === 1) out += '`';
  // an unfinished [link](https://... must not show half a URL
  out = out.replace(/\[([^\]]*)\]\([^)]*$/, '$1');
  return out;
}

/** Plain-text version of a message (markdown markers removed) for copying / exporting. */
export function plainText(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\((https:\/\/[^)\s]+)\)/g, '$1 ($2)')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .trim();
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the legacy path */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function buildExport(messages: Message[], siteName = 'System Portfolio'): string {
  const head = `${siteName} — chat transcript\nExported ${new Date().toLocaleString()}\n${'-'.repeat(40)}\n`;
  const body = messages
    .filter((m) => m.id !== 'welcome' && (m.text.trim() || m.attachments?.length))
    .map((m) => {
      const who = m.sender === 'user' ? 'You' : 'Assistant';
      const files = m.attachments?.length ? `\n  [files: ${m.attachments.map((a) => a.name).join(', ')}]` : '';
      return `[${m.time || ''}] ${who}: ${plainText(m.text)}${files}`;
    })
    .join('\n\n');
  return head + body + '\n';
}

export function downloadText(filename: string, text: string): boolean {
  try {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch {
    return false;
  }
}

/** Remove everything that must not be saved (blob URLs, reveal flags). */
export function toSavable(messages: Message[]): Message[] {
  return messages.map((m) => {
    const { reveal: _r, ...rest } = m;
    return rest.attachments
      ? { ...rest, attachments: rest.attachments.map(({ previewUrl: _p, ...a }) => a) }
      : rest;
  });
}
