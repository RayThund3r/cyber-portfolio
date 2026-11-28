// src/lib/artImage.ts — browser-side preparation of artwork: shrink to web size and make a small thumbnail, so the
// gallery loads fast and each upload stays well within the server's limits. Runs on the owner's device.
export interface PreparedArt { image: string; thumb: string; w: number; h: number; note: string; color: string; tone: string }

const load = (file: Blob): Promise<HTMLImageElement> => new Promise((res, rej) => {
  const url = URL.createObjectURL(file); const img = new Image();
  img.onload = () => { URL.revokeObjectURL(url); res(img); };
  img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('That file could not be opened as a picture.')); };
  img.src = url;
});
const toDataUrl = (b: Blob): Promise<string> => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(new Error('read')); r.readAsDataURL(b); });
const blobOf = (c: HTMLCanvasElement, type: string, q: number): Promise<Blob | null> => new Promise((res) => c.toBlob(res, type, q));

async function encode(img: HTMLImageElement, side: number, maxBytes: number): Promise<{ url: string; w: number; h: number }> {
  let s = side;
  for (let round = 0; round < 6; round++) {
    const k = Math.min(1, s / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * k)), h = Math.max(1, Math.round(img.naturalHeight * k));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d'); if (!ctx) throw new Error('This browser cannot prepare pictures.');
    ctx.imageSmoothingQuality = 'high'; ctx.drawImage(img, 0, 0, w, h);
    for (const q of [0.86, 0.78, 0.7, 0.6]) {
      let b = await blobOf(c, 'image/webp', q);
      if (!b || b.type !== 'image/webp') b = await blobOf(c, 'image/jpeg', q); // Safari before 17 cannot write WebP
      if (b && b.size <= maxBytes) return { url: await toDataUrl(b), w, h };
    }
    s = Math.round(s * 0.8); // still too big: make it a little smaller and try again
  }
  throw new Error('This picture is too detailed to shrink enough. Try a smaller export.');
}

/** A photo for a request form: shrunk in the browser to about 130 KB so a phone upload is quick. */
export async function shrinkPhoto(file: File): Promise<{ url: string; w: number; h: number }> {
  if (!/^image\/(png|jpe?g|webp|gif|avif|heic|heif)$/i.test(file.type || '') && !/\.(png|jpe?g|webp|gif|avif|heic)$/i.test(file.name)) throw new Error('Choose a picture (PNG, JPG or WebP).');
  if (file.size > 40 * 1024 * 1024) throw new Error('That photo is over 40 MB.');
  const img = await load(file);
  return encode(img, 1280, 135_000); // bytes; as a data URL that stays under the 190,000-character limit on the server
}

export async function prepareArt(file: File): Promise<PreparedArt> {
  if (!/^image\/(png|jpe?g|webp|gif|avif|heic|heif)$/i.test(file.type || '') && !/\.(png|jpe?g|webp|gif|avif|heic)$/i.test(file.name)) throw new Error('Choose a picture (PNG, JPG or WebP).');
  if (file.size > 40 * 1024 * 1024) throw new Error('That file is over 40 MB. Export a smaller copy.');
  const img = await load(file);
  const main = await encode(img, 1600, 380_000);
  const small = await encode(img, 560, 90_000);
  const kb = Math.round(main.url.length * 0.75 / 1024);
  const { color, tone } = pickColors(img);
  return { image: main.url, thumb: small.url, w: main.w, h: main.h, color, tone, note: `${main.w}×${main.h}px, ${kb} KB` };
}

const hx = (r: number, g: number, b: number) => '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');

/** Reads a tiny copy of the picture: a vivid colour (for glows) and the average tone (for placeholders). */
export function pickColors(img: HTMLImageElement): { color: string; tone: string } {
  try {
    const c = document.createElement('canvas'); c.width = c.height = 24;
    const ctx = c.getContext('2d', { willReadFrequently: true }); if (!ctx) throw new Error('x');
    ctx.drawImage(img, 0, 0, 24, 24);
    const d = ctx.getImageData(0, 0, 24, 24).data;
    let R = 0, G = 0, B = 0, n = 0;
    const bins = Array.from({ length: 12 }, () => ({ w: 0, r: 0, g: 0, b: 0 }));
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 128) continue;
      const r = d[i], g = d[i + 1], b = d[i + 2];
      R += r; G += g; B += b; n++;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 510, s = mx === mn ? 0 : (mx - mn) / (255 - Math.abs(mx + mn - 255));
      if (l < 0.18 || l > 0.9 || s < 0.25) continue;
      let h = 0; const dd = mx - mn;
      if (mx === r) h = ((g - b) / dd) % 6; else if (mx === g) h = (b - r) / dd + 2; else h = (r - g) / dd + 4;
      const bin = bins[Math.floor((((h * 60) + 360) % 360) / 30)];
      const wgt = s * (1 - Math.abs(l - 0.55));
      bin.w += wgt; bin.r += r * wgt; bin.g += g * wgt; bin.b += b * wgt;
    }
    if (!n) throw new Error('x');
    const best = bins.reduce((a, b) => (b.w > a.w ? b : a));
    const tone = hx(R / n * 0.55, G / n * 0.55, B / n * 0.55); // darkened: a placeholder that sits well on the dark page
    const color = best.w > 0 ? hx(best.r / best.w, best.g / best.w, best.b / best.w) : hx(R / n, G / n, B / n);
    return { color, tone };
  } catch { return { color: '#22d3ee', tone: '#18181b' }; }
}
