// src/lib/dialog.ts: the site's own confirm / message dialogs, used instead of the browser's pop-ups.
// `await ask('Delete this?', { danger: true })` -> true / false.   `await notify('Something went wrong')`.
// <DialogHost /> (mounted once in the root layout) draws them. If the host is not mounted yet, we fall back to the browser's own dialog.
export interface DialogOpts { title?: string; confirmLabel?: string; cancelLabel?: string; danger?: boolean }
export interface DialogReq extends DialogOpts { id: number; kind: 'confirm' | 'notice'; message: string; resolve: (v: boolean) => void }

let seq = 0;
let listener: ((r: DialogReq) => void) | null = null;
export const setDialogListener = (fn: ((r: DialogReq) => void) | null) => { listener = fn; };

function open(kind: DialogReq['kind'], message: string, opts: DialogOpts): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(false);
    if (!listener) { // host not mounted: never leave the caller hanging
      try { resolve(kind === 'confirm' ? window.confirm(message) : (window.alert(message), true)); } catch { resolve(false); }
      return;
    }
    listener({ id: ++seq, kind, message: String(message ?? ''), resolve, ...opts });
  });
}
export const ask = (message: string, opts: DialogOpts = {}) => open('confirm', message, opts);
export const notify = (message: string, opts: DialogOpts = {}) => open('notice', message, opts).then(() => undefined);
