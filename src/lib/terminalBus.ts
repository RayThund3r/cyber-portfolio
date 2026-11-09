// src/lib/terminalBus.ts
//
// Lets the chat (or any component) type a command into the home-page terminal. If the terminal is not
// mounted yet (the visitor is on another page), the command waits and is run as soon as it appears.

export const TERMINAL_RUN_EVENT = 'terminal:run';

let pending: string | null = null;

export function runInTerminal(cmd: string) {
  if (typeof window === 'undefined') return;
  pending = cmd.slice(0, 80);
  window.dispatchEvent(new CustomEvent<string>(TERMINAL_RUN_EVENT, { detail: pending }));
}

/** Called by the terminal on mount: returns (once) any command that was queued before it existed. */
export function takePendingTerminalCommand(): string | null {
  const c = pending;
  pending = null;
  return c;
}

/** Called by the terminal when it handled a live event, so the queued copy is not run twice. */
export function clearPendingTerminalCommand() {
  pending = null;
}
