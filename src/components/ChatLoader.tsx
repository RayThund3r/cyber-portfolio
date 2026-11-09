// src/components/ChatLoader.tsx — loads the chat widget (and its engine) after the page is interactive.
'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

const CyberChatWidget = dynamic(() => import('@/components/CyberChatWidget'), { ssr: false });

/** Full-screen tools (admin, template editor) bring their own UI; the visitor chat never loads there. */
const NO_CHAT = ['/admin', '/builder/edit'];

export default function ChatLoader() {
  const pathname = usePathname() || '';
  const hidden = NO_CHAT.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const w = window as any;
    const go = () => setReady(true);
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(go, { timeout: 2500 });
      return () => w.cancelIdleCallback?.(id);
    }
    const t = setTimeout(go, 1200);
    return () => clearTimeout(t);
  }, []);
  return ready && !hidden ? <CyberChatWidget /> : null;
}
