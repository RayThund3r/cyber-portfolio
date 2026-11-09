// src/components/studio/compress.ts — shrinks pictures in the browser before upload (keeps phones fast on mobile data).
/** Resize + compress a picture in the browser so uploads stay small and fast on mobile data. */
export async function compress(file: File): Promise<{ mime: string; data: string; dataUrl: string }> {
  if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) throw new Error('Please choose a JPG, PNG, WebP or GIF picture.');
  const read = (b: Blob) => new Promise<{ mime: string; data: string; dataUrl: string }>((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => { const u = String(fr.result); res({ mime: b.type, data: u.split(',')[1], dataUrl: u }); };
    fr.onerror = () => rej(new Error('Could not read that picture.'));
    fr.readAsDataURL(b);
  });
  if (file.type === 'image/gif' && file.size <= 550 * 1024) return read(file);
  const bmp = await createImageBitmap(file);
  const sc = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(bmp.width * sc)); c.height = Math.max(1, Math.round(bmp.height * sc));
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  const to = (type: string, q?: number) => new Promise<Blob | null>((r) => c.toBlob(r, type, q));
  let blob = file.type === 'image/png' ? await to('image/png') : null; // keep transparency for logos when small enough
  if (!blob || blob.size > 450 * 1024) for (const q of [0.85, 0.75, 0.62, 0.5]) { blob = await to('image/jpeg', q); if (blob && blob.size <= 550 * 1024) break; }
  if (!blob || blob.size > 580 * 1024) throw new Error('That picture is too big. Please try a smaller one.');
  return read(blob);
}

