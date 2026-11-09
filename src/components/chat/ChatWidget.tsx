// src/components/chat/ChatWidget.tsx
//
// The chat window shell. All behaviour lives in useChatController; the visuals live in
// ChatLauncher / ChatHeader / MessageList / MessageBubble / Composer. This file only owns:
//   * open / close (button, Ctrl/⌘+K, Esc, `chat:open` / `chat:close` window events)
//   * layout: full-screen on phones (visual-viewport aware so the keyboard never covers the input),
//     floating card elsewhere (with a bigger-window option)
//   * focus handling (move in, trap Tab on phones, return to the launcher), scroll lock, drag & drop
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CHAT_CLOSE_EVENT, CHAT_OPEN_EVENT, ChatOpenDetail, setChatListening, takePendingChatOpen } from '@/lib/chatBus';
import { hasWhatsApp, whatsappLink } from '@/utils/chatEngine/siteConfig';
import { trackEvent } from '@/utils/analytics';
import { isCoarsePointer } from '@/lib/motion';
import { lockScroll } from '@/lib/scrollLock';
import { safeSession } from '@/lib/safeStorage';
import { useOnline } from './useOnline';
import { SlashCommand } from './chatContent';
import { useAiStatus } from './useAiStatus';
import { useChatController } from './useChatController';
import { useChatViewport } from './useChatViewport';
import { useSiteCommands } from './useSiteCommands';
import AiPanel from './AiPanel';
import AttachmentTray from './AttachmentTray';
import ChatHeader from './ChatHeader';
import ChatLauncher from './ChatLauncher';
import Composer from './Composer';
import MessageList from './MessageList';

