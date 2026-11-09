// src/components/layout/ChromeGate.tsx
//
// Hides the shared header/footer on full-screen tools that bring their own toolbar:
// the admin dashboard and the template editor.
'use client';

import { usePathname } from 'next/navigation';

const HIDDEN_ON = ['/admin', '/builder/edit'];

export default function ChromeGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '';
  if (HIDDEN_ON.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;
  return <>{children}</>;
}
