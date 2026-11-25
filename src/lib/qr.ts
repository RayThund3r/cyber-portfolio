// src/lib/qr.ts — tiny dependency-free QR code encoder (byte mode, error-correction level M, versions 1–10 = up to ~210 characters).
// Used to show the authenticator-app setup code. Structure follows the public QR spec (ISO/IEC 18004); verified by decoding in tests.
const DATA_M = [16, 28, 44, 64, 86, 108, 124, 154, 182, 216];   // data codewords per version (1..10) at level M
const ECC_M = [10, 16, 26, 18, 24, 16, 18, 22, 22, 26];           // ECC codewords per block
const ALIGN: number[][] = [[], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];

function rawModules(v: number): number {
  let r = (16 * v + 128) * v + 64;
  if (v >= 2) { const n = Math.floor(v / 7) + 2; r -= (25 * n - 10) * n - 55; if (v >= 7) r -= 36; }
  return r;
}
const totalCodewords = (v: number) => Math.floor(rawModules(v) / 8);

/* Reed–Solomon over GF(256), polynomial 0x11D */
const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
(() => { let x = 1; for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11d; } for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]; })();
const mul = (a: number, b: number) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);
function rsDivisor(deg: number): number[] {
  let r = [1];
  for (let i = 0; i < deg; i++) { const n = new Array(r.length + 1).fill(0); for (let j = 0; j < r.length; j++) { n[j] ^= r[j]; n[j + 1] ^= mul(r[j], EXP[i]); } r = n; }
  return r.slice(1);
}
function rsRemainder(data: number[], div: number[]): number[] {
  const rem = new Array(div.length).fill(0);
  for (const b of data) { const f = b ^ (rem.shift() as number); rem.push(0); for (let i = 0; i < div.length; i++) rem[i] ^= mul(div[i], f); }
  return rem;
}

