// src/components/chat/useChatViewport.ts
//
// Tells the widget (a) whether it is on a phone-sized screen and (b) — while open on a phone —
// the real visible height. On iOS/Android the on-screen keyboard shrinks the *visual* viewport but
// not `100vh`, which is what makes naive full-screen chats hide their input box behind the keyboard.
'use client';

import { useEffect, useState } from 'react';

const PHONE_QUERY = '(max-width: 639px)';

export function useChatViewport(active: boolean) {
  const [isMobile, setIsMobile] = useState(false);
  const [vv, setVv] = useState<{ height: number; top: number } | null>(null);

  useEffect(() => {
    let mq: MediaQueryList;
    try {
      mq = window.matchMedia(PHONE_QUERY);
    } catch {
      return;
    }
    const on = () => setIsMobile(mq.matches);
    on();
    if (mq.addEventListener) mq.addEventListener('change', on);
    else (mq as any).addListener?.(on);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', on);
      else (mq as any).removeListener?.(on);
    };
  }, []);

  useEffect(() => {
    if (!active || !isMobile) {
      setVv(null);
      return;
    }
    const v = window.visualViewport;
    if (!v) return;
    const on = () => setVv({ height: Math.round(v.height), top: Math.round(v.offsetTop) });
    on();
    v.addEventListener('resize', on);
    v.addEventListener('scroll', on);
    return () => {
      v.removeEventListener('resize', on);
      v.removeEventListener('scroll', on);
      setVv(null);
    };
  }, [active, isMobile]);

  return { isMobile, vv };
}
