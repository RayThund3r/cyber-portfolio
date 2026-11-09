// src/components/chat/HandoffCard.tsx
//
// "Send this to the owner". The visitor sees exactly what will be sent and nothing leaves the
// browser until they press SEND. Works with or without files, and with or without an AI model.
'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import Turnstile, { turnstileEnabled } from '@/components/Turnstile';
import { ATTACH } from '@/lib/attachmentRules';
import { fileToBase64 } from '@/lib/fileEncode';
import type { Message } from '@/utils/chatEngine/types';
import type { SharedFile } from './useAttachments';

export function buildTranscript(messages: Message[]): string {
  const lines = messages
    .filter((m) => m.id !== 'welcome' && m.text.trim())
    .slice(-20)
    .map((m) => `${m.sender === 'user' ? 'Visitor' : 'Assistant'}: ${m.text.replace(/\s+/g, ' ').trim().slice(0, 500)}`);
  let out = lines.join('\n');
  while (out.length > 7800 && lines.length > 1) {
    lines.shift();
    out = lines.join('\n');
  }
  return out.slice(-7800);
}

interface Props {
  files: SharedFile[];
  messages: Message[];
  prefill: string;
  expert: boolean;
  onCancel: () => void;
  onSent: (summary: string) => void;
}

export default function HandoffCard({ files, messages, prefill, expert, onCancel, onSent }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [note, setNote] = useState(prefill);
  const [website, setWebsite] = useState(''); // honeypot
  const [withChat, setWithChat] = useState(true);
  const [chosen, setChosen] = useState<Record<string, boolean>>({});
  const [state, setState] = useState<'idle' | 'sending' | 'error'>('idle');
  const [error, setError] = useState('');
  const [tsToken, setTsToken] = useState(''); // Cloudflare check (only when configured)
  const onTsToken = useCallback((t: string) => setTsToken(t), []);

  const nameRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    nameRef.current?.focus({ preventScroll: true });
    // Wait for the list's own scroll-to-bottom and the card's entrance animation to settle, then make
    // sure the whole card is on screen (it can be taller than the free space on a phone).
    const t = window.setTimeout(() => formRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 420);
    return () => window.clearTimeout(t);
  }, []);

  const picked = files.filter((f) => chosen[f.insight.id] !== false).slice(0, ATTACH.maxFiles);
  const transcript = withChat ? buildTranscript(messages) : '';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (state === 'sending') return;
    if (!note.trim() && !transcript && !picked.length) {
      setState('error');
      setError('Add a message, the chat or a file so there is something to send.');
      return;
    }
    if (turnstileEnabled && !tsToken) {
      setState('error');
      setError('Please complete the verification first.');
      return;
    }
    setState('sending');
    setError('');
    try {
      const attachments = await Promise.all(picked.map(async (f) => ({ name: f.insight.name, data: await fileToBase64(f.file) })));
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          formType: 'CHAT',
          serviceType: 'Chat hand-off',
          details: note.trim() || '(No extra message. See the chat transcript / files.)',
          transcript,
          attachments,
          website,
          turnstile: tsToken,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Could not send. Please try again.');
      onSent(
        `Sent to the owner ✅${picked.length ? ` (${picked.length} file${picked.length > 1 ? 's' : ''} included)` : ''}. They'll reply to ${email.trim()}.`
      );
    } catch (err) {
      setState('error');
      setError(err instanceof Error ? err.message : 'Could not send. Please try again.');
    }
  };

  const field = 'min-h-11 w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 focus:border-accent/60 focus:outline-none';

  return (
    <form ref={formRef} onSubmit={submit} className="space-y-2 rounded-lg border border-accent/40 bg-zinc-900/80 p-3 font-sans text-xs" aria-label="Send to the owner">
      <p className="font-mono text-[11px] font-bold text-accent">{expert ? 'DISPATCH // SEND_TO_OWNER' : '📨 Send to the owner'}</p>

      <input ref={nameRef} className={field} type="text" required maxLength={120} placeholder="Your name" aria-label="Your name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
      <input className={field} type="email" required maxLength={200} placeholder="Your email (so they can reply)" aria-label="Your email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <textarea className={`${field} min-h-20 resize-y`} maxLength={4000} placeholder="Anything you'd like to add (optional)" aria-label="Message" value={note} onChange={(e) => setNote(e.target.value)} />

      {/* honeypot: hidden from people and assistive tech */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>Website<input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} /></label>
      </div>

      <fieldset className="space-y-1.5 rounded border border-zinc-800 p-2">
        <legend className="px-1 font-mono text-[10px] text-zinc-500">INCLUDE</legend>
        <label className="flex min-h-8 cursor-pointer items-center gap-2 text-zinc-300">
          <input type="checkbox" checked={withChat} onChange={(e) => setWithChat(e.target.checked)} className="accent-[var(--accent)]" />
          This conversation (text only)
        </label>
        {files.map((f) => (
          <label key={f.insight.id} className="flex min-h-8 cursor-pointer items-center gap-2 text-zinc-300">
            <input type="checkbox" checked={chosen[f.insight.id] !== false} onChange={(e) => setChosen((c) => ({ ...c, [f.insight.id]: e.target.checked }))} className="accent-[var(--accent)]" />
            <span className="truncate">{f.insight.name}</span>
          </label>
        ))}
      </fieldset>

      {turnstileEnabled && <Turnstile onToken={onTsToken} />}

      {state === 'error' && <p role="alert" className="text-amber-400">{error}</p>}

      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="min-h-11 flex-1 cursor-pointer rounded border border-zinc-700 font-mono text-xs text-zinc-300 hover:bg-zinc-800">CANCEL</button>
        <button type="submit" disabled={state === 'sending'} className="min-h-11 flex-1 cursor-pointer rounded bg-accent-strong font-mono text-xs font-bold text-black hover:bg-accent disabled:cursor-wait disabled:opacity-60">
          {state === 'sending' ? 'SENDING…' : 'SEND'}
        </button>
      </div>
      <p className="font-mono text-[10px] text-zinc-600">Nothing is sent until you press SEND.</p>
    </form>
  );
}
