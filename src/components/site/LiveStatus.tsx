// src/components/site/LiveStatus.tsx — the SYSTEM_STATUS badge: follows the visitor's connection and the server's health.
'use client';

import Icon from '@/components/ui/Icon';
import type { NetState } from '@/lib/useNetStatus';

const VIEW: Record<NetState, { label: string; tone: string; dot: string; icon: 'wifi' | 'wifioff' | 'server'; summary: string; hint: string }> = {
  checking: { label: 'CHECKING', tone: 'text-zinc-400', dot: 'bg-zinc-500', icon: 'wifi', summary: 'RUNNING_SELF_TEST', hint: 'Checking the connection' },
  online: { label: 'ONLINE', tone: 'text-emerald-400', dot: 'bg-emerald-400', icon: 'wifi', summary: 'SECURE_ENVIRONMENT // 100% OPERATIONAL', hint: 'You are connected and the server is responding' },
  offline: { label: 'OFFLINE', tone: 'text-amber-400', dot: 'bg-amber-400', icon: 'wifioff', summary: 'NO_CONNECTION // SAVED_PAGES_STILL_WORK', hint: 'You are offline. Forms and chat will work again when you reconnect' },
  'server-down': { label: 'SERVER_UNREACHABLE', tone: 'text-red-400', dot: 'bg-red-400', icon: 'server', summary: 'SERVER_NOT_RESPONDING // RETRYING', hint: 'You are online but the server is not answering. Retrying automatically' },
};

export function StatusBadge({ state }: { state: NetState }) {
  const s = VIEW[state];
  return (
    <span className={`flex items-center gap-2 ${s.tone}`} role="status" aria-live="polite" title={s.hint}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot} ${state === 'checking' || state === 'online' ? 'animate-pulse' : ''}`} />
      <Icon name={s.icon} size={12} />
      SYSTEM_STATUS: {s.label}
    </span>
  );
}

export function StatusSummary({ state }: { state: NetState }) {
  const s = VIEW[state];
  return <span className={`font-semibold ${state === 'online' ? 'text-accent' : s.tone}`}>{s.summary}</span>;
}

