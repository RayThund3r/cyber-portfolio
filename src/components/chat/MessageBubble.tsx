// src/components/chat/MessageBubble.tsx
//
// One message. Bot replies can be revealed progressively (tap to skip), show their source, and offer
// quick actions: copy, "why?" (the reasoning behind a guided answer), 👍/👎, retry. Screen readers get
// the complete text immediately (the typed text is aria-hidden) so they are never fed fragments.
'use client';

import { memo, useState } from 'react';
import type { Message } from '@/utils/chatEngine/types';
import RichText from './RichText';
import { FileChip } from './AttachmentTray';
import { SOURCE_BADGE } from './chatContent';
import { balanceMarkdown, copyText, plainText } from './chatUtils';
import { useTypewriter } from './useTypewriter';
import ImageLightbox from './ImageLightbox';
import ChatCards from './ChatCards';

interface Props {
  msg: Message;
  /** First message of a run from the same sender (shows the avatar / more spacing). */
  first: boolean;
  /** Last message of a run (shows the time). */
  last: boolean;
  /** Offer the actions row without needing hover (the newest bot message, and touch screens). */
  showActions: boolean;
  onRevealDone: (id: string) => void;
  onTick: () => void;
  onRate: (msg: Message, r: 'up' | 'down') => void;
  onRetry: (msg: Message) => void;
  onCard?: (text: string) => void;
  /** "Open Services →": the visitor asked about a page and gets a button to open it. */
  onNav?: (nav: { path: string; label: string }) => void;
  onToast: (t: string) => void;
}