export default function ChatWidget() {
  const { run: runCommand, pathname } = useSiteCommands();

  const [isOpen, setIsOpen] = useState(false);
  const [wide, setWide] = useState(false);
  const [draft, setDraft] = useState('');
  const online = useOnline();

  // An unsent message survives closing the chat and reloading the page (this tab only).
  const draftReady = useRef(false);
  useEffect(() => {
    const saved = safeSession.get('sys_chat_draft');
    if (saved) setDraft(saved.slice(0, 600));
    const t = window.setTimeout(() => {
      draftReady.current = true;
    }, 0);
    return () => window.clearTimeout(t);
  }, []);
  useEffect(() => {
    if (!draftReady.current) return;
    if (draft) safeSession.set('sys_chat_draft', draft);
    else safeSession.remove('sys_chat_draft');
  }, [draft]);
  const [dragging, setDragging] = useState(false);

  const { isMobile, vv } = useChatViewport(isOpen);
  const ai = useAiStatus();

  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  const closeTimer = useRef<number | null>(null);
  const closedByCommand = useRef(false);

  /* ---------- open / close ---------- */
  const cancelClose = useCallback(() => {
    if (closeTimer.current) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  /** Tuck the chat away after a moment (used once a command has moved the visitor on a phone). */
  const requestClose = useCallback(
    (delayMs: number) => {
      cancelClose();
      closeTimer.current = window.setTimeout(() => {
        closedByCommand.current = true;
        setIsOpen(false);
      }, delayMs);
    },
    [cancelClose]
  );

  const ctl = useChatController({ pathname, isOpen, isMobile, runCommand, requestClose });
  const ctlRef = useRef(ctl);
  ctlRef.current = ctl;

  const openChat = useCallback(() => {
    cancelClose();
    setIsOpen(true);
  }, [cancelClose]);
  const closeChat = useCallback(() => {
    cancelClose();
    setIsOpen(false);
  }, [cancelClose]);

  useEffect(() => () => cancelClose(), [cancelClose]);

  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent<ChatOpenDetail>).detail || {};
      openChat();
      if (detail.prefill) setDraft(detail.prefill.slice(0, ctlRef.current.maxInput));
      if (detail.send) window.setTimeout(() => void ctlRef.current.send(detail.send!, false), 60);
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        cancelClose();
        setIsOpen((o) => !o);
      } else if (e.key === 'Escape') {
        // A menu / palette / project popup that handled Esc itself has already claimed it.
        if (e.defaultPrevented || document.querySelector('[data-modal-open]')) return;
        setIsOpen((o) => (o ? false : o));
      }
    };
    window.addEventListener(CHAT_OPEN_EVENT, onOpen);
    window.addEventListener(CHAT_CLOSE_EVENT, closeChat);
    window.addEventListener('keydown', onKey);
    setChatListening(true);
    // Something asked to open the chat before this lazily-loaded widget existed (e.g. "ASK_AI" tapped right after load).
    const pending = takePendingChatOpen();
    if (pending) {
      openChat();
      if (pending.prefill) setDraft(pending.prefill.slice(0, ctlRef.current.maxInput));
      if (pending.send) window.setTimeout(() => void ctlRef.current.send(pending.send!, false), 250);
    }
    return () => {
      setChatListening(false);
      window.removeEventListener(CHAT_OPEN_EVENT, onOpen);
      window.removeEventListener(CHAT_CLOSE_EVENT, closeChat);
      window.removeEventListener('keydown', onKey);
    };
  }, [openChat, closeChat, cancelClose]);

  // Count chat opens (anonymous, cookie-free; see utils/analytics).
  useEffect(() => {
    if (isOpen) trackEvent('chat_open');
  }, [isOpen]);

  /* ---------- focus + scroll lock ---------- */
  useEffect(() => {
    if (isOpen) {
      wasOpen.current = true;
      // Don't pop the on-screen keyboard open on touch devices as soon as the chat appears.
      if (!isCoarsePointer()) inputRef.current?.focus();
      else dialogRef.current?.focus({ preventScroll: true });
    } else if (wasOpen.current) {
      wasOpen.current = false;
      if (!closedByCommand.current) launcherRef.current?.focus();
      closedByCommand.current = false;
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !isMobile) return;
    return lockScroll();
  }, [isOpen, isMobile]);

  /* ---------- slash commands ---------- */
  const runSlash = useCallback((cmd: SlashCommand) => {
    const c = ctlRef.current;
    setDraft('');
    switch (cmd.name) {
      case 'help':
        return c.showHelp();
      case 'owner':
        return c.openHandoff();
      case 'expert':
        return c.setMode('EXPERT');
      case 'human':
        return c.setMode('HUMAN');
      case 'export':
        return c.exportChat();
      case 'clear':
        return c.reset();
      default:
        if (cmd.say) void c.send(cmd.say, false);
    }
  }, []);

  const onSend = (text: string) => {
    setDraft('');
    void ctl.send(text);
  };

  // The last few messages, for "Continue on WhatsApp" and so the contact form can pre-fill what was discussed.
  const waTranscript = useMemo(
    () =>
      ctl.messages
        .filter((m) => m.text && m.id !== 'welcome')
        .slice(-8)
        .map((m) => `${m.sender === 'user' ? 'Customer' : 'Assistant'}: ${m.text.replace(/\s+/g, ' ').slice(0, 220)}`)
        .join('\n'),
    [ctl.messages]
  );
  useEffect(() => {
    if (ctl.messages.length < 2) return;
    try {
      sessionStorage.setItem('sys_chat_handoff', waTranscript);
    } catch {
      /* storage blocked: the contact form still works without it */
    }
  }, [ctl.messages.length, waTranscript]);

  /* ---------- closed: launcher ---------- */
  if (!isOpen) {
    return <ChatLauncher ref={launcherRef} unread={ctl.unread} hasHistory={ctl.messages.length > 1} onOpen={openChat} />;
  }

  const welcome = ctl.messages.length <= 1 && !ctl.suggestions;
  const chips = welcome ? [] : ctl.suggestions ?? [];
  const expert = ctl.mode === 'EXPERT';

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      role="dialog"
      aria-label="Chat assistant"
      aria-modal={isMobile || undefined}
      style={isMobile ? { top: vv ? vv.top : 0, height: vv ? vv.height : '100dvh' } : undefined}
      onKeyDown={(e) => {
        // Keep Tab inside the full-screen dialog on phones/tablets.
        if (!isMobile || e.key !== 'Tab' || !dialogRef.current) return;
        const f = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select,summary,a[href],[tabindex]:not([tabindex="-1"])'
          )
        ).filter((n) => n.offsetParent !== null);
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }}
      onDragOver={(e) => {
        if (Array.from(e.dataTransfer?.types || []).includes('Files')) {
          e.preventDefault();
          setDragging(true);
        }
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={(e) => {
        if (!e.dataTransfer?.files?.length) return;
        e.preventDefault();
        setDragging(false);
        void ctl.att.add(e.dataTransfer.files);
      }}
      className={`animate-sheet-in fixed z-[60] flex flex-col overflow-hidden bg-zinc-950 outline-none max-sm:inset-x-0 max-sm:rounded-none sm:bottom-5 sm:right-5 sm:max-h-[calc(100dvh-2.5rem)] sm:rounded-2xl sm:border sm:border-accent/30 sm:shadow-[0_28px_90px_-12px_rgba(0,0,0,0.85)] sm:glow-accent sm:transition-[width,height] sm:duration-300 ${
        wide ? 'sm:h-[calc(100dvh-2.5rem)] sm:w-[min(46rem,calc(100vw-2.5rem))]' : 'sm:h-[640px] sm:w-[26rem]'
      }`}
    >
      {dragging && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center border-2 border-dashed border-accent bg-zinc-950/90 font-mono text-sm text-accent">
          DROP FILES TO SHARE
        </div>
      )}

      <ChatHeader
        mode={ctl.mode}
        flow={ctl.flow}
        wide={wide}
        canExpand={!isMobile}
        isThinking={ctl.isThinking}
        onToggleMode={() => ctl.setMode(expert ? 'HUMAN' : 'EXPERT')}
        onOwner={() => ctl.openHandoff()}
        onHelp={ctl.showHelp}
        onExport={ctl.exportChat}
        onClear={ctl.reset}
        onExpand={() => setWide((w) => !w)}
        onClose={closeChat}
      />

      {!online && (
        <div role="status" className="border-b border-amber-500/20 bg-amber-500/10 px-4 py-1.5 font-mono text-[11px] text-amber-300">
          You&apos;re offline — I can still answer from what I know. Web lookups and “send to owner” need a connection.
        </div>
      )}

      <AiPanel llm={ai.llm} modelId={ai.modelId} setModelId={ai.setModelId} remote={ai.remote} compact />

      {/* Hand the conversation to the owner on WhatsApp (shown once it has some substance) */}
      {hasWhatsApp() && ctl.messages.length >= 3 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800 bg-zinc-900/60 px-4 py-2 font-mono text-[11px]">
          <span className="text-zinc-400">Need a person?</span>
          <a
            href={whatsappLink(`Hello, I was chatting on your website.\n\n${waTranscript}`)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackEvent('chat_handoff')}
            className="rounded border border-emerald-500/50 px-2 py-1 text-emerald-400 transition-colors hover:bg-emerald-500/10"
          >
            Continue on WhatsApp
          </a>
        </div>
      )}

      <MessageList
        messages={ctl.messages}
        isThinking={ctl.isThinking}
        revealingId={ctl.revealingId}
        chips={chips}
        welcome={welcome}
        expert={expert}
        handoff={ctl.handoff}
        files={[...ctl.att.shared, ...ctl.att.pending]}
        onChip={(t) => void ctl.send(t, false)}
        onNav={(n) => {
          const moved = runCommand({ type: 'navigate', path: n.path, label: n.label.toUpperCase() });
          if (moved && isMobile) closeChat();
        }}
        onRate={ctl.rate}
        onRetry={ctl.retry}
        onRevealDone={ctl.markRevealed}
        onHandoffCancel={ctl.closeHandoff}
        onHandoffSent={(summary) => {
          ctl.closeHandoff();
          ctl.pushBot(summary, 'system');
        }}
        onToast={ctl.showToast}
      />

      {ctl.toast && (
        <div
          role="status"
          className="animate-nudge-in pointer-events-none absolute bottom-24 left-1/2 z-20 -translate-x-1/2 rounded-full border border-white/10 bg-zinc-800/95 px-4 py-1.5 font-mono text-[11px] text-zinc-100 shadow-xl backdrop-blur-xl"
        >
          {ctl.toast}
        </div>
      )}

      <AttachmentTray
        pending={ctl.att.pending}
        error={ctl.att.error}
        busy={ctl.att.busy}
        onRemove={ctl.att.removePending}
        onDismissError={ctl.att.clearError}
      />

      <Composer
        value={draft}
        onChange={setDraft}
        onSend={onSend}
        onStop={ctl.stop}
        onAttach={(files) => void ctl.att.add(files)}
        onSlash={runSlash}
        onToast={ctl.showToast}
        onActivity={cancelClose}
        isThinking={ctl.isThinking}
        canStop={ctl.isThinking}
        busy={ctl.att.busy}
        hasPending={ctl.att.pending.length > 0}
        expert={expert}
        max={ctl.maxInput}
        inputRef={inputRef}
      />
    </div>
  );
}
