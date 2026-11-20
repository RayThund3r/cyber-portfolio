// src/components/ui/Portal.tsx
//
// Renders full-screen overlays (preview windows, purchase sheets, tours, pop-ups) directly under <body>.
// A page's own wrapper may be animated or transformed; a `position: fixed` overlay inside a transformed ancestor is sized and
// positioned against THAT ancestor instead of the screen (it ends up page-tall, scrolls away and hides its own Close button).
// Outside the page tree nothing can do that to it. Renders nothing on the server and on the first client render (no hydration mismatch).
'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export default function Portal({ children }: { children: ReactNode }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => { setHost(document.body); }, []);
  return host ? createPortal(children, host) : null;
}
