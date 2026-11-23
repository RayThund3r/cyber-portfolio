// src/lib/pdfText.ts — text extraction from PDF bytes, in the browser, no library.
// Handles what real PDFs from Word, Chrome, LibreOffice and Google Docs actually contain: compressed object streams,
// page order, subset fonts whose glyph codes are mapped back to Unicode through /ToUnicode CMaps, and line layout.
// Scanned (image-only) PDFs have no text to extract; the caller says so.

export type Inflate = (data: Uint8Array, format: 'deflate' | 'deflate-raw', cap?: number) => Promise<Uint8Array | null>;

const MAX_OBJS = 30_000;
const MAX_PAGES = 150;
const MAX_TEXT = 80_000;

interface Obj { dict: string; start: number; end: number }
type CMap = { width: number; map: Map<number, string> };

const L1 = (b: Uint8Array) => { let s = ''; for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode(...b.subarray(i, i + 8192)); return s; };

/** Text of the first balanced << >> at or after `from`. */
function balanced(s: string, from: number): string {
  const i = s.indexOf('<<', from);
  if (i < 0) return '';
  let depth = 0;
  for (let k = i; k < s.length - 1; k++) {
    if (s[k] === '<' && s[k + 1] === '<') { depth++; k++; }
    else if (s[k] === '>' && s[k + 1] === '>') { depth--; k++; if (depth === 0) return s.slice(i, k + 1); }
  }
  return s.slice(i, i + 4000);
}

const hexToStr = (h: string) => { let o = ''; for (let i = 0; i + 3 < h.length; i += 4) o += String.fromCharCode(parseInt(h.slice(i, i + 4), 16)); return h.length === 2 ? String.fromCharCode(parseInt(h, 16)) : o; };

export function parseCMap(text: string): CMap | null {
  const map = new Map<number, string>();
  let width = 1;
  for (const blk of text.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const m of blk[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]*)>/g)) {
      width = Math.max(width, Math.ceil(m[1].length / 2));
      if (map.size < 70_000) map.set(parseInt(m[1], 16), hexToStr(m[2].length === 2 ? m[2] : m[2].padStart(4, '0')));
    }
  }
  for (const blk of text.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    for (const m of blk[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*(?:<([0-9A-Fa-f]*)>|\[([^\]]*)\])/g)) {
      width = Math.max(width, Math.ceil(m[1].length / 2));
      const lo = parseInt(m[1], 16), hi = Math.min(parseInt(m[2], 16), lo + 65_535);
      if (m[3] !== undefined) {
        const base = hexToStr(m[3].padStart(4, '0'));
        const last = base.charCodeAt(base.length - 1);
        for (let c = lo; c <= hi && map.size < 70_000; c++) map.set(c, base.slice(0, -1) + String.fromCharCode(last + (c - lo)));
      } else if (m[4] !== undefined) {
        const items = [...m[4].matchAll(/<([0-9A-Fa-f]*)>/g)];
        for (let c = lo; c <= hi && c - lo < items.length && map.size < 70_000; c++) map.set(c, hexToStr(items[c - lo][1].padStart(4, '0')));
      }
    }
  }
  return map.size ? { width, map } : null;
}

function pdfLiteral(s: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch !== '\\') { out.push(s.charCodeAt(i) & 255); continue; }
    const n = s[++i];
    if (n === undefined) break;
    if (n === 'n') out.push(10); else if (n === 'r' || n === 't') out.push(32); else if (n === 'b' || n === 'f') continue;
    else if (/[0-7]/.test(n)) { let o = n; while (o.length < 3 && /[0-7]/.test(s[i + 1] || '')) o += s[++i]; out.push(parseInt(o, 8) & 255); }
    else if (n === '\r' || n === '\n') continue;
    else out.push(n.charCodeAt(0) & 255);
  }
  return out;
}

function decode(codes: number[], cm: CMap | null): string {
  if (cm) {
    let o = '';
    if (cm.width >= 2) for (let i = 0; i + 1 < codes.length; i += 2) o += cm.map.get((codes[i] << 8) | codes[i + 1]) ?? '';
    else for (const c of codes) o += cm.map.get(c) ?? '';
    return o;
  }
  return codes.every((c) => c === 10 || (c >= 32 && c < 127) || c >= 160) ? String.fromCharCode(...codes) : '';
}

