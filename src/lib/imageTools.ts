// src/lib/imageTools.ts
//
// Browser-side image helpers for shared photos. Nothing leaves the device.
//   * planShrink / shrinkImage : phone photos are 3-8 MB; the chat accepts 2 MB per file, so large pictures are re-encoded
//                                (max 1600 px, WebP/JPEG) instead of being refused.
//   * analyzePixels / sampleImage: a quick look at the picture: main colours, brightness, sharpness, transparency.

/* ------------------------------------------------------------------ shrinking */

export const SHRINK = { maxSide: 1600, triggerBytes: 700 * 1024, targetBytes: 900 * 1024, maxInputBytes: 25 * 1024 * 1024 } as const;

/** Output size for a picture of w x h so its longer side is at most `maxSide` (never enlarges). */
export function planShrink(w: number, h: number, maxSide: number = SHRINK.maxSide): { w: number; h: number; scaled: boolean } {
  const long = Math.max(w, h);
  if (long <= maxSide || long <= 0) return { w, h, scaled: false };
  const k = maxSide / long;
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)), scaled: true };
}

const loadImage = (file: Blob): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode')); };
    img.src = url;
  });

const toBlob = (c: HTMLCanvasElement, type: string, q: number): Promise<Blob | null> => new Promise((res) => c.toBlob((b) => res(b), type, q));

export interface Shrunk { file: File; note?: string }

/** Returns the same file when it is already small, animated (GIF) or can't be decoded; otherwise a smaller re-encoded copy. */
export async function shrinkImage(file: File): Promise<Shrunk> {
  try {
    if (typeof document === 'undefined' || !/^image\/(png|jpe?g|webp)$/i.test(file.type || '') ) return { file };
    if (file.size > SHRINK.maxInputBytes) return { file };
    const img = await loadImage(file);
    const w0 = img.naturalWidth, h0 = img.naturalHeight;
    const plan = planShrink(w0, h0);
    if (!plan.scaled && file.size <= SHRINK.triggerBytes) return { file };

    let best: Blob | null = null;
    let side: number = SHRINK.maxSide;
    for (const q of [0.82, 0.72, 0.6]) {
      const p = planShrink(w0, h0, side);
      const c = document.createElement('canvas');
      c.width = p.w; c.height = p.h;
      const ctx = c.getContext('2d');
      if (!ctx) return { file };
      ctx.drawImage(img, 0, 0, p.w, p.h);
      const b = (await toBlob(c, 'image/webp', q)) || (await toBlob(c, 'image/jpeg', q));
      if (!b) return { file };
      best = b;
      if (b.size <= SHRINK.targetBytes) break;
      side = Math.round(side * 0.8); // still big: smaller and a bit lower quality
    }
    if (!best || best.size >= file.size) return { file };
    const ext = best.type === 'image/webp' ? 'webp' : 'jpg';
    const stem = file.name.replace(/\.[a-z0-9]{1,5}$/i, '') || 'photo';
    const out = new File([best], `${stem}.${ext}`, { type: best.type, lastModified: Date.now() });
    return { file: out, note: `Optimised ${fmtBytes(file.size)} → ${fmtBytes(out.size)}` };
  } catch {
    return { file };
  }
}

function fmtBytes(n: number): string {
  return n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/* ------------------------------------------------------------------ looking at pixels */

export interface PixelStats {
  /** Main colours as #rrggbb, most common first. */
  palette: string[];
  /** 0 (black) – 1 (white). */
  brightness: number;
  /** Standard deviation of brightness, 0 – 1. Low = flat/washed-out. */
  contrast: number;
  /** Variance of the Laplacian; low means soft or blurry. */
  sharpness: number;
  /** Share of see-through pixels, 0 – 1. */
  transparent: number;
}

const hex = (n: number) => n.toString(16).padStart(2, '0');

/** `data` = RGBA bytes of a (small) w x h picture. */
export function analyzePixels(data: ArrayLike<number>, w: number, h: number): PixelStats {
  const n = w * h;
  const gray = new Float32Array(n);
  const buckets = new Map<number, { c: number; r: number; g: number; b: number }>();
  let sum = 0, sum2 = 0, clear = 0, counted = 0;
  for (let i = 0; i < n; i++) {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2], a = data[i * 4 + 3];
    if (a < 200) { clear++; gray[i] = 255; continue; }
    const y = 0.299 * r + 0.587 * g + 0.114 * b;
    gray[i] = y; sum += y; sum2 += y * y; counted++;
    const key = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5); // 8 levels per channel
    const e = buckets.get(key) || { c: 0, r: 0, g: 0, b: 0 };
    e.c++; e.r += r; e.g += g; e.b += b;
    buckets.set(key, e);
  }
  const mean = counted ? sum / counted : 255;
  const variance = counted ? Math.max(0, sum2 / counted - mean * mean) : 0;

  // Laplacian variance on the grey image.
  let lSum = 0, lSum2 = 0, lN = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const l = gray[i - 1] + gray[i + 1] + gray[i - w] + gray[i + w] - 4 * gray[i];
      lSum += l; lSum2 += l * l; lN++;
    }
  }
  const lMean = lN ? lSum / lN : 0;
  const sharpness = lN ? Math.max(0, lSum2 / lN - lMean * lMean) : 0;

  const ranked = [...buckets.values()].sort((a, b) => b.c - a.c);
  const palette: string[] = [];
  const far = (c1: number[], c2: number[]) => Math.abs(c1[0] - c2[0]) + Math.abs(c1[1] - c2[1]) + Math.abs(c1[2] - c2[2]) > 90;
  const picked: number[][] = [];
  for (const e of ranked) {
    const rgb = [Math.round(e.r / e.c), Math.round(e.g / e.c), Math.round(e.b / e.c)];
    if (picked.every((p) => far(p, rgb))) { picked.push(rgb); palette.push('#' + hex(rgb[0]) + hex(rgb[1]) + hex(rgb[2])); }
    if (palette.length >= 5) break;
  }
  return { palette, brightness: mean / 255, contrast: Math.sqrt(variance) / 255, sharpness, transparent: n ? clear / n : 0 };
}

/** Plain-English notes from the numbers (shared by the chat reply and tests). */
export function describePixels(s: PixelStats): string[] {
  const notes: string[] = [];
  if (s.brightness < 0.22) notes.push('very dark');
  else if (s.brightness > 0.82) notes.push('very bright');
  if (s.contrast < 0.08 && s.transparent < 0.5) notes.push('low contrast (flat or washed out)');
  if (s.sharpness < 25 && s.transparent < 0.5) notes.push('a bit soft or blurry');
  if (s.transparent > 0.15) notes.push('has a transparent background');
  return notes;
}

/** Looks at an image file at thumbnail size. Returns null when the browser can't (never throws). */
export async function sampleImage(file: Blob): Promise<PixelStats | null> {
  try {
    if (typeof document === 'undefined') return null;
    const img = await loadImage(file);
    const p = planShrink(img.naturalWidth, img.naturalHeight, 160);
    const c = document.createElement('canvas');
    c.width = p.w; c.height = p.h;
    const ctx = c.getContext('2d', { willReadFrequently: true } as CanvasRenderingContext2DSettings);
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, p.w, p.h);
    return analyzePixels(ctx.getImageData(0, 0, p.w, p.h).data, p.w, p.h);
  } catch {
    return null;
  }
}
