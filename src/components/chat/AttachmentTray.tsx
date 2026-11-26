// src/components/chat/AttachmentTray.tsx
// Files chosen but not yet sent: chips (tap to preview), what happened to them (read, optimised), one-tap questions, and problems.
'use client';

import { useState } from 'react';
import { formatBytes } from '@/lib/attachmentRules';
import { quickAsks } from '@/utils/chatEngine/fileInsights';
import type { FileInsight } from '@/utils/chatEngine/types';
import type { SharedFile } from './useAttachments';
import ImageLightbox from './ImageLightbox';

const ICON_PATH = { image: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M9 9h.01', pdf: 'M6 3h8l4 4v14H6zM14 3v4h4', text: 'M6 3h8l4 4v14H6zM9 12h6M9 16h6', doc: 'M6 3h8l4 4v14H6zM9 12h6M9 16h4' } as const;

export function FileChip({ name, size, kind, previewUrl, onRemove, onOpen }: { name: string; size: number; kind: 'image' | 'pdf' | 'text' | 'doc'; previewUrl?: string; onRemove?: () => void; onOpen?: () => void }) {
  const body = (
    <>
      {previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={previewUrl} alt="" className="h-5 w-5 rounded-sm object-cover" />
      ) : (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 text-zinc-400"><path d={ICON_PATH[kind]} /></svg>
      )}
      <span className="max-w-[9rem] truncate" title={name}>{name}</span>
      <span className="text-zinc-500">{formatBytes(size)}</span>
    </>
  );
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-white/10 bg-zinc-900 py-1 pl-2 pr-1 font-sans text-[11px] text-zinc-300">
      {onOpen ? (
        <button type="button" onClick={onOpen} aria-label={`Preview ${name}`} className="inline-flex min-w-0 cursor-pointer items-center gap-1.5 hover:text-accent">{body}</button>
      ) : (
        body
      )}
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label={`Remove ${name}`} className="hit flex h-5 w-5 cursor-pointer items-center justify-center rounded text-zinc-500 hover:text-zinc-100">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      )}
    </span>
  );
}

function Preview({ f, onClose }: { f: SharedFile; onClose: () => void }) {
  const i: FileInsight = f.insight;
  if (i.kind === 'image' && f.previewUrl) return <ImageLightbox src={f.previewUrl} onClose={onClose} />;
  return (
    <div role="dialog" aria-modal="true" aria-label={`Preview of ${i.name}`} className="absolute inset-0 z-40 flex flex-col bg-zinc-950/95 p-4" onClick={onClose}>
      <div className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col rounded-xl border border-zinc-700 bg-zinc-900 p-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-mono text-xs text-zinc-100">{i.name}</p>
            <p className="font-mono text-[10px] text-zinc-500">{i.summary}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close preview" className="flex min-h-9 min-w-9 cursor-pointer items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-100">✕</button>
        </div>
        {i.excerpt ? (
          <pre className="mt-2 min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-zinc-950 p-2.5 font-mono text-[11px] leading-relaxed text-zinc-300">{i.excerpt}</pre>
        ) : (
          <p className="mt-3 text-xs text-zinc-500">PDFs can’t be shown here, but the owner can open it if you send it.</p>
        )}
      </div>
    </div>
  );
}

export default function AttachmentTray({
  pending,
  shared = [],
  onRemoveShared,
  error,
  busy,
  status,
  onRemove,
  onDismissError,
  onAsk,
  onReadText,
}: {
  pending: SharedFile[];
  /** Files already sent in this chat (still known to the assistant). */
  shared?: SharedFile[];
  onRemoveShared?: (id: string) => void;
  error: string | null;
  busy: boolean;
  status?: string | null;
  onRemove: (id: string) => void;
  onDismissError: () => void;
  onAsk?: (text: string) => void;
  /** Read the text in a picture (on request). */
  onReadText?: (id: string) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  if (!pending.length && !error && !busy && !shared.length) return null;
  const last = pending[pending.length - 1];
  const asks = last ? quickAsks(last.insight) : [];
  const previewing = pending.find((f) => f.insight.id === open);
  return (
    <div className="border-t border-white/5 bg-zinc-950 px-3 pt-2">
      {shared.length > 0 && onRemoveShared && (
        <div className="flex flex-wrap items-center gap-1.5 pb-1" aria-label="Files the assistant is using">
          <span className="font-mono text-[10px] text-zinc-500">In this chat:</span>
          {shared.map((f) => (
            <FileChip key={f.insight.id} name={f.insight.name} size={f.insight.size} kind={f.insight.kind} previewUrl={f.previewUrl} onRemove={() => onRemoveShared(f.insight.id)} />
          ))}
        </div>
      )}
      {busy && <p className="pb-1 font-mono text-[10px] text-zinc-500" role="status">{status || 'Reading file…'}</p>}
      {pending.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pb-1" aria-label="Files ready to send">
          {pending.map((f) => (
            <FileChip key={f.insight.id} name={f.insight.name} size={f.insight.size} kind={f.insight.kind} previewUrl={f.previewUrl} onOpen={() => setOpen(f.insight.id)} onRemove={() => onRemove(f.insight.id)} />
          ))}
        </div>
      )}
      {pending.some((f) => f.insight.note) && (
        <p className="pb-1 font-mono text-[10px] text-emerald-400/80" role="status">{pending.filter((f) => f.insight.note).map((f) => f.insight.note).join(' · ')}</p>
      )}
      {onReadText && pending.some((f) => f.insight.kind === 'image' && !f.insight.text) && (
        <div className="pb-1.5">
          <button type="button" disabled={busy} onClick={() => onReadText(pending.filter((f) => f.insight.kind === 'image' && !f.insight.text).slice(-1)[0].insight.id)} className="min-h-8 cursor-pointer rounded-full border border-zinc-600 bg-zinc-800 px-2.5 font-sans text-[11px] text-zinc-200 hover:border-accent/60 disabled:opacity-50">
            Read the text in this picture
          </button>
          <span className="ml-2 font-mono text-[10px] text-zinc-600">Runs on your device; the first time it may download a small reading tool.</span>
        </div>
      )}
      {asks.length > 0 && onAsk && (
        <div className="flex flex-wrap gap-1.5 pb-1.5" aria-label="Ask about this file">
          {asks.map((t) => (
            <button key={t} type="button" onClick={() => onAsk(t)} className="min-h-8 cursor-pointer rounded-full border border-accent/40 bg-accent/10 px-2.5 font-sans text-[11px] text-accent hover:bg-accent/20">
              {t}
            </button>
          ))}
        </div>
      )}
      {error && (
        <p role="alert" className="flex items-start justify-between gap-2 pb-1 text-[11px] text-amber-400">
          <span>{error}</span>
          <button type="button" onClick={onDismissError} aria-label="Dismiss" className="cursor-pointer text-zinc-500 hover:text-zinc-200">✕</button>
        </p>
      )}
      {pending.length > 0 && <p className="pb-1 font-mono text-[10px] text-zinc-600">The assistant reads the text of attached files to answer you (sensitive numbers are masked). Don’t attach IDs or passwords.</p>}
      {previewing && <Preview f={previewing} onClose={() => setOpen(null)} />}
    </div>
  );
}
