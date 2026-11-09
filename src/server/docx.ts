// src/server/docx.ts — extract plain text from .docx / .pptx uploads (no dependencies; zip-bomb guarded).
import 'server-only';
import zlib from 'zlib';

const MAX_OUT = 6 * 1024 * 1024;

interface Entry { name: string; method: number; csize: number; offset: number }

function entries(buf: Buffer): Entry[] {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 66_000); i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('Not a valid Office file.');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const out: Entry[] = [];
  for (let n = 0; n < count && p + 46 <= buf.length; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const nameLen = buf.readUInt16LE(p + 28), extraLen = buf.readUInt16LE(p + 30), commentLen = buf.readUInt16LE(p + 32);
    out.push({ name: buf.toString('utf8', p + 46, p + 46 + nameLen), method: buf.readUInt16LE(p + 10), csize: buf.readUInt32LE(p + 20), offset: buf.readUInt32LE(p + 42) });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

function read(buf: Buffer, e: Entry): string {
  const nameLen = buf.readUInt16LE(e.offset + 26), extraLen = buf.readUInt16LE(e.offset + 28);
  const start = e.offset + 30 + nameLen + extraLen;
  const raw = buf.subarray(start, start + e.csize);
  const data = e.method === 0 ? raw : zlib.inflateRawSync(raw, { maxOutputLength: MAX_OUT });
  return data.toString('utf8');
}

const decode = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&amp;/g, '&');

/** Text of a .docx (paragraphs) or .pptx (slides). */
export function extractOfficeText(buf: Buffer): string {
  const all = entries(buf);
  const doc = all.find((e) => e.name === 'word/document.xml');
  const slides = all.filter((e) => /^ppt\/slides\/slide\d+\.xml$/.test(e.name)).sort((a, b) => parseInt(a.name.replace(/\D/g, ''), 10) - parseInt(b.name.replace(/\D/g, ''), 10));
  const xmlToText = (x: string, para: RegExp) => decode(x.replace(para, '\n').replace(/<w:tab\/>/g, '\t').replace(/<a:br\/>|<w:br\/>/g, '\n').replace(/<[^>]+>/g, '')).replace(/\n{3,}/g, '\n\n').trim();
  if (doc) return xmlToText(read(buf, doc), /<\/w:p>/g);
  if (slides.length) return slides.map((s, i) => `--- Slide ${i + 1} ---\n${xmlToText(read(buf, s), /<\/a:p>/g)}`).join('\n\n');
  throw new Error('No readable text found in that file.');
}
