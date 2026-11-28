// src/components/ui/DialogHost.tsx: draws the in-site confirm / message dialogs (see lib/dialog.ts). Translucent glass, keyboard friendly.
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { setDialogListener, type DialogReq } from '@/lib/dialog';

export default function DialogHost() {
  const [queue, setQueue] = useState<DialogReq[]>([]);
  const [mounted, setMounted] = useState(false);
  const okRef = useRef<HTMLButtonElement>(null);
  const opener = useRef<Element | null>(null);
  const cur = queue[0];

  useEffect(() => { setMounted(true); setDialogListener((r) => setQueue((q) => [...q, r])); return () => setDialogListener(null); }, []);

  const finish = useCallback((v: boolean) => {
    setQueue((q) => { q[0]?.resolve(v); return q.slice(1); });
  }, []);

  useEffect(() => {
    if (!cur) { (opener.current as HTMLElement | null)?.focus?.(); opener.current = null; return; }
    if (!opener.current) opener.current = document.activeElement;
    okRef.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(false); }
      if (e.key === 'Tab') { // keep focus inside the dialog
        const els = Array.from(document.querySelectorAll<HTMLElement>('[data-dialog] button')); if (!els.length) return;
        const first = els[0], last = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', key, true);
    return () => document.removeEventListener('keydown', key, true);
  }, [cur, finish]);

  if (!mounted || !cur) return null;
  const confirmKind = cur.kind === 'confirm';
  const title = cur.title || (confirmKind ? (cur.danger ? 'Are you sure?' : 'Please confirm') : 'Notice');
  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-end justify-center p-4 sm:items-center" data-dialog>
      <div className="dlg-backdrop absolute inset-0 bg-black/35 backdrop-blur-[3px]" onClick={() => finish(false)} aria-hidden="true" />
      <div role={confirmKind ? 'alertdialog' : 'dialog'} aria-modal="true" aria-labelledby="dlg-title" aria-describedby="dlg-msg"
        className="dlg-panel relative w-full max-w-sm rounded-2xl border border-white/15 bg-zinc-900/65 p-5 text-zinc-100 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)] backdrop-blur-xl backdrop-saturate-150">
        <h2 id="dlg-title" className="text-base font-semibold">{title}</h2>
        <p id="dlg-msg" className="mt-2 whitespace-pre-line break-words text-sm leading-relaxed text-zinc-300">{cur.message}</p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {confirmKind && <button type="button" onClick={() => finish(false)} className="min-h-11 cursor-pointer rounded-xl border border-white/15 bg-white/5 px-4 text-sm text-zinc-200 transition hover:bg-white/10 active:scale-[0.98]">{cur.cancelLabel || 'Cancel'}</button>}
          <button ref={okRef} type="button" onClick={() => finish(true)}
            className={`min-h-11 cursor-pointer rounded-xl px-5 text-sm font-semibold transition active:scale-[0.98] ${cur.danger ? 'bg-rose-500/90 text-white hover:bg-rose-500' : 'bg-accent-strong text-black hover:brightness-110'}`}>
            {cur.confirmLabel || (confirmKind ? (cur.danger ? 'Yes, do it' : 'Continue') : 'OK')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
