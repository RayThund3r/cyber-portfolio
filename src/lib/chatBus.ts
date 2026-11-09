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