/** Returns a square matrix of booleans (true = dark module), without the quiet zone. */
export function qrMatrix(text: string): boolean[][] {
  const bytes = Array.from(new TextEncoder().encode(text));
  let ver = 0;
  for (let v = 1; v <= 10; v++) { const need = 4 + (v < 10 ? 8 : 16) + 8 * bytes.length; if (need <= DATA_M[v - 1] * 8) { ver = v; break; } }
  if (!ver) throw new Error('Text too long for the QR code.');
  const size = ver * 4 + 17, dataCw = DATA_M[ver - 1], eccLen = ECC_M[ver - 1];
  const nBlocks = (totalCodewords(ver) - dataCw) / eccLen;

  // bit stream
  const bits: number[] = [];
  const put = (val: number, len: number) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
  put(0b0100, 4); put(bytes.length, ver < 10 ? 8 : 16); bytes.forEach((b) => put(b, 8));
  put(0, Math.min(4, dataCw * 8 - bits.length)); while (bits.length % 8) bits.push(0);
  for (let pad = 0xec; bits.length < dataCw * 8; pad ^= 0xec ^ 0x11) put(pad, 8);
  const data: number[] = []; for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(''), 2));

  // blocks + ECC, interleaved
  const shortLen = Math.floor(dataCw / nBlocks), nLong = dataCw % nBlocks, div = rsDivisor(eccLen);
  const blocks: number[][] = [], eccs: number[][] = [];
  for (let i = 0, k = 0; i < nBlocks; i++) { const len = shortLen + (i >= nBlocks - nLong ? 1 : 0); const d = data.slice(k, k + len); k += len; blocks.push(d); eccs.push(rsRemainder(d, div)); }
  const out: number[] = [];
  for (let i = 0; i <= shortLen; i++) blocks.forEach((b) => { if (i < b.length) out.push(b[i]); });
  for (let i = 0; i < eccLen; i++) eccs.forEach((e) => out.push(e[i]));

  // function patterns
  const m: boolean[][] = Array.from({ length: size }, () => new Array(size).fill(false));
  const fn: boolean[][] = Array.from({ length: size }, () => new Array(size).fill(false));
  const set = (x: number, y: number, dark: boolean) => { if (x >= 0 && y >= 0 && x < size && y < size) { m[y][x] = dark; fn[y][x] = true; } };
  for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  const finder = (cx: number, cy: number) => { for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const d = Math.max(Math.abs(dx), Math.abs(dy)); set(cx + dx, cy + dy, d !== 2 && d !== 4); } };
  finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
  const al = ALIGN[ver - 1];
  for (const cy of al) for (const cx of al) {
    if ((cx === 6 && cy === 6) || (cx === 6 && cy === size - 7) || (cx === size - 7 && cy === 6)) continue;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }
  const drawFormat = (mask: number) => {
    const d = (0 << 3) | mask; let r = d; for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
    const bitsF = ((d << 10) | r) ^ 0x5412, b = (i: number) => ((bitsF >>> i) & 1) !== 0;
    for (let i = 0; i <= 5; i++) set(8, i, b(i)); set(8, 7, b(6)); set(8, 8, b(7)); set(7, 8, b(8)); for (let i = 9; i < 15; i++) set(14 - i, 8, b(i));
    for (let i = 0; i < 8; i++) set(size - 1 - i, 8, b(i)); for (let i = 8; i < 15; i++) set(8, size - 15 + i, b(i)); set(8, size - 8, true);
  };
  drawFormat(0);
  if (ver >= 7) {
    let r = ver; for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1f25);
    const bitsV = (ver << 12) | r;
    for (let i = 0; i < 18; i++) { const bit = ((bitsV >>> i) & 1) !== 0, a = size - 11 + (i % 3), b = Math.floor(i / 3); set(a, b, bit); set(b, a, bit); }
  }

  // place codewords (zig-zag), then choose the best mask
  const placed = m.map((r) => r.slice());
  let idx = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) {
      const x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - vert : vert;
      if (!fn[y][x] && idx < out.length * 8) { placed[y][x] = ((out[idx >>> 3] >>> (7 - (idx & 7))) & 1) !== 0; idx++; }
    }
  }
  const MASKS = [(x: number, y: number) => (x + y) % 2 === 0, (_x: number, y: number) => y % 2 === 0, (x: number) => x % 3 === 0, (x: number, y: number) => (x + y) % 3 === 0,
    (x: number, y: number) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x: number, y: number) => ((x * y) % 2) + ((x * y) % 3) === 0,
    (x: number, y: number) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0, (x: number, y: number) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0];
  const build = (k: number) => { const g = placed.map((r) => r.slice()); for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y][x] && MASKS[k](x, y)) g[y][x] = !g[y][x]; return g; };
  const penalty = (g: boolean[][]) => {
    let p = 0;
    const runs = (get: (i: number, j: number) => boolean) => { for (let i = 0; i < size; i++) { let run = 1; for (let j = 1; j < size; j++) { if (get(i, j) === get(i, j - 1)) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1; } } };
    runs((y, x) => g[y][x]); runs((x, y) => g[y][x]);
    for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) if (g[y][x] === g[y][x + 1] && g[y][x] === g[y + 1][x] && g[y][x] === g[y + 1][x + 1]) p += 3;
    const pat = [true, false, true, true, true, false, true, false, false, false, false];
    const finderLike = (get: (i: number) => boolean) => { for (let i = 0; i + 11 <= size; i++) { let a = true, b = true; for (let k = 0; k < 11; k++) { if (get(i + k) !== pat[k]) a = false; if (get(i + k) !== pat[10 - k]) b = false; } if (a) p += 40; if (b) p += 40; } };
    for (let i = 0; i < size; i++) { finderLike((j) => g[i][j]); finderLike((j) => g[j][i]); }
    let dark = 0; for (const r of g) for (const c of r) if (c) dark++;
    p += Math.floor(Math.abs((dark * 100) / (size * size) - 50) / 5) * 10;
    return p;
  };
  let best = 0, bestP = Infinity;
  for (let k = 0; k < 8; k++) { const p = penalty(build(k)); if (p < bestP) { bestP = p; best = k; } }
  const g = build(best);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) m[y][x] = fn[y][x] ? m[y][x] : g[y][x];
  drawFormat(best);
  return m;
}

/** SVG path data for the matrix (1 unit per module) with a 4-module quiet zone; viewBox is `0 0 n n`. */
export function qrPath(text: string): { d: string; n: number } {
  const m = qrMatrix(text), n = m.length + 8; let d = '';
  m.forEach((row, y) => { let x = 0; while (x < row.length) { if (!row[x]) { x++; continue; } let e = x; while (e < row.length && row[e]) e++; d += `M${x + 4} ${y + 4}h${e - x}v1h${-(e - x)}z`; x = e; } });
  return { d, n };
}
