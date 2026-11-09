// src/lib/admin/inbox.ts — every message sent through the contact form / chat hand-off is also kept here so the
// owner can read, star, tag and answer it from the panel, even if the email never arrived.
import { db, getStore } from './store';
import { dayKey } from './track';
import { randomToken } from './crypto';
import { notify } from './auth';

export type MsgStatus = 'new' | 'read' | 'done' | 'spam';
export interface InboxMessage {
  id: string; ts: number; kind: string; name: string; email: string; phone: string; service: string; details: string;
  transcript: string; files: string[]; mailed: boolean; status: MsgStatus; starred: boolean; note: string; country?: string;
}
const KEY = 'inbox';

export async function addMessage(m: Pick<InboxMessage, 'kind' | 'name' | 'email' | 'phone' | 'service' | 'details' | 'transcript' | 'files' | 'mailed'> & { country?: string }): Promise<string> {
  const id = Date.now().toString(36) + randomToken(3);
  const full: InboxMessage = { id, ts: Date.now(), status: 'new', starred: false, note: '', ...m };
  await db.hsetJSON(KEY, id, full);
  await getStore().cmd('HINCRBY', 'inbox:count', dayKey(), 1).catch(() => 0);
  void notify(`📨 New ${m.kind.toLowerCase()} message from ${m.name}: ${m.details.slice(0, 120)}`);
  return id;
}
export async function listMessages(): Promise<InboxMessage[]> {
  const all = await db.hgetAllJSON<InboxMessage>(KEY);
  return all.sort((a, b) => b.ts - a.ts).slice(0, 500);
}
export async function patchMessage(id: string, patch: Partial<Pick<InboxMessage, 'status' | 'starred' | 'note'>>): Promise<InboxMessage | null> {
  const cur = await db.hgetJSON<InboxMessage>(KEY, id);
  if (!cur) return null;
  const next: InboxMessage = { ...cur };
  if (patch.status && ['new', 'read', 'done', 'spam'].includes(patch.status)) next.status = patch.status;
  if (typeof patch.starred === 'boolean') next.starred = patch.starred;
  if (typeof patch.note === 'string') next.note = patch.note.slice(0, 2000);
  await db.hsetJSON(KEY, id, next);
  return next;
}
export const deleteMessage = (id: string) => db.hdel(KEY, id);
