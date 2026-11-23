// src/lib/docText.ts
//
// Pulls readable text out of PDF, Word (.docx), Excel (.xlsx) and PowerPoint (.pptx) files, entirely in the
// browser using the built-in DecompressionStream. No library, no upload, no network.
// Best effort by design: scanned PDFs and unusual font encodings give little or no text, and we say so.
// Hostile files are bounded: entry count, declared size, and the real decompressed size are all capped.

import { extractPdf } from './pdfText';

const MAX_OUT = 4_000_000; // decompressed bytes we are willing to produce for any one part
const MAX_ENTRIES = 3000;
const MAX_TEXT = 80_000; // characters kept

export interface DocText { text: string; note?: string; pages?: number }

async function inflate(data: Uint8Array, format: 'deflate' | 'deflate-raw', cap = MAX_OUT): Promise<Uint8Array | null> {
  if (typeof DecompressionStream === 'undefined') return null;
  try {
    const ds = new DecompressionStream(format);
    const reader = new Blob([data as BlobPart]).stream().pipeThrough(ds).getReader();
    const chunks: Uint8Array[] = [];
    let n = 0;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      n += value.length;
      if (n > cap) { await reader.cancel().catch(() => {}); break; }
      chunks.push(value);
    }
    const out = new Uint8Array(Math.min(n, cap));
    let o = 0;
    for (const c of chunks) { out.set(c.subarray(0, Math.max(0, out.length - o)), o); o += c.length; if (o >= out.length) break; }
    return out;
  } catch {
    return null;
  }
}

const dec = (b: Uint8Array, enc: 'utf-8' | 'latin1' = 'utf-8') => new TextDecoder(enc, { fatal: false }).decode(b);
const u16 = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8);
const u32 = (b: Uint8Array, i: number) => (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0;

/* ------------------------------------------------------------------ zip */

interface ZipEntry { name: string; method: number; csize: number; usize: number; offset: number }

export function listZip(b: Uint8Array): ZipEntry[] {
  let eocd = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 66_000); i--) if (u32(b, i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) return [];
  const total = Math.min(u16(b, eocd + 10), MAX_ENTRIES);
  let p = u32(b, eocd + 16);
  const out: ZipEntry[] = [];
  for (let k = 0; k < total && p + 46 <= b.length && u32(b, p) === 0x02014b50; k++) {
    const nameLen = u16(b, p + 28), extra = u16(b, p + 30), comment = u16(b, p + 32);
    out.push({ name: dec(b.subarray(p + 46, p + 46 + nameLen)), method: u16(b, p + 10), csize: u32(b, p + 20), usize: u32(b, p + 24), offset: u32(b, p + 42) });
    p += 46 + nameLen + extra + comment;
  }
  return out;
}

async function readEntry(b: Uint8Array, e: ZipEntry): Promise<string | null> {
  if (e.usize > MAX_OUT * 2 || e.offset + 30 > b.length || u32(b, e.offset) !== 0x04034b50) return null;
  const start = e.offset + 30 + u16(b, e.offset + 26) + u16(b, e.offset + 28);
  const raw = b.subarray(start, start + e.csize);
  if (e.method === 0) return dec(raw.subarray(0, MAX_OUT));
  if (e.method === 8) { const o = await inflate(raw, 'deflate-raw'); return o ? dec(o) : null; }
  return null;
}

const ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const unxml = (s: string) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, g: string) => {
  if (g[0] === '#') { const n = g[1].toLowerCase() === 'x' ? parseInt(g.slice(2), 16) : parseInt(g.slice(1), 10); return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : ''; }
  return ENT[g.toLowerCase()] ?? m;
});
const tidy = (s: string) => s.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/[ \t]{2,}/g, ' ').trim();

/* ------------------------------------------------------------------ docx / pptx / xlsx */

export function docxXmlToText(xml: string): string {
  return tidy(unxml(xml
    .replace(/<w:tab\/>/g, '\t').replace(/<w:br[^>]*\/>/g, '\n')
    .replace(/<\/w:p>\s*<\/w:tc>/g, '</w:tc>').replace(/<\/w:p>/g, '\n').replace(/<\/w:tc>/g, ' | ').replace(/<\/w:tr>/g, '\n')
    .replace(/<[^>]+>/g, '')));
}

export function pptxXmlToText(xml: string): string {
  return tidy(unxml(xml.replace(/<a:br\s*\/>/g, '\n').replace(/<\/a:p>/g, '\n').replace(/<[^>]+>/g, '')));
}

