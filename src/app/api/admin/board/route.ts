import { admin } from '@/lib/admin/api';
import { db } from '@/lib/admin/store';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export interface Card { id: string; text: string; col: 'todo' | 'doing' | 'done'; tag: string; ts: number }
const clean = (v: unknown): Card[] => (Array.isArray(v) ? v : []).slice(0, 300).map((c) => ({
  id: String(c?.id || '').slice(0, 24) || Math.random().toString(36).slice(2, 9),
  text: String(c?.text || '').replace(/[\u0000-\u001f]+/g, ' ').slice(0, 300),
  col: (['todo', 'doing', 'done'].includes(c?.col) ? c.col : 'todo') as Card['col'],
  tag: String(c?.tag || '').slice(0, 20), ts: Number(c?.ts) || Date.now(),
})).filter((c) => c.text.trim());
export const GET = admin(async () => ({ cards: clean(await db.getJSON<unknown>('admin:board', [])) }));
export const PUT = admin(async ({ body }) => { const cards = clean(body.cards); await db.setJSON('admin:board', cards); return { cards }; }, true);