function Bubble({ msg, first, last, showActions, onRevealDone, onTick, onRate, onRetry, onCard, onNav, onToast }: Props) {
  const isUser = msg.sender === 'user';
  const [why, setWhy] = useState(false);
  const [zoom, setZoom] = useState(false);

  const reveal = !isUser && !!msg.reveal && !msg.streaming;
  const tw = useTypewriter(msg.text, reveal, () => onRevealDone(msg.id), onTick);
  const shown = reveal ? tw.text : msg.text;
  const typing = reveal && tw.typing;

  const copy = async () => onToast((await copyText(plainText(msg.text))) ? 'Copied' : 'Could not copy');

  const badge = msg.source ? SOURCE_BADGE[msg.source] : undefined;
  const hasActions = !isUser && !msg.streaming && !typing && (msg.text.length > 0 || !!msg.retryText);

  return (
    <div className={`group/msg flex gap-2 ${isUser ? 'justify-end' : 'justify-start'} ${first ? 'mt-3' : 'mt-1'} animate-msg-in`}>
      {!isUser && (
        <div className="w-7 shrink-0 pt-0.5" aria-hidden="true">
          {first && <div className="flex h-7 w-7 items-center justify-center rounded-full border border-accent/40 bg-accent/10 font-mono text-[11px] text-accent">◈</div>}
        </div>
      )}

      <div className={`flex min-w-0 max-w-[86%] flex-col ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          onClick={typing ? tw.skip : undefined}
          title={typing ? 'Tap to show the full reply' : undefined}
          className={`break-words px-3.5 py-2.5 font-sans text-[13.5px] leading-relaxed shadow-sm sm:text-sm ${
            isUser
              ? `bg-gradient-to-br from-accent to-accent-strong font-medium text-black ${first ? 'rounded-2xl rounded-br-md' : 'rounded-2xl rounded-r-md'} ${last ? 'rounded-br-md' : ''}`
              : `border border-white/[0.07] bg-zinc-900/90 text-zinc-200 ${first ? 'rounded-2xl rounded-tl-md' : 'rounded-2xl rounded-l-md'} ${typing ? 'cursor-pointer' : ''}`
          }`}
        >
          {msg.attachments && msg.attachments.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1">
              {msg.attachments.map((a, i) => (
                <FileChip key={`${a.name}-${i}`} name={a.name} size={a.size} kind={a.kind} previewUrl={a.previewUrl} />
              ))}
            </div>
          )}

          {msg.imageUrl && (
            <button
              type="button"
              onClick={() => setZoom(true)}
              aria-label="View picture full size"
              className="mb-2 block w-full cursor-zoom-in overflow-hidden rounded-lg border border-white/10"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={msg.imageUrl}
                alt=""
                loading="lazy"
                onError={(e) => {
                  e.currentTarget.parentElement!.style.display = 'none';
                }}
                className="h-36 w-full object-cover transition-transform duration-300 hover:scale-[1.03]"
              />
            </button>
          )}
          {zoom && msg.imageUrl && <ImageLightbox src={msg.imageUrl} onClose={() => setZoom(false)} />}

          {isUser ? (
            <div className="whitespace-pre-wrap">{msg.text}</div>
          ) : (
            <>
              {typing || msg.streaming ? (
                <div aria-hidden="true">
                  <RichText text={balanceMarkdown(shown)} />
                  <span className="ml-0.5 inline-block h-3.5 w-1.5 translate-y-0.5 animate-pulse rounded-sm bg-accent/80" />
                </div>
              ) : (
                <RichText text={msg.text} />
              )}
              {(typing || msg.streaming) && <span className="sr-only">{msg.streaming ? 'Assistant is replying' : msg.text}</span>}
            </>
          )}
        </div>

        {!isUser && !typing && !msg.streaming && msg.nav && onNav && (
          <button
            type="button"
            onClick={() => onNav(msg.nav!)}
            className="mt-1 inline-flex min-h-8 cursor-pointer items-center gap-1 rounded border border-accent/40 bg-accent/10 px-2.5 py-1 font-mono text-[11px] text-accent transition-colors hover:bg-accent/20"
          >
            Open {msg.nav.label} →
          </button>
        )}
        {!isUser && !typing && !msg.streaming && msg.cards && msg.cards.length > 0 && onCard && <ChatCards cards={msg.cards} onPick={onCard} />}

        {msg.commandLabel && (
          <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 font-mono text-[10px] text-accent">
            ↗ {msg.commandLabel}
          </span>
        )}

        {why && msg.trace && msg.trace.length > 0 && (
          <div className="animate-msg-in mt-1.5 max-w-full rounded-xl border border-white/[0.07] bg-zinc-900/60 px-3 py-2 font-sans text-xs leading-relaxed text-zinc-400">
            <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-zinc-500">How I got here</p>
            <ul className="space-y-0.5">
              {msg.trace.map((t, i) => (
                <li key={i} className="flex gap-1.5">
                  <span className="text-accent/70">›</span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {(hasActions || last) && (
          <div
            className={`mt-0.5 flex flex-wrap items-center gap-x-0.5 px-1 font-mono text-[10px] text-zinc-600 ${isUser ? 'justify-end' : ''}`}
          >
            {last && (
              <span className="mr-1.5">
                {msg.time}
                {badge ? ` · ${badge}` : ''}
              </span>
            )}
            {hasActions && (
              <span
                className={`flex flex-wrap items-center gap-0.5 text-zinc-500 transition-opacity ${
                  showActions ? 'opacity-100' : 'opacity-0 focus-within:opacity-100 group-hover/msg:opacity-100 max-sm:opacity-100'
                }`}
              >
                {msg.id !== 'welcome' && (
                  <button type="button" onClick={copy} aria-label="Copy reply" className="flex min-h-8 cursor-pointer items-center rounded-lg px-2 hover:bg-white/5 hover:text-zinc-200">
                    Copy
                  </button>
                )}
                {msg.trace && msg.trace.length > 0 && (
                  <button type="button" onClick={() => setWhy((v) => !v)} aria-expanded={why} className="flex min-h-8 cursor-pointer items-center rounded-lg px-2 hover:bg-white/5 hover:text-zinc-200">
                    {why ? 'Hide reasoning' : 'Why?'}
                  </button>
                )}
                {msg.retryText && (
                  <button type="button" onClick={() => onRetry(msg)} className="flex min-h-8 cursor-pointer items-center rounded-lg px-2 text-amber-300 hover:bg-white/5">
                    ↻ Retry
                  </button>
                )}
                {msg.learn &&
                  (msg.rated ? (
                    <span className="px-2">{msg.rated === 'up' ? '👍 thanks' : '👎 noted'}</span>
                  ) : (
                    <>
                      <button type="button" onClick={() => onRate(msg, 'up')} aria-label="Helpful" className="flex min-h-8 min-w-8 cursor-pointer items-center justify-center rounded-lg hover:bg-white/5">
                        👍
                      </button>
                      <button type="button" onClick={() => onRate(msg, 'down')} aria-label="Not helpful" className="flex min-h-8 min-w-8 cursor-pointer items-center justify-center rounded-lg hover:bg-white/5">
                        👎
                      </button>
                    </>
                  ))}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(Bubble);
