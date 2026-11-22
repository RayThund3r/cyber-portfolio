// src/lib/ocr.ts — read the text in a picture, in the visitor's browser, only when they ask.
//   1. The browser's own text detector when it has one (Chrome on Android/ChromeOS): free, instant, no download.
//   2. Otherwise Tesseract (open source), downloaded from a public CDN the first time (a few MB), only after the visitor taps.
// Nothing is uploaded to this site. Results are best effort: handwriting and low-quality photos read poorly.

const TESS_SRC = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';

export type OcrMode = 'native' | 'download' | 'none';

export function ocrMode(): OcrMode {
  if (typeof window === 'undefined') return 'none';
  if ('TextDetector' in window) return 'native';
  return typeof document !== 'undefined' ? 'download' : 'none';
}

/** Tidy OCR output: collapse noise and cap length. Pure. */
export function cleanOcr(raw: string): string {
  return raw
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.replace(/[^\S\n]+/g, ' ').trim())
    .filter((l) => l.length > 1 && /[\p{L}\p{N}]/u.test(l))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .slice(0, 20_000);
}

/** Order native detector boxes top-to-bottom, then left-to-right, grouping boxes on the same line. Pure. */
export function orderBoxes(boxes: { rawValue: string; boundingBox: { x: number; y: number; height: number } }[]): string {
  const sorted = [...boxes].sort((a, b) => a.boundingBox.y - b.boundingBox.y);
  const lines: { y: number; h: number; parts: { x: number; t: string }[] }[] = [];
  for (const b of sorted) {
    const line = lines.find((l) => Math.abs(l.y - b.boundingBox.y) < Math.max(l.h, b.boundingBox.height) * 0.6);
    if (line) line.parts.push({ x: b.boundingBox.x, t: b.rawValue });
    else lines.push({ y: b.boundingBox.y, h: b.boundingBox.height, parts: [{ x: b.boundingBox.x, t: b.rawValue }] });
  }
  return lines.map((l) => l.parts.sort((a, b) => a.x - b.x).map((p) => p.t).join(' ')).join('\n');
}

let tessLoading: Promise<any> | null = null;
function loadTesseract(): Promise<any> {
  const w = window as any;
  if (w.Tesseract) return Promise.resolve(w.Tesseract);
  if (!tessLoading) {
    tessLoading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = TESS_SRC;
      s.async = true;
      s.crossOrigin = 'anonymous';
      s.onload = () => (w.Tesseract ? resolve(w.Tesseract) : reject(new Error('The reader did not start.')));
      s.onerror = () => { tessLoading = null; reject(new Error('Could not download the reading tool. Check your connection.')); };
      document.head.appendChild(s);
    });
  }
  return tessLoading;
}

export async function readImageText(file: File, onStatus?: (s: string) => void): Promise<string> {
  const w = window as any;
  if ('TextDetector' in w) {
    try {
      onStatus?.('Reading the picture…');
      const bmp = await createImageBitmap(file);
      try {
        const boxes = await new w.TextDetector().detect(bmp);
        const txt = cleanOcr(orderBoxes(boxes));
        if (txt) return txt;
      } finally { bmp.close?.(); }
    } catch { /* fall through to the downloadable reader */ }
  }
  onStatus?.('Downloading the reading tool (one time)…');
  const T = await loadTesseract();
  onStatus?.('Reading the picture…');
  const r = await T.recognize(file, 'eng');
  return cleanOcr(String(r?.data?.text || ''));
}
