// src/components/builder/lib.ts — small client helpers shared by the builder UI.
'use client';

export async function post(url: string, body: unknown, signal?: AbortSignal) {
  let r: Response;
  try { r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal }); }
  catch (e: any) {
    if (e?.name === 'AbortError') throw e;
    throw Object.assign(new Error(typeof navigator !== 'undefined' && navigator.onLine === false ? 'You are offline. Reconnect and try again.' : 'Could not reach the server. Check your connection and try again.'), { status: 0, offline: true });
  }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(d.error || 'Request failed'), { status: r.status, data: d });
  return d;
}

export interface Packed { mime: string; data: string; dataUrl: string; name: string }

const readBlob = (b: Blob, name: string) =>
  new Promise<Packed>((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => { const u = String(fr.result); res({ mime: b.type, data: u.split(',')[1], dataUrl: u, name }); };
    fr.onerror = () => rej(new Error('Could not read that file.'));
    fr.readAsDataURL(b);
  });

/** Any file → base64 (for AI attachments). */
export const fileToPacked = (f: File) => readBlob(f, f.name);

/** Resize + compress a picture in the browser so uploads stay small and fast on mobile data. */
export async function compressImage(file: File): Promise<Packed> {
  if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) throw new Error('Please choose a JPG, PNG, WebP or GIF picture.');
  if (file.type === 'image/gif' && file.size <= 550 * 1024) return readBlob(file, file.name);
  const bmp = await createImageBitmap(file);
  const sc = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(bmp.width * sc)); c.height = Math.max(1, Math.round(bmp.height * sc));
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  const to = (type: string, q?: number) => new Promise<Blob | null>((r) => c.toBlob(r, type, q));
  let blob = file.type === 'image/png' ? await to('image/png') : null; // keep transparency for logos when small enough
  if (!blob || blob.size > 450 * 1024) for (const q of [0.85, 0.75, 0.62, 0.5, 0.4]) { blob = await to('image/jpeg', q); if (blob && blob.size <= 550 * 1024) break; }
  if (!blob || blob.size > 580 * 1024) throw new Error('That picture is too big. Please try a smaller one.');
  return readBlob(blob, file.name);
}

/** Safe setter for a path produced by on-canvas editing: "title" or "items.2.text". */
export function setPath(data: Record<string, any>, path: string, value: string): boolean {
  const m = /^([a-zA-Z]+)(?:\.(\d{1,3})\.([a-zA-Z]+))?$/.exec(path);
  if (!m) return false;
  const [, k, i, sub] = m;
  if (i === undefined) { if (typeof data[k] !== 'string') return false; data[k] = value; return true; }
  const arr = data[k];
  if (!Array.isArray(arr) || !arr[+i] || typeof arr[+i][sub] !== 'string') return false;
  arr[+i][sub] = value;
  return true;
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
export const newId = () => Math.random().toString(36).slice(2, 8);
export const lsGet = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
export const lsSet = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } };
export const lsDel = (k: string) => { try { localStorage.removeItem(k); } catch { /* ignore */ } };

/* ───────── purchase helpers (shared by the preview modal, gallery cards, viewer and editor) ───────── */
export interface OrderStatus {
  id: string; name: string; templateId: string; templateName: string; priceUGX: number | null;
  order: { ticket: string; paid: boolean; price: number } | null; contact: string;
}
/** Server-side truth about a project's order (paid or not). Never trust local state for downloads. */
export const fetchStatus = (id: string, key: string): Promise<OrderStatus> => post('/api/builder', { action: 'status', id, key });

/** Downloads the .zip. The server refuses (402) until the payment is confirmed, so this is safe to call from any button. */
export async function downloadProject(project: string, key: string): Promise<void> {
  let r: Response;
  try { r = await fetch('/api/builder/download', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ project, key }) }); }
  catch { throw new Error('Could not reach the server. Check your connection and try again.'); }
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Download failed');
  const a = document.createElement('a');
  const url = URL.createObjectURL(await r.blob());
  a.href = url;
  a.download = /filename="([^"]+)"/.exec(r.headers.get('Content-Disposition') || '')?.[1] || 'website.zip';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
