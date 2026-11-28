// src/server/repairs.ts — the "Recent work" before / after gallery (repairs, restores, redesigns). Details in one small list;
// the two pictures of each job sit under their own keys and are read only when someone looks.
import { readJson, removeJson, writeJson, update } from './store';
import { parseImage, cleanId } from './art';

export interface RepairItem { id: string; title: string; note: string; kind: 'repair' | 'design'; shown: boolean; w: number; h: number; v: number }
const LIST = 'repair-list', imgKey = (id: string, s: 'before' | 'after') => `repair-${s}-${id}`;
export const MAX_REPAIRS = 60, MAX_REPAIR_IMG = 480_000;
const txt = (v: unknown, n: number) => String(v ?? '').replace(/[\u0000-\u001f<>]+/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, n);
const newId = () => 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

export const listRepairs = (): Promise<RepairItem[]> => readJson<RepairItem[]>(LIST, []).then((l) => (Array.isArray(l) ? l : []));

export async function getRepairImage(id: string, side: 'before' | 'after'): Promise<{ type: string; bytes: Buffer } | null> {
  const p = parseImage(await readJson<string>(imgKey(cleanId(id), side), ''), MAX_REPAIR_IMG + 10);
  return p ? { type: p.type, bytes: Buffer.from(p.b64, 'base64') } : null;
}

export async function saveRepair(input: { item: unknown; before?: unknown; after?: unknown; w?: unknown; h?: unknown }): Promise<RepairItem[]> {
  const raw = (input.item && typeof input.item === 'object' ? input.item : {}) as Record<string, unknown>;
  const list = await listRepairs();
  const prev = list.find((r) => r.id === cleanId(raw.id));
  const b = input.before ? parseImage(input.before, MAX_REPAIR_IMG) : null;
  const a = input.after ? parseImage(input.after, MAX_REPAIR_IMG) : null;
  if ((input.before && !b) || (input.after && !a)) throw Object.assign(new Error('A picture is not valid or is too large.'), { status: 400 });
  if (!prev && (!b || !a)) throw Object.assign(new Error('Add both the before and the after picture.'), { status: 400 });
  if (!prev && list.length >= MAX_REPAIRS) throw Object.assign(new Error(`Up to ${MAX_REPAIRS} jobs. Delete one first.`), { status: 400 });
  const item: RepairItem = {
    id: prev?.id || cleanId(raw.id) || newId(), title: txt(raw.title ?? prev?.title, 80) || 'Repair', note: txt(raw.note ?? prev?.note, 160),
    kind: (raw.kind ?? prev?.kind) === 'design' ? 'design' : 'repair', shown: (raw.shown ?? prev?.shown) !== false,
    w: prev?.w || 0, h: prev?.h || 0, v: prev?.v || 0,
  };
  if (b) await writeJson(imgKey(item.id, 'before'), `data:${b.type};base64,${b.b64}`);
  if (a) await writeJson(imgKey(item.id, 'after'), `data:${a.type};base64,${a.b64}`);
  if (b || a) {
    item.v = (prev?.v || 0) + 1;
    item.w = Math.max(0, Math.min(8000, Math.round(Number(input.w) || item.w)));
    item.h = Math.max(0, Math.min(8000, Math.round(Number(input.h) || item.h)));
  }
  return update<RepairItem[]>(LIST, [], (l) => { const i = l.findIndex((r) => r.id === item.id); if (i >= 0) l[i] = item; else l.unshift(item); });
}

export async function deleteRepair(id: string): Promise<RepairItem[]> {
  const k = cleanId(id);
  await Promise.all([removeJson(imgKey(k, 'before')), removeJson(imgKey(k, 'after'))]);
  return update<RepairItem[]>(LIST, [], (l) => l.filter((r) => r.id !== k));
}

export function moveRepair(id: string, dir: 'up' | 'down'): Promise<RepairItem[]> {
  const k = cleanId(id);
  return update<RepairItem[]>(LIST, [], (l) => {
    const i = l.findIndex((r) => r.id === k), j = dir === 'up' ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= l.length) return;
    [l[i], l[j]] = [l[j], l[i]];
  });
}
