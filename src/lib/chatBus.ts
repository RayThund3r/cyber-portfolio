// src/lib/chatBus.ts
//
// Tiny window-event bridge so ANY component (nav button, footer link, terminal command, 404 page)
// can open the chat without importing the widget.

export const CHAT_OPEN_EVENT = 'chat:open';
export const CHAT_CLOSE_EVENT = 'chat:close';

export interface ChatOpenDetail {
  /** Text to drop into the input box (not sent automatically). */
  prefill?: string;
  /** Text to send right away as if the visitor typed it. */
  send?: string;
}

/**
 * The chat widget loads lazily (after the page is idle). A request made before it has mounted would
 * be lost, so it is parked here and the widget picks it up as soon as it starts listening.
 */
interface BusState { __chatReady?: boolean; __chatPending?: ChatOpenDetail }

export function takePendingChatOpen(): ChatOpenDetail | undefined {
  const w = window as unknown as BusState;
  const d = w.__chatPending;
  w.__chatPending = undefined;
  return d;
}

export function setChatListening(on: boolean) {
  (window as unknown as BusState).__chatReady = on;
}

export function openChat(detail: ChatOpenDetail = {}) {
  if (typeof window === 'undefined') return;
  const w = window as unknown as BusState;
  if (!w.__chatReady) w.__chatPending = detail;
  window.dispatchEvent(new CustomEvent<ChatOpenDetail>(CHAT_OPEN_EVENT, { detail }));
}

export function closeChat() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CHAT_CLOSE_EVENT));
}

/* ------------------------------ games <-> chat ------------------------------ */
// The games page publishes what is happening in the active game; the chat engine reads it so "any tips?" or
// "I'm losing" can answer for THAT game, and the GameBuddy toasts react to the events.

export const GAME_EVENT = 'game:event';
export const CHAT_SAY_EVENT = 'chat:bot-say';

export type GameEventKind = 'open' | 'start' | 'score' | 'level' | 'good' | 'mistake' | 'streak' | 'win' | 'lose' | 'draw' | 'highscore' | 'idle' | 'leave';
export type GameStatus = 'idle' | 'playing' | 'won' | 'lost' | 'draw';

export interface GameContext {
  /** Game id as in the games registry ('snake', 'chess'...). */
  game: string;
  status: GameStatus;
  score?: number;
  level?: number;
  turn?: number;
  streak?: number;
  best?: number;
  /** Last event kind and when it happened. */
  last?: GameEventKind;
  ts: number;
}

export interface GameEventDetail {
  game: string;
  kind: GameEventKind;
  score?: number;
  level?: number;
  turn?: number;
  streak?: number;
}

interface GameBusState { __gameCtx?: GameContext | null }

const STATUS_FOR: Partial<Record<GameEventKind, GameStatus>> = { open: 'idle', start: 'playing', win: 'won', lose: 'lost', draw: 'draw' };

/** Pure reducer (also used by tests): folds an event into the context. `null` means no game is active. */
export function reduceGameContext(prev: GameContext | null, e: GameEventDetail, now = Date.now()): GameContext | null {
  if (e.kind === 'leave') return null;
  const base: GameContext = prev && prev.game === e.game ? prev : { game: e.game, status: 'idle', ts: now };
  const status = STATUS_FOR[e.kind] ?? base.status;
  return {
    ...base,
    status,
    score: e.score ?? (e.kind === 'start' ? 0 : base.score),
    level: e.level ?? (e.kind === 'start' ? undefined : base.level),
    turn: e.turn ?? base.turn,
    streak: e.streak ?? base.streak,
    best: e.kind === 'highscore' && e.score !== undefined ? e.score : base.best,
    last: e.kind,
    ts: now,
  };
}

export function getGameContext(): GameContext | null {
  if (typeof window === 'undefined') return null;
  return (window as unknown as GameBusState).__gameCtx ?? null;
}

export function publishGame(e: GameEventDetail) {
  if (typeof window === 'undefined') return;
  try {
    const w = window as unknown as GameBusState;
    w.__gameCtx = reduceGameContext(w.__gameCtx ?? null, e);
    window.dispatchEvent(new CustomEvent<GameEventDetail>(GAME_EVENT, { detail: e }));
  } catch { /* the bus is best effort */ }
}

/** Post a line into the chat as the assistant. The widget only shows it when the chat is open. */
export function chatSay(text: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<{ text: string }>(CHAT_SAY_EVENT, { detail: { text } }));
}
