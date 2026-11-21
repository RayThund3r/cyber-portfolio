// src/lib/builder/localCopy.ts
//
// A private, on-device copy of every site the visitor edits. Why: on a host without a database (Vercel before Upstash Redis is
// connected) the server can forget sites whenever an instance restarts. The browser still has the whole site, so when the server says
// "not found" the editor sends this copy back (action "restore") under the SAME id and key and carries on as if nothing happened.
//
// • settings + layout  → localStorage  (small)
// • pictures           → IndexedDB     (big; best-effort)
// Everything is try/catch: private windows and blocked storage must never break the editor.
import type { SiteConfig } from './schema';
import { referencedAssets } from './sanitize';

export interface LocalCopy { v: 1; id: string; key: string; name: string; templateId: string; templateName: string; config: SiteConfig; rev: number; at: number }

const LS = (id: string) => `sys_copy_${id}`;
const MAX_COPIES = 12;
const MAX_CHARS = 1_500_000;

export function readCopy(id: string): LocalCopy | null {
  try {
    const c = JSON.parse(localStorage.getItem(LS(id)) || 'null');
    return c && c.v === 1 && c.id === id && typeof c.key === 'string' && c.config && typeof c.config === 'object' ? c as LocalCopy : null;
  } catch { return null; }
}

export function listCopyIds(): string[] {
  try {
    const out: { id: string; at: number }[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i) || '';
      if (!k.startsWith('sys_copy_')) continue;
      const c = readCopy(k.slice(9)); if (c) out.push({ id: c.id, at: c.at });
    }
    return out.sort((a, b) => b.at - a.at).map((x) => x.id);
  } catch { return []; }
}

export function writeCopy(c: Omit<LocalCopy, 'v' | 'at'>): boolean {
  let s: string;
  try { s = JSON.stringify({ ...c, v: 1, at: Date.now() }); } catch { return false; }
  if (s.length > MAX_CHARS) return false;
  const put = () => { localStorage.setItem(LS(c.id), s); return true; };
  try { return put(); } catch { /* quota: drop the oldest other copies and try once more */ }
  try { for (const old of listCopyIds().filter((x) => x !== c.id).slice(3)) localStorage.removeItem(LS(old)); return put(); } catch { return false; }
}

export function dropCopy(id: string) {
  try { localStorage.removeItem(LS(id)); } catch { /* ignore */ }
  void idb((s) => s.delete(id)).catch(() => {});
}

export function pruneCopies(keep: string[]) {
  try { for (const id of listCopyIds().slice(MAX_COPIES)) if (!keep.includes(id)) dropCopy(id); } catch { /* ignore */ }
}

/* ───────── pictures in IndexedDB ───────── */
function idb<T>(fn: (s: IDBObjectStore) => IDBRequest<T>, mode: IDBTransactionMode = 'readwrite'): Promise<T> {
  return new Promise((res, rej) => {
    try {
      const open = indexedDB.open('sys_builder_copy', 1);
      open.onupgradeneeded = () => { open.result.createObjectStore('assets'); };
      open.onerror = () => rej(open.error);
      open.onsuccess = () => {
        const db = open.result;
        try {
          const tx = db.transaction('assets', mode); const rq = fn(tx.objectStore('assets'));
          tx.oncomplete = () => { db.close(); res(rq.result); };
          tx.onerror = tx.onabort = () => { db.close(); rej(tx.error); };
        } catch (e) { db.close(); rej(e); }
      };
    } catch (e) { rej(e); }
  });
}
/** assets: id → data URL (the same map the editor keeps). */
export const writeAssets = (id: string, assets: Record<string, string>) => idb((s) => s.put(assets, id)).then(() => true, () => false);
export const readAssets = (id: string): Promise<Record<string, string>> => idb((s) => s.get(id), 'readonly').then((v) => (v && typeof v === 'object' ? v as Record<string, string> : {}), () => ({}));

/* ───────── send a copy back to the server ───────── */
type Post = (url: string, body: unknown) => Promise<any>;
const dataParts = (u: string) => { const m = /^data:([a-z/+-]+);base64,(.+)$/i.exec(u); return m ? { mime: m[1], data: m[2] } : null; };

/** Recreates the site on the server under its own id/key, then re-attaches its pictures. Returns how many pictures could not be restored. */
export async function restoreToServer(post: Post, c: Pick<LocalCopy, 'id' | 'key' | 'name' | 'templateId' | 'templateName' | 'config'>, assets: Record<string, string>): Promise<{ missing: number }> {
  const used = [...referencedAssets(c.config)];
  const have = used.filter((a) => assets[a]);
  await post('/api/builder', { action: 'restore', id: c.id, key: c.key, name: c.name, templateId: c.templateId, templateName: c.templateName, config: c.config, assetIds: have });
  let failed = 0;
  for (const aid of have) {
    const p = dataParts(assets[aid]); if (!p) { failed++; continue; }
    try { await post('/api/builder', { action: 'restoreAsset', id: c.id, key: c.key, assetId: aid, mime: p.mime, data: p.data }); } catch { failed++; }
  }
  return { missing: used.length - have.length + failed };
}

/* ───────── backup file (download from the editor, import anywhere) ───────── */
export interface BackupFile { kind: 'sys-builder-backup'; v: 1; name: string; config: SiteConfig; assets: Record<string, string>; templateId?: string; templateName?: string }
export function parseBackup(text: string): BackupFile | null {
  try {
    const b = JSON.parse(text);
    if (!b || b.kind !== 'sys-builder-backup' || !b.config || typeof b.config !== 'object') return null;
    return { kind: b.kind, v: 1, name: String(b.name || 'Imported site').slice(0, 60), config: b.config, assets: b.assets && typeof b.assets === 'object' ? b.assets : {}, templateId: typeof b.templateId === 'string' ? b.templateId : undefined, templateName: typeof b.templateName === 'string' ? b.templateName : undefined };
  } catch { return null; }
}
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const rand = (n: number, a: string) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (x) => a[x % a.length]).join('');
/** Imports a backup as a brand-new site (fresh id + key). Returns the edit address parts. */
export async function importBackup(post: Post, b: BackupFile): Promise<{ id: string; key: string; missing: number }> {
  const key = rand(20, 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789');
  for (let i = 0; i < 4; i++) {
    const id = 'PRJ-' + rand(6, ALPHA);
    try { const r = await restoreToServer(post, { id, key, name: b.name, templateId: b.templateId || 'blank', templateName: b.templateName || 'Website', config: b.config }, b.assets); return { id, key, missing: r.missing }; }
    catch (e: any) { if (e?.status !== 409) throw e; }
  }
  throw new Error('Could not find a free site address. Please try again.');
}