const TOKEN = /\/([^\s/\[\]()<>]+)\s+(-?[\d.]+)\s+Tf|\[((?:[^\]\\]|\\.)*)\]\s*TJ|\(((?:[^()\\]|\\.|\((?:[^()\\]|\\.)*\))*)\)\s*(?:Tj|'|")|<([0-9A-Fa-f\s]+)>\s*Tj|(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+Tm|(-?[\d.]+)\s+(-?[\d.]+)\s+T[dD]|\bT\*|\bBT\b/g;

/** Text of one content stream. `fontMap` resolves a font resource name (/F1) to its CMap. */
export function contentToText(c: string, fontMap: (name: string) => CMap | null): string {
  const lines: string[] = [];
  let line = '', cm: CMap | null = null, x = 0, y = 0, lineY = NaN, fs = 10, runX = 0, runLen = 0;
  const flush = () => { if (line.trim()) lines.push(line.trim()); line = ''; };
  const add = (t: string) => { line += t; runLen += t.length; };
  // After a move: new line if y changed; on the same line, a wide jump (table cell, column) gets a space.
  const moved = (nx: number, ny: number) => {
    if (!Number.isNaN(lineY) && Math.abs(ny - lineY) > 1) { flush(); runLen = 0; }
    else if (line && nx - runX > runLen * 0.5 * fs + 0.6 * fs && !line.endsWith(' ')) line += ' ';
    lineY = ny; runX = nx; runLen = 0;
  };
  TOKEN.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TOKEN.exec(c))) {
    if (m[1] !== undefined) { cm = fontMap(m[1]); fs = Math.abs(Number(m[2])) || fs; }
    else if (m[3] !== undefined) {
      for (const p of m[3].matchAll(/\(((?:[^()\\]|\\.)*)\)|<([0-9A-Fa-f\s]*)>|(-?\d+(?:\.\d+)?)/g)) {
        if (p[1] !== undefined) add(decode(pdfLiteral(p[1]), cm));
        else if (p[2] !== undefined) { const h = p[2].replace(/\s+/g, ''); const codes: number[] = []; for (let i = 0; i + 1 < h.length; i += 2) codes.push(parseInt(h.slice(i, i + 2), 16)); add(decode(codes, cm)); }
        else if (Number(p[3]) < -220) add(' ');
      }
    } else if (m[4] !== undefined) { if (m[0].endsWith("'") || m[0].endsWith('"')) flush(); add(decode(pdfLiteral(m[4]), cm)); }
    else if (m[5] !== undefined) { const h = m[5].replace(/\s+/g, ''); const codes: number[] = []; for (let i = 0; i + 1 < h.length; i += 2) codes.push(parseInt(h.slice(i, i + 2), 16)); add(decode(codes, cm)); }
    else if (m[6] !== undefined) { x = Number(m[10]); y = Number(m[11]); moved(x, y); }
    else if (m[12] !== undefined) { x += Number(m[12]); y += Number(m[13]); moved(x, y); }
    else if (m[0] === 'T*') flush();
    else if (m[0] === 'BT') { x = 0; y = 0; runLen = 0; }
  }
  flush();
  return reflow(lines);
}