function colIndex(ref: string): number {
  const m = /^([A-Z]+)/.exec(ref); if (!m) return 0;
  let n = 0; for (const ch of m[1]) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

export function sheetXmlToRows(xml: string, shared: string[]): string[][] {
  const rows: string[][] = [];
  const rowRe = /<row\b[^>]*>([\s\S]*?)<\/row>/g;
  let rm: RegExpExecArray | null;
  while ((rm = rowRe.exec(xml)) && rows.length < 2000) {
    const cells: string[] = [];
    const cellRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let cm: RegExpExecArray | null;
    while ((cm = cellRe.exec(rm[1]))) {
      const attrs = cm[1], inner = cm[2] || '';
      const ref = /\br="([A-Z]+\d+)"/.exec(attrs)?.[1] || '';
      const t = /\bt="(\w+)"/.exec(attrs)?.[1] || '';
      const v = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1] ?? '';
      let val = '';
      if (t === 's') val = shared[Number(v)] ?? '';
      else if (t === 'inlineStr') val = unxml((inner.match(/<t[^>]*>([\s\S]*?)<\/t>/g) || []).map((x) => x.replace(/<[^>]+>/g, '')).join(''));
      else val = unxml(v);
      const idx = ref ? colIndex(ref) : cells.length;
      if (idx > 60) continue;
      while (cells.length < idx) cells.push('');
      cells[idx] = val;
    }
    if (cells.some((c) => c !== '')) rows.push(cells);
  }
  return rows;
}

async function officeText(b: Uint8Array, ext: string): Promise<DocText> {
  const entries = listZip(b);
  if (!entries.length) return { text: '', note: 'The file could not be opened as a document.' };
  const by = new Map(entries.map((e) => [e.name, e] as const));
  const get = async (n: string) => { const e = by.get(n); return e ? readEntry(b, e) : null; };
  if (ext === 'docx') {
    const xml = await get('word/document.xml');
    return { text: xml ? docxXmlToText(xml).slice(0, MAX_TEXT) : '', note: xml ? undefined : 'No document body was found.' };
  }
  if (ext === 'pptx') {
    const slides = entries.filter((e) => /^ppt\/slides\/slide\d+\.xml$/.test(e.name)).sort((a, z) => Number(/(\d+)\.xml$/.exec(a.name)![1]) - Number(/(\d+)\.xml$/.exec(z.name)![1])).slice(0, 80);
    const parts: string[] = [];
    for (const [i, s] of slides.entries()) { const x = await readEntry(b, s); const t = x ? pptxXmlToText(x) : ''; if (t) parts.push(`Slide ${i + 1}: ${t}`); }
    return { text: parts.join('\n\n').slice(0, MAX_TEXT), pages: slides.length };
  }
  // xlsx
  const ss = await get('xl/sharedStrings.xml');
  const shared = ss ? (ss.match(/<si\b[\s\S]*?<\/si>/g) || []).map((si) => unxml((si.match(/<t[^>]*>[\s\S]*?<\/t>/g) || []).map((x) => x.replace(/<[^>]+>/g, '')).join(''))) : [];
  const wb = await get('xl/workbook.xml');
  const names = wb ? [...wb.matchAll(/<sheet\b[^>]*\bname="([^"]*)"/g)].map((m) => unxml(m[1])) : [];
  const sheets = entries.filter((e) => /^xl\/worksheets\/sheet\d+\.xml$/.test(e.name)).sort((a, z) => Number(/(\d+)\.xml$/.exec(a.name)![1]) - Number(/(\d+)\.xml$/.exec(z.name)![1])).slice(0, 12);
  const out: string[] = [];
  for (const [i, s] of sheets.entries()) {
    const x = await readEntry(b, s); if (!x) continue;
    const rows = sheetXmlToRows(x, shared);
    out.push(`Sheet: ${names[i] || `Sheet${i + 1}`} (${rows.length} rows)\n` + rows.map((r) => r.join('\t')).join('\n'));
  }
  return { text: out.join('\n\n').slice(0, MAX_TEXT), pages: sheets.length };
}

/* ------------------------------------------------------------------ pdf */

async function pdfText(b: Uint8Array): Promise<DocText> {
  const { text, pages, encrypted } = await extractPdf(b, inflate);
  if (encrypted) return { text: '', pages: pages || undefined, note: 'This PDF is password-protected, so I can’t read inside it. Remove the password and share it again.' };
  const t = tidy(text).slice(0, MAX_TEXT);
  return { text: t, pages: pages || undefined, note: t.length < 20 ? 'This PDF has no selectable text I can read (it may be scanned or use special fonts).' : undefined };
}

/* ------------------------------------------------------------------ entry point */

export async function extractDocText(bytes: Uint8Array, ext: string): Promise<DocText> {
  try {
    if (ext === 'pdf') return await pdfText(bytes);
    if (ext === 'docx' || ext === 'xlsx' || ext === 'pptx') return await officeText(bytes, ext);
  } catch {
    /* fall through */
  }
  return { text: '', note: 'I could not read the text in this file.' };
}
