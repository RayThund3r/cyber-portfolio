// src/components/layout/ChromeGate.tsx
//
// Hides the shared header/footer on full-screen tools that bring their own toolbar:
// the admin dashboard, the template editor and the full-screen template viewer.
'use client';

import { usePathname } from 'next/navigation';

const HIDDEN_ON = ['/admin', '/builder/edit', '/builder/view'];

export default function ChromeGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '';
  if (HIDDEN_ON.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;
  return <>{children}</>;
}
