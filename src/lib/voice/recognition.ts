// src/lib/voice/recognition.ts — pure helpers for browser speech-recognition results. No browser APIs.
// Some phones (notably Chrome on Android) report CUMULATIVE results in continuous mode: result 2 is "hello world" after
// result 1 was "hello". Joined naively that becomes "hello hello world". foldResults() removes that repetition.

export interface Piece { t: string; final: boolean }

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N} ]+/gu, '').replace(/\s+/g, ' ').trim();

/** Drop pieces that are repeated, or are a prefix of a later piece of the same kind. Keeps order. */
export function dedupePieces(texts: string[]): string[] {
  const n = texts.map(norm);
  return texts.filter((_, i) => {
    if (!n[i]) return false;
    for (let j = i + 1; j < texts.length; j++) if (n[j] && (n[j] === n[i] || n[j].startsWith(n[i] + ' '))) return false;
    return true;
  });
}

export function foldResults(pieces: Piece[]): { fin: string; tmp: string } {
  const join = (a: string[]) => dedupePieces(a).join(' ').replace(/\s+/g, ' ').trim();
  return { fin: join(pieces.filter((p) => p.final).map((p) => p.t)), tmp: join(pieces.filter((p) => !p.final).map((p) => p.t)) };
}
