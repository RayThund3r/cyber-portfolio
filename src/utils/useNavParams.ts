// src/utils/useNavParams.ts
// Lets a page react to URL params set by the chat assistant ("show me branding projects" → ?category=BRANDING).
// Runs on mount (fresh navigation) AND when the chat navigates to the same page with new params.
'use client';

import { useEffect, useRef } from 'react';

export function useNavParams(handler: (params: URLSearchParams) => void) {
  const ref = useRef(handler);
  useEffect(() => { ref.current = handler; });

  useEffect(() => {
    ref.current(new URLSearchParams(window.location.search));
    const onEvent = (e: Event) => ref.current(new URLSearchParams((e as CustomEvent).detail?.search || ''));
    window.addEventListener('chat:nav-params', onEvent);
    return () => window.removeEventListener('chat:nav-params', onEvent);
  }, []);
}
