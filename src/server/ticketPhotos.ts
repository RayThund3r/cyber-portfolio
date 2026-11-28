// src/server/ticketPhotos.ts — the photos a customer attaches to a repair or design request. Each photo sits under its own key
// (not inside the ticket), so the ticket list stays small and a photo is only read when the owner opens that ticket.
import { readJson, removeJson, writeJson } from './store';
import { parseImage } from './art';

export const MAX_TICKET_PHOTOS = 3, MAX_TICKET_PHOTO = 190_000;
const key = (id: string, n: number) => `tphoto-${id}-${n}`;
const safeId = (id: string) => /^[A-Za-z0-9-]{4,30}$/.test(id);

/** Does the data really start like the image type it claims? (a renamed file is refused) */
function looksLikeImage(type: string, b64: string): boolean {
  const b = Buffer.from(b64.slice(0, 24), 'base64');
  if (type === 'image/jpeg') return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  if (type === 'image/png') return b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
  if (type === 'image/webp') return b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP';
  return false;
}

/** Checks what the browser sent (data URLs). Returns the good ones, as { type, b64 }. */
export function validPhotos(raw: unknown): { type: string; b64: string }[] {
  if (!Array.isArray(raw)) return [];
  const out: { type: string; b64: string }[] = [];
  for (const r of raw.slice(0, MAX_TICKET_PHOTOS)) {
    const p = parseImage(r, MAX_TICKET_PHOTO);
    if (p && looksLikeImage(p.type, p.b64)) out.push(p);
  }
  return out;
}

export async function saveTicketPhotos(id: string, photos: { type: string; b64: string }[]): Promise<number> {
  if (!safeId(id)) return 0;
  let n = 0;
  for (const p of photos.slice(0, MAX_TICKET_PHOTOS)) { await writeJson(key(id, n), `data:${p.type};base64,${p.b64}`); n++; }
  return n;
}

export async function getTicketPhotos(id: string, count: number): Promise<string[]> {
  if (!safeId(id)) return [];
  const out: string[] = [];
  for (let i = 0; i < Math.min(count, MAX_TICKET_PHOTOS); i++) { const v = await readJson<string>(key(id, i), ''); if (v) out.push(v); }
  return out;
}

export async function deleteTicketPhotos(id: string): Promise<void> {
  if (!safeId(id)) return;
  await Promise.all([0, 1, 2].map((i) => removeJson(key(id, i)).catch(() => undefined)));
}
