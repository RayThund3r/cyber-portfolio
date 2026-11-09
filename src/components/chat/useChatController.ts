// src/components/chat/useChatController.ts
//
// All of the chat's behaviour in one place, so the widget file is only layout:
//   * session restore / save (never saves blob URLs or reveal flags)
//   * sending a message: files, abort, watchdog, natural pacing, streaming, retry on failure
//   * running the site commands the engine returns, and the hand-off card
//   * 👍/👎 learning, export, clearing, unread count, toasts, saved reply style
//
// Refs mirror the latest state so callbacks fired from window events or timers never read a stale
// render (the bug class that bites chat widgets most).
'use client';

import { tap } from '@/lib/haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import { processChatQuery } from '@/utils/chatEngine';
import { trackChat } from '@/utils/analytics';
import { useProjects } from '@/context/ProjectsContext';
import type { Message, PersonaMode, ResponseSource, SessionMemory, SiteCommand, SystemAction } from '@/utils/chatEngine/types';
import { getUnansweredQueries, loadSession, recordLearnedAlias, saveSession } from '@/utils/chatEngine/learningEngine';
import { readState } from '@/utils/chatEngine/dialogue';
import { safeLocal } from '@/lib/safeStorage';
import { prefersReducedMotion } from '@/lib/motion';
import { useAttachments } from './useAttachments';
import { HELP_EXPERT, HELP_HUMAN, WELCOME } from './chatContent';
import { buildExport, downloadText, nowTime, toSavable, uid } from './chatUtils';

const MODE_KEY = 'sys_chat_mode';
/** If an AI model produces nothing for this long, stop it and fall back instead of hanging. */
const STALL_MS = 45_000;
const MAX_INPUT = 600;

const EMPTY_MEMORY: SessionMemory = {
  interactionCount: 0,
  lastTopic: 'GREETINGS',
  userContext: {},
  conversationHistory: [],
};

function learnInfo(query: string, result: { source: ResponseSource; matchedEntryId?: string }) {
  return result.source === 'knowledge' && result.matchedEntryId ? { query, entryId: result.matchedEntryId } : undefined;
}

/** Wait `ms`, but resolve early when the signal aborts. */
function pause(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (ms <= 0 || signal.aborted) return resolve();
    const id = window.setTimeout(done, ms);
    function done() {
      window.clearTimeout(id);
      signal.removeEventListener('abort', done);
      resolve();
    }
    signal.addEventListener('abort', done);
  });
}

export interface ControllerArgs {
  pathname: string | null;
  isOpen: boolean;
  isMobile: boolean;
  /** Run a site command (navigate, scroll, theme…). Returns true if the visitor should now look at the page. */
  runCommand: (cmd: SiteCommand) => boolean;
  /** Ask the widget to close itself after a delay (used after a command moved the visitor). */
  requestClose: (delayMs: number) => void;
}

