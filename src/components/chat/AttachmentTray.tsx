// src/components/chat/AttachmentTray.tsx
// Chips for files chosen but not yet sent, plus any problem message. Purely presentational.
'use client';

import { formatBytes } from '@/lib/attachmentRules';
import type { SharedFile } from './useAttachments';

const ICON = { image: '🖼️', pdf: '📄', text: '📝' } as const;

export function FileChip({ name, size, kind, previewUrl, onRemove }: { name: string; size: number; kind: 'image' | 'pdf' | 'text'; previewUrl?: string; onRemove?: () => void }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded border border-zinc-700 bg-zinc-900 py-1 pl-1.5 pr-1 font-mono text-[10px] text-zinc-300">
      {previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={previewUrl} alt="" className="h-5 w-5 rounded-sm object-cover" />
      ) : (
        <span aria-hidden>{ICON[kind]}</span>
      )}
      <span className="max-w-[9rem] truncate" title={name}>{name}</span>
      <span className="text-zinc-500">{formatBytes(size)}</span>
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label={`Remove ${name}`} className="touch-target flex cursor-pointer items-center justify-center rounded px-1 text-zinc-500 hover:text-zinc-100 sm:min-h-0 sm:min-w-0">
          ✕
        </button>
      )}
    </span>
  );
}

export default function AttachmentTray({ pending, error, busy, onRemove, onDismissError }: { pending: SharedFile[]; error: string | null; busy: boolean; onRemove: (id: string) => void; onDismissError: () => void }) {
  if (!pending.length && !error && !busy) return null;
  return (
    <div className="border-t border-zinc-800 bg-zinc-900/90 px-3 pt-2">
      {busy && <p className="pb-1 font-mono text-[10px] text-zinc-500" role="status">Reading file…</p>}
      {pending.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pb-1" aria-label="Files ready to send">
          {pending.map((f) => (
            <FileChip key={f.insight.id} name={f.insight.name} size={f.insight.size} kind={f.insight.kind} previewUrl={f.previewUrl} onRemove={() => onRemove(f.insight.id)} />
          ))}
        </div>
      )}
      {error && (
        <p role="alert" className="flex items-start justify-between gap-2 pb-1 text-[11px] text-amber-400">
          <span>{error}</span>
          <button type="button" onClick={onDismissError} aria-label="Dismiss" className="cursor-pointer text-zinc-500 hover:text-zinc-200">✕</button>
        </p>
      )}
      {pending.length > 0 && <p className="pb-1 font-mono text-[10px] text-zinc-600">Read on your device. Nothing is uploaded unless you press SEND in the “send to owner” card.</p>}
    </div>
  );
}