/** Join lines that were only wrapped (not paragraph ends) so sentences stay whole. */
export function reflow(lines: string[]): string {
  const out: string[] = [];
  for (const l of lines) {
    const prev = out[out.length - 1];
    if (prev && !/[.!?:;]$/.test(prev) && /^[a-z(]/.test(l) && prev.length > 25) out[out.length - 1] = prev + ' ' + l;
    else out.push(l);
  }
  return out.join('\n');
}

export async function extractPdf(b: Uint8Array, inflate: Inflate): Promise<{ text: string; pages: number; encrypted?: boolean }> {
  const s = L1(b);
  if (/\/Encrypt\s+\d+\s+\d+\s+R|\/Encrypt\s*<</.test(s.slice(-4000) + s.slice(0, 1000))) return { text: '', pages: (s.match(/\/Type\s*\/Page\b(?!s)/g) || []).length, encrypted: true };
  const objs = new Map<number, Obj>();
  const order: number[] = [];
  const re = /(\d+)\s+\d+\s+obj\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) && objs.size < MAX_OBJS) {
    const num = Number(m[1]);
    const start = m.index + m[0].length;
    const st = s.indexOf('stream', start), eo = s.indexOf('endobj', start);
    let o: Obj;
    if (st >= 0 && (eo < 0 || st < eo) && /^stream\r?\n/.test(s.slice(st, st + 8))) {
      const dict = s.slice(start, st);
      const ds = st + (s[st + 6] === '\r' ? 8 : 7);
      const len = /\/Length\s+(\d+)(?!\s+\d+\s+R)/.exec(dict);
      let de = len && ds + Number(len[1]) <= b.length && s.startsWith('endstream', ds + Number(len[1]) + (/^[\r\n]/.test(s.slice(ds + Number(len[1]), ds + Number(len[1]) + 2)) ? (s[ds + Number(len[1])] === '\r' && s[ds + Number(len[1]) + 1] === '\n' ? 2 : 1) : 0)) ? ds + Number(len[1]) : s.indexOf('endstream', ds);
      if (de < 0) de = ds;
      o = { dict, start: ds, end: de };
      re.lastIndex = de;
    } else {
      o = { dict: s.slice(start, eo < 0 ? start : eo), start: -1, end: -1 };
    }
    if (!objs.has(num)) { objs.set(num, o); order.push(num); }
  }

  const streamBytes = async (o: Obj): Promise<Uint8Array | null> => {
    if (o.start < 0) return null;
    if (/\/Filter/.test(o.dict) && !/\/FlateDecode|\/Fl\b/.test(o.dict)) return null;
    if (/\/Filter\s*\[[^\]]*\][^]*?\/Filter/.test(o.dict)) return null;
    if (/\/DecodeParms[^>]*\/Predictor\s*(?:1[0-5]|2)/.test(o.dict) && /\/Type\s*\/ObjStm/.test(o.dict)) return null;
    let raw = b.subarray(o.start, o.end);
    if (!/\/FlateDecode|\/Fl\b/.test(o.dict)) return raw.length > 3_000_000 ? null : raw;
    if (raw.length > 1_500_000) return null;
    if (raw[raw.length - 1] === 0x0a) raw = raw.subarray(0, raw.length - (raw[raw.length - 2] === 0x0d ? 2 : 1));
    else if (raw[raw.length - 1] === 0x0d) raw = raw.subarray(0, raw.length - 1);
    return (await inflate(raw, 'deflate')) ?? (await inflate(b.subarray(o.start, o.end), 'deflate'));
  };

  // objects hidden inside compressed object streams (PDF 1.5+)
  for (const num of [...order]) {
    const o = objs.get(num)!;
    if (o.start < 0 || !/\/Type\s*\/ObjStm/.test(o.dict)) continue;
    const n = Number(/\/N\s+(\d+)/.exec(o.dict)?.[1] || 0), first = Number(/\/First\s+(\d+)/.exec(o.dict)?.[1] || 0);
    const data = await streamBytes(o);
    if (!data || !n || !first) continue;
    const t = L1(data);
    const nums = (t.slice(0, first).match(/\d+/g) || []).map(Number);
    for (let i = 0; i < n && i * 2 + 1 < nums.length; i++) {
      const id = nums[i * 2], off = first + nums[i * 2 + 1];
      const end = i + 1 < n ? first + nums[(i + 1) * 2 + 1] : t.length;
      if (!objs.has(id) && objs.size < MAX_OBJS) { objs.set(id, { dict: t.slice(off, end), start: -1, end: -1 }); order.push(id); }
    }
  }

  const refOf = (dict: string, key: string) => { const r = new RegExp(`/${key}\\s+(\\d+)\\s+\\d+\\s+R`).exec(dict); return r ? Number(r[1]) : 0; };
  /** The dictionary value of /Key: inline << >> or a reference to an object. */
  const dictOf = (dict: string, key: string): string => {
    const k = new RegExp(`/${key}\\b\\s*(<<|\\d+\\s+\\d+\\s+R)`).exec(dict);
    if (!k) return '';
    if (k[1] === '<<') return balanced(dict, k.index + k[0].length - 2);
    const o = objs.get(Number(k[1].split(/\s+/)[0]));
    return o ? balanced(o.dict, 0) || o.dict : '';
  };

  const cmapCache = new Map<number, CMap | null>();
  const cmapForFont = async (fontNum: number): Promise<CMap | null> => {
    if (cmapCache.has(fontNum)) return cmapCache.get(fontNum)!;
    let cm: CMap | null = null;
    const f = objs.get(fontNum);
    const tu = f ? objs.get(refOf(f.dict, 'ToUnicode')) : undefined;
    if (tu) { const d = await streamBytes(tu); if (d) cm = parseCMap(L1(d)); }
    cmapCache.set(fontNum, cm);
    return cm;
  };

  // pages, in reading order
  const pageNums = order.filter((n) => /\/Type\s*\/Page\b(?!s)/.test(objs.get(n)!.dict));
  let ordered: number[] = [];
  const cat = order.find((n) => /\/Type\s*\/Catalog/.test(objs.get(n)!.dict));
  const walk = (n: number, depth = 0) => {
    const o = objs.get(n); if (!o || depth > 12 || ordered.length > MAX_PAGES) return;
    if (/\/Type\s*\/Page\b(?!s)/.test(o.dict)) { ordered.push(n); return; }
    const kids = /\/Kids\s*\[([^\]]*)\]/.exec(o.dict)?.[1] || '';
    for (const r of kids.matchAll(/(\d+)\s+\d+\s+R/g)) walk(Number(r[1]), depth + 1);
  };
  if (cat) walk(refOf(objs.get(cat)!.dict, 'Pages'));
  if (!ordered.length) ordered = pageNums.slice(0, MAX_PAGES);

  const inherited = (n: number, key: string, depth = 0): string => {
    const o = objs.get(n); if (!o || depth > 8) return '';
    const d = dictOf(o.dict, key);
    if (d) return d;
    const parent = refOf(o.dict, 'Parent');
    return parent ? inherited(parent, key, depth + 1) : '';
  };

  const texts: string[] = [];
  let total = 0;
  const handled = new Set<number>();
  const fontsFor = async (pageNum: number) => {
    const res = inherited(pageNum, 'Resources');
    const fd = res ? (dictOf(res, 'Font') || '') : '';
    const names = new Map<string, number>();
    for (const r of fd.matchAll(/\/([^\s/<>\[\]()]+)\s+(\d+)\s+\d+\s+R/g)) names.set(r[1], Number(r[2]));
    const maps = new Map<string, CMap | null>();
    for (const [name, num] of names) maps.set(name, await cmapForFont(num));
    return (name: string) => maps.get(name) ?? null;
  };

  for (const pn of ordered) {
    if (total >= MAX_TEXT) break;
    const po = objs.get(pn)!;
    const cs = /\/Contents\s*(?:(\d+)\s+\d+\s+R|\[([^\]]*)\])/.exec(po.dict);
    const refs = cs ? (cs[1] ? [Number(cs[1])] : [...(cs[2] || '').matchAll(/(\d+)\s+\d+\s+R/g)].map((r) => Number(r[1]))) : [];
    const fm = await fontsFor(pn);
    const parts: string[] = [];
    for (const r of refs) {
      const co = objs.get(r); if (!co) continue;
      handled.add(r);
      const d = await streamBytes(co); if (!d) continue;
      parts.push(L1(d));
    }
    const t = contentToText(parts.join('\n'), fm);
    if (t) { texts.push(t); total += t.length; }
  }

  // Fallback: no usable page tree. Read every stream that holds text, fonts matched by resource name across the file.
  if (!texts.length) {
    const global = new Map<string, number>();
    for (const n of order) for (const bl of objs.get(n)!.dict.matchAll(/\/Font\s*<<([^<>]*)>>/g)) for (const r of bl[1].matchAll(/\/([^\s/<>\[\]()]+)\s+(\d+)\s+\d+\s+R/g)) if (!global.has(r[1])) global.set(r[1], Number(r[2]));
    const maps = new Map<string, CMap | null>();
    for (const [name, num] of global) maps.set(name, await cmapForFont(num));
    for (const n of order) {
      const o = objs.get(n)!;
      if (o.start < 0 || handled.has(n) || total >= MAX_TEXT) continue;
      if (/\/Subtype\s*\/(?:Image|Type1C|CIDFontType0C|OpenType)|\/FontFile|\/Type\s*\/(?:XObject|Metadata|ObjStm|XRef)|\/Length1/.test(o.dict)) continue;
      const d = await streamBytes(o); if (!d) continue;
      const body = L1(d);
      if (!/\bBT\b/.test(body)) continue;
      const t = contentToText(body, (name) => maps.get(name) ?? null);
      if (t) { texts.push(t); total += t.length; }
    }
  }

  const pageCount = pageNums.length || ordered.length;
  return { text: texts.join('\n\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, MAX_TEXT), pages: pageCount };
}
