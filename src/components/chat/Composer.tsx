// src/components/chat/Composer.tsx
//
// The message box: auto-growing textarea (Enter sends, Shift+Enter = new line, IME-safe), "/" command
// palette, attach button, optional voice dictation, send / stop, and a character counter near the limit.
'use client';

import { KeyboardEvent, RefObject, useEffect, useMemo, useRef, useState } from 'react';
import { ACCEPT } from '@/lib/attachmentRules';
import { SLASH_COMMANDS, SlashCommand } from './chatContent';
import type { useVoiceChat } from './useVoiceChat';

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSend: (text: string) => void;
  onStop: () => void;
  onAttach: (files: FileList | File[] | null) => void;
  onSlash: (cmd: SlashCommand) => void;
  onToast: (msg: string) => void;
  onActivity: () => void;
  isThinking: boolean;
  canStop: boolean;
  busy: boolean;
  hasPending: boolean;
  expert: boolean;
  max: number;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  vc: ReturnType<typeof useVoiceChat>;
}

export default function Composer(p: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const [sel, setSel] = useState(0);
  const [paletteOff, setPaletteOff] = useState(false);
  const voice = p.vc.voice;

  // Grow with the content (up to ~5 lines), shrink back when cleared.
  useEffect(() => {
    const el = p.inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 124) + 'px';
  }, [p.value, p.inputRef]);

  const slashQuery = /^\/[a-z]*$/i.test(p.value) ? p.value.slice(1).toLowerCase() : null;
  const matches = useMemo(
    () => (slashQuery === null ? [] : SLASH_COMMANDS.filter((c) => c.name.startsWith(slashQuery))),
    [slashQuery]
  );
  const paletteOpen = matches.length > 0 && !paletteOff;
  useEffect(() => {
    setSel(0);
    setPaletteOff(false);
  }, [slashQuery]);

  const submit = () => {
    const v = p.value.trim();
    if (!v && !p.hasPending) return;
    // A typed "/command" runs the command instead of being sent as a question.
    const m = /^\/([a-z]+)$/i.exec(v);
    if (m) {
      const cmd = SLASH_COMMANDS.find((c) => c.name === m[1].toLowerCase());
      if (cmd) return p.onSlash(cmd);
    }
    p.vc.onUserSend();
    p.onSend(p.value);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (paletteOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSel((s) => (s + 1) % matches.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSel((s) => (s - 1 + matches.length) % matches.length);
        return;
      }
      if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey)) {
        e.preventDefault();
        p.onSlash(matches[sel]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault(); // closes the palette only, not the whole chat
        setPaletteOff(true);
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (!p.isThinking && !p.busy) submit();
    }
  };

  const near = p.value.length > p.max * 0.8;
  const canSend = (p.value.trim().length > 0 || p.hasPending) && !p.busy;

  return (
    <div className="relative border-t border-white/5 bg-zinc-950/80 p-2.5 max-sm:pb-[max(0.625rem,env(safe-area-inset-bottom))]">
      {paletteOpen && (
        <ul
          role="listbox"
          aria-label="Commands"
          className="absolute inset-x-2.5 bottom-full z-20 mb-1 max-h-56 overflow-y-auto rounded-xl border border-white/10 bg-zinc-900/95 p-1 shadow-2xl backdrop-blur-xl"
        >
          {matches.map((c, i) => (
            <li key={c.name} role="option" aria-selected={i === sel}>
              <button
                type="button"
                onMouseEnter={() => setSel(i)}
                onClick={() => p.onSlash(c)}
                className={`flex min-h-10 w-full cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-1.5 text-left text-xs transition-colors ${
                  i === sel ? 'bg-accent/15 text-zinc-50' : 'text-zinc-300 hover:bg-white/5'
                }`}
              >
                <span className="font-mono text-accent">/{c.name}</span>
                <span className="truncate text-zinc-500">{c.hint}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-end gap-1.5 rounded-2xl border border-white/10 bg-zinc-900/80 p-1.5 transition-colors focus-within:border-accent/50 focus-within:shadow-[0_0_0_3px_rgb(var(--accent-rgb)/0.12)]">
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPT}
          multiple
          hidden
          aria-label="Choose files to share"
          onChange={(e) => {
            p.onAttach(e.target.files);
            e.target.value = '';
          }}
        />
        <input
          ref={camRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          aria-label="Take a photo"
          onChange={(e) => {
            p.onAttach(e.target.files);
            e.target.value = '';
          }}
        />
        <button
          type="button"
          onClick={() => camRef.current?.click()}
          aria-label="Take a photo"
          title="Take a photo"
          className="hidden h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl text-zinc-400 transition-colors hover:bg-white/5 hover:text-accent [@media(pointer:coarse)]:flex"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          aria-label="Attach a file"
          title="Attach a file (images, PDF, text, CSV, JSON, logs)"
          className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl text-lg text-zinc-400 transition-colors hover:bg-white/5 hover:text-accent"
        >
          📎
        </button>

        <textarea
          ref={p.inputRef}
          rows={1}
          aria-label="Message"
          aria-autocomplete={paletteOpen ? 'list' : undefined}
          placeholder={p.expert ? 'ENTER_QUERY…' : 'Ask or say where to go…'}
          value={p.value}
          maxLength={p.max}
          autoComplete="off"
          autoCorrect="on"
          enterKeyHint="send"
          onKeyDown={onKeyDown}
          onPaste={(e) => {
            // Pasting a screenshot or copied file attaches it instead of typing nothing.
            const files = Array.from(e.clipboardData?.files || []);
            if (files.length) {
              e.preventDefault();
              p.onAttach(files as unknown as FileList);
            }
          }}
          onChange={(e) => {
            p.onActivity();
            p.onChange(e.target.value);
          }}
          onFocus={p.onActivity}
          className="max-h-[124px] min-h-10 min-w-0 flex-1 resize-none self-center bg-transparent px-1.5 py-2 font-sans text-sm leading-5 text-zinc-100 placeholder-zinc-600 focus:outline-none"
        />

        {voice.supported && (
          <>
            <button
              type="button"
              onClick={() => p.vc.setPanelOpen(!p.vc.panelOpen)}
              aria-label="Voice settings"
              aria-expanded={p.vc.panelOpen}
              title="Voice settings"
              className="flex h-10 w-6 shrink-0 cursor-pointer items-center justify-center rounded-lg text-zinc-600 transition-colors hover:text-accent sm:w-7"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 15l6-6 6 6" /></svg>
            </button>
            <button
              type="button"
              onClick={p.vc.toggleMic}
              aria-pressed={voice.listening}
              aria-label={voice.listening ? 'Stop voice input' : 'Speak your message'}
              title={voice.listening ? 'Stop listening' : 'Speak your message'}
              className={`flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl text-base transition-colors ${
                voice.listening ? 'animate-ring bg-red-500/20 text-red-300' : 'text-zinc-400 hover:bg-white/5 hover:text-accent'
              }`}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="9" y="3" width="6" height="11" rx="3" />
                <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
              </svg>
            </button>
          </>
        )}

        {p.isThinking && p.canStop ? (
          <button
            type="button"
            onClick={p.onStop}
            aria-label="Stop generating"
            className="flex h-10 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-zinc-700 px-3.5 font-mono text-[11px] font-bold text-zinc-100 transition-colors hover:bg-zinc-600"
          >
            ■ STOP
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={!canSend || p.isThinking}
            aria-label="Send message"
            className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-gradient-to-br from-accent to-accent-strong text-lg font-bold text-black transition-all hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-35 disabled:grayscale"
          >
            ↑
          </button>
        )}
      </div>

      <div className="flex items-center justify-between px-2 pt-1 font-mono text-[10px] text-zinc-600" aria-hidden={!near}>
        <span className="hidden sm:inline">Enter to send · Shift+Enter for a new line · / for commands</span>
        {near && <span className={p.value.length >= p.max ? 'text-amber-400' : ''}>{p.value.length}/{p.max}</span>}
      </div>
    </div>
  );
}
