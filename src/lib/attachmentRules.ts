// src/lib/attachmentRules.ts
//
// One set of rules for shared files, imported by BOTH the chat (browser) and /api/contact (server),
// so the two can never disagree about what is allowed.
//
//   * small allow-list of safe formats (no SVG/HTML/scripts/executables/archives)
//   * hard size limits, kept under Vercel's ~4.5 MB request-body ceiling once base64-encoded
//   * magic-byte check: a file must really look like what its extension claims

export const ATTACH = {
  maxFiles: 3,
  /** Per file. */
  maxFileBytes: 2 * 1024 * 1024,
  /** All files in one message to the owner (base64 inflates by ~33%, Vercel allows ~4.5 MB bodies). */
  maxTotalBytes: Math.floor(2.5 * 1024 * 1024),
  /** How much of a text file the assistant reads. */
  maxTextChars: 30_000,
} as const;

export type FileKind = 'image' | 'pdf' | 'text';

const IMAGE_EXT = ['png', 'jpg', 'jpeg', 'webp', 'gif'];
const TEXT_EXT = ['txt', 'md', 'csv', 'json', 'log'];

/** Value for <input type="file" accept="...">. */
export const ACCEPT = [...IMAGE_EXT, 'pdf', ...TEXT_EXT].map((e) => '.' + e).join(',');

export const ALLOWED_LABEL = 'PNG, JPG, WEBP, GIF, PDF, TXT, MD, CSV, JSON, LOG';

export function extOf(name: string): string {
  const m = /\.([a-z0-9]{1,8})$/i.exec(name.trim());
  return m ? m[1].toLowerCase() : '';
}

export function kindOfExt(ext: string): FileKind | null {
  if (IMAGE_EXT.includes(ext)) return 'image';
  if (ext === 'pdf') return 'pdf';
  if (TEXT_EXT.includes(ext)) return 'text';
  return null;
}

export function kindOfName(name: string): FileKind | null {
  return kindOfExt(extOf(name));
}

/** Strip any path, control characters and odd symbols; keep it short. Safe for an email attachment name. */
export function sanitizeFilename(name: string): string {
  const base = String(name || 'file').split(/[\\/]/).pop() || 'file';
  const clean = base.replace(/[^\w.\- ()]+/g, '_').replace(/\s+/g, ' ').replace(/^\.+/, '').trim();
  const ext = extOf(clean);
  const stem = ext ? clean.slice(0, -(ext.length + 1)) : clean;
  const out = (stem.slice(0, 80) || 'file') + (ext ? '.' + ext : '');
  return out;
}

/** null when fine, otherwise a visitor-friendly reason. */
export function validateFile(file: { name: string; size: number }): string | null {
  if (!kindOfName(file.name)) return `"${file.name}" isn't a supported type. Allowed: ${ALLOWED_LABEL}.`;
  if (file.size <= 0) return `"${file.name}" is empty.`;
  if (file.size > ATTACH.maxFileBytes) return `"${file.name}" is too large (max ${formatBytes(ATTACH.maxFileBytes)} per file).`;
  return null;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** Does the start of the file match what the extension claims? */
export function matchesSignature(ext: string, b: Uint8Array): boolean {
  const kind = kindOfExt(ext);
  if (!kind || b.length === 0) return false;
  const at = (i: number) => b[i];
  const startsWith = (...bytes: number[]) => bytes.every((v, i) => at(i) === v);
  if (kind === 'image') {
    if (ext === 'png') return startsWith(0x89, 0x50, 0x4e, 0x47);
    if (ext === 'jpg' || ext === 'jpeg') return startsWith(0xff, 0xd8, 0xff);
    if (ext === 'gif') return startsWith(0x47, 0x49, 0x46, 0x38);
    if (ext === 'webp') return startsWith(0x52, 0x49, 0x46, 0x46) && at(8) === 0x57 && at(9) === 0x45 && at(10) === 0x42 && at(11) === 0x50;
    return false;
  }
  if (kind === 'pdf') return startsWith(0x25, 0x50, 0x44, 0x46); // %PDF
  // text: no NUL bytes in the first 2 KB (binary files almost always contain them)
  const n = Math.min(b.length, 2048);
  for (let i = 0; i < n; i++) if (b[i] === 0) return false;
  return true;
}
