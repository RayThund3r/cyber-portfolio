// src/components/ui/OfflineNotice.tsx
//
// A small iOS-style pill that slides in when the phone loses its connection, and confirms when it is
// back. Forms and the chat depend on the network, so visitors should know why something isn't sending.
'use client';

import { useEffect, useState } from 'react';

export default function OfflineNotice() {
  const [state, setState] = useState<'online' | 'offline' | 'back'>('online');

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const off = () => { clearTimeout(timer); setState('offline'); };
    const on = () => { setState('back'); timer = setTimeout(() => setState('online'), 2500); };
    if (!navigator.onLine) off();
    window.addEventListener('offline', off);
    window.addEventListener('online', on);
    return () => { clearTimeout(timer); window.removeEventListener('offline', off); window.removeEventListener('online', on); };
  }, []);

  if (state === 'online') return null;
  const offline = state === 'offline';
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 top-3 z-[150] flex justify-center px-4" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className={`ios-enter rounded-full border px-4 py-2 font-mono text-xs shadow-lg backdrop-blur ${offline ? 'border-amber-500/50 bg-zinc-900/90 text-amber-300' : 'border-emerald-500/50 bg-zinc-900/90 text-emerald-300'}`}>
        {offline ? "You're offline. Forms and chat will work again when you reconnect." : 'Back online ✓'}
      </div>
    </div>
  );
}