export function useChatController({ pathname, isOpen, isMobile, runCommand, requestClose }: ControllerArgs) {
  const att = useAttachments();

  const [messages, setMessages] = useState<Message[]>([]);
  const [memory, setMemory] = useState<SessionMemory>(EMPTY_MEMORY);
  const [mode, setModeState] = useState<PersonaMode>('HUMAN');
  const [isThinking, setIsThinking] = useState(false);
  const [suggestions, setSuggestions] = useState<string[] | null>(null);
  const [handoff, setHandoff] = useState<{ prefill: string } | null>(null);
  const [revealingId, setRevealingId] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  const hydrated = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const thinkingRef = useRef(false);
  const toastTimer = useRef<number | null>(null);
  const queued = useRef<number[]>([]);

  const { all: projects } = useProjects();
  const live = useRef({ messages, memory, mode, pathname, isOpen, isMobile, att, runCommand, requestClose, projects });
  live.current = { messages, memory, mode, pathname, isOpen, isMobile, att, runCommand, requestClose, projects };

  /* ---------- mount: restore the session and the saved reply style ---------- */
  useEffect(() => {
    const saved = loadSession();
    if (saved && saved.messages.length > 0) {
      const restored: Message[] = saved.messages.map((m) => ({ ...m, reveal: false, streaming: false }));
      const last = restored[restored.length - 1];
      const away = last?.ts ? Date.now() - last.ts : 0;
      if (restored.length > 2 && away > 6 * 60 * 60 * 1000) {
        // Returning after a long break: a short, friendly re-entry instead of a silent wall of old text.
        restored.push({
          id: uid(),
          ts: Date.now(),
          sender: 'bot',
          text: 'Welcome back! 👋 Want to pick up where we left off, or start something new?',
          time: nowTime(),
          source: 'system',
        });
        setSuggestions(['Show me your projects', 'Book a repair', 'Clear chat']);
      }
      setMessages(restored);
      setMemory(saved.memory);
    } else {
      setMessages([{ ...WELCOME, time: nowTime(), ts: Date.now() }]);
    }
    const savedMode = safeLocal.get(MODE_KEY);
    if (savedMode === 'EXPERT' || savedMode === 'HUMAN') setModeState(savedMode);

    // Deferred so React Strict Mode's double effect run can't save an empty session over the real one.
    const t = window.setTimeout(() => {
      hydrated.current = true;
    }, 0);

    // Handy for you: type  window.chatUnanswered()  in the console to see what the bot couldn't answer.
    (window as any).chatUnanswered = getUnansweredQueries;
    return () => {
      window.clearTimeout(t);
      abortRef.current?.abort();
      queued.current.forEach((t) => window.clearTimeout(t));
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    };
  }, []);

  /* ---------- persist ---------- */
  useEffect(() => {
    if (!hydrated.current || isThinking) return;
    if (messages.some((m) => m.streaming)) return;
    saveSession(toSavable(messages), memory);
  }, [messages, memory, isThinking]);

  useEffect(() => {
    if (isOpen) setUnread(0);
  }, [isOpen]);

  /* ---------- small helpers ---------- */
  const showToast = useCallback((text: string) => {
    setToast(text);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2200);
  }, []);

  const pushBot = useCallback((text: string, source?: ResponseSource, extra: Partial<Message> = {}) => {
    const msg: Message = { id: uid(), ts: Date.now(), sender: 'bot', text, time: nowTime(), source, ...extra };
    setMessages((prev) => [...prev, msg]);
    if (!live.current.isOpen) setUnread((n) => n + 1);
    return msg.id;
  }, []);

  const markRevealed = useCallback((id: string) => {
    setMessages((prev) => prev.map((m) => (m.id === id && m.reveal ? { ...m, reveal: false } : m)));
    setRevealingId((cur) => (cur === id ? null : cur));
  }, []);

  const openHandoff = useCallback((note?: string) => {
    let prefill = note || '';
    if (!prefill) {
      const lastUser = [...live.current.messages]
        .reverse()
        .find((m) => m.sender === 'user' && m.text.length > 15 && !/\b(send|forward)\b.*\b(owner|this|it)\b/i.test(m.text));
      prefill = lastUser ? lastUser.text.slice(0, 600) : '';
    }
    setHandoff({ prefill: prefill.slice(0, 1200) });
  }, []);
  const closeHandoff = useCallback(() => setHandoff(null), []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    live.current.att.clearAll();
    setMessages([{ ...WELCOME, time: nowTime(), ts: Date.now() }]);
    setMemory(EMPTY_MEMORY);
    setSuggestions(null);
    setHandoff(null);
    setRevealingId(null);
    setIsThinking(false);
    thinkingRef.current = false;
  }, []);

  const setMode = useCallback(
    (next: PersonaMode, announce = true) => {
      setModeState(next);
      safeLocal.set(MODE_KEY, next);
      if (announce) {
        pushBot(
          next === 'EXPERT'
            ? 'SYS_MODE: [EXPERT] // Technical, compact responses enabled.'
            : 'Human mode on! 😊 Warm, conversational and simple.'
        );
      }
    },
    [pushBot]
  );

  const runAction = useCallback(
    (action: SystemAction) => {
      if (action === 'RESET_CHAT') reset();
    },
    [reset]
  );

  const exportChat = useCallback(() => {
    const ok = downloadText(`chat-${new Date().toISOString().slice(0, 10)}.txt`, buildExport(live.current.messages));
    showToast(ok ? 'Conversation downloaded' : 'Could not download — your browser blocked it');
  }, [showToast]);

  const showHelp = useCallback(() => {
    pushBot(live.current.mode === 'EXPERT' ? HELP_EXPERT : HELP_HUMAN, 'system', { reveal: !prefersReducedMotion() });
  }, [pushBot]);

  /* ---------- sending ---------- */
  const send = useCallback(
    async (textToSend: string, withPending = true) => {
      const { att: files, mode: curMode } = live.current;
      const typed = textToSend.trim().slice(0, MAX_INPUT);
      const usePending = withPending && files.pending.length > 0;
      if ((!typed && !usePending) || thinkingRef.current) return;
      thinkingRef.current = true;
      tap(8);

      // Files chosen with this message move into the conversation (the assistant keeps them in mind).
      const text = typed || (files.pending.length > 1 ? 'Here are my files.' : 'Here is my file.');
      const moved = usePending ? files.commit() : [];
      const allFiles = [...files.shared, ...moved];

      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          ts: Date.now(),
          sender: 'user',
          text,
          time: nowTime(),
          attachments: moved.length
            ? moved.map((f) => ({ name: f.insight.name, size: f.insight.size, kind: f.insight.kind, previewUrl: f.previewUrl }))
            : undefined,
        },
      ]);
      setSuggestions([]);
      setIsThinking(true);

      const ctrl = new AbortController();
      abortRef.current = ctrl;
      let stall = window.setTimeout(() => ctrl.abort(), STALL_MS);
      const kick = () => {
        window.clearTimeout(stall);
        stall = window.setTimeout(() => ctrl.abort(), STALL_MS);
      };
      let streamId: string | null = null;
      const started = performance.now();

      try {
        const result = await processChatQuery(text, curMode, live.current.memory, {
          signal: ctrl.signal,
          pathname: live.current.pathname || undefined,
          projects: live.current.projects.map((p) => ({ id: p.id, title: p.title, category: p.category })),
          files: allFiles.map((f) => f.insight),
          filesAreNew: moved.length > 0,
          onToken: (partial) => {
            kick();
            if (!streamId) {
              streamId = uid();
              const id = streamId;
              setMessages((prev) => [...prev, { id, ts: Date.now(), sender: 'bot', text: partial, time: nowTime(), streaming: true }]);
            } else {
              const id = streamId;
              setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, text: partial } : m)));
            }
          },
        });

        // Instant replies get a brief, natural pause so the exchange feels like a conversation.
        if (!streamId && !prefersReducedMotion()) {
          const target = Math.min(700, 280 + result.reply.length * 1.2);
          await pause(target - (performance.now() - started), ctrl.signal);
        }

        trackChat(text, String(result.source));
        tap(12);
        setMemory(result.updatedMemory);
        setSuggestions(result.suggestions && result.suggestions.length ? result.suggestions : []);

        const commandLabel = result.command ? [result.command.label, ...(result.queuedCommands || []).map((c) => c.label)].join(' → ') : undefined;
        const common = {
          source: result.source,
          imageUrl: result.imageUrl,
          learn: learnInfo(text, result),
          commandLabel,
          guided: result.guided,
          trace: result.trace,
          cards: result.cards,
          nav: result.nav,
        };
        if (streamId) {
          const id = streamId;
          setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...common, text: result.reply, streaming: false } : m)));
          if (!live.current.isOpen) setUnread((n) => n + 1);
        } else {
          const reveal = !prefersReducedMotion() && result.reply.length > 40;
          const id = pushBot(result.reply, result.source, { ...common, reveal });
          if (reveal) setRevealingId(id);
        }

        if (result.action) runAction(result.action);
        if (result.handoff) openHandoff(result.handoffNote);

        if (result.command) {
          if (result.command.type === 'close-chat') {
            live.current.requestClose(700);
          } else {
            const moves = live.current.runCommand(result.command);
            // On a phone the chat covers the whole screen, so tuck it away once the visitor has had a
            // moment to read the reply — otherwise they would never see where they were taken.
            if (moves && live.current.isMobile && !result.queuedCommands?.length) live.current.requestClose(1300);
          }
        }

        // Second / third request from the same message: run them in order, a beat apart.
        (result.queuedCommands || []).forEach((cmd, i) => {
          const t = window.setTimeout(() => {
            queued.current = queued.current.filter((x) => x !== t);
            const moved = live.current.runCommand(cmd);
            if (moved && live.current.isMobile && i === (result.queuedCommands?.length ?? 1) - 1) live.current.requestClose(1300);
          }, 1100 * (i + 1));
          queued.current.push(t);
        });
      } catch (error) {
        console.error('Engine execution error:', error);
        pushBot(
          curMode === 'EXPERT' ? 'SYS_ERR // Engine fault. Retry.' : 'Oops — something went wrong on my side. 🙏',
          'system',
          { retryText: text }
        );
      } finally {
        window.clearTimeout(stall);
        setIsThinking(false);
        thinkingRef.current = false;
        abortRef.current = null;
      }
    },
    [openHandoff, pushBot, runAction]
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);

  const retry = useCallback(
    (msg: Message) => {
      if (!msg.retryText) return;
      setMessages((prev) => prev.filter((m) => m.id !== msg.id));
      void send(msg.retryText, false);
    },
    [send]
  );

  /* ---------- 👍 / 👎: teach the retriever (stored in this browser only) ---------- */
  const rate = useCallback(
    (msg: Message, rating: 'up' | 'down') => {
      if (!msg.learn || msg.rated) return;
      recordLearnedAlias(msg.learn.query, msg.learn.entryId, rating === 'up' ? 1 : -1);
      setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, rated: rating } : m)));
      if (rating === 'down') {
        pushBot(
          live.current.mode === 'EXPERT'
            ? 'SYS_FEEDBACK // Mismatch logged. Rephrase the query or use the contact module.'
            : "Thanks for telling me — I won't pick that answer for this question again. Could you rephrase it, or should I pass your question to the owner?",
          'system'
        );
        setSuggestions(['Send this to the owner', 'Let me rephrase']);
      }
    },
    [pushBot]
  );

  /** What guided flow (if any) is running, for the header pill. */
  const flow = readState(memory).flow?.id;

  return {
    att,
    messages,
    mode,
    isThinking,
    suggestions,
    handoff,
    revealingId,
    unread,
    toast,
    flow,
    maxInput: MAX_INPUT,
    send,
    stop,
    retry,
    rate,
    reset,
    setMode,
    markRevealed,
    openHandoff,
    closeHandoff,
    exportChat,
    showHelp,
    showToast,
    pushBot,
  };
}
