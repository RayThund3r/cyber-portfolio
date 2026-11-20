// src/lib/voice/speechText.ts
//
// Turns a chat reply (markdown, icons, links, code) into something that sounds right when read aloud, and cuts it into
// pieces the browser's speech engine copes with (Chrome silently stops long utterances). Pure functions, no browser APIs.

const EMOJI = /(?:[\u{1F300}-\u{1FAFF}]|[\u{2600}-\u{27BF}]|[⭐⬆⬇⏰⏱⏳⌚✅❌❓❗❤↩↪⧉✎])️?/gu;

export function cleanForSpeech(md: string): string {
  let s = String(md || '');
  s = s.replace(/```[\s\S]*?```/g, ' (code omitted) ');
  s = s.replace(/`([^`]+)`/g, '$1');
  s = s.replace(/\[([^\]]+)\]\((?:https?:\/\/)[^)\s]+\)/g, '$1');
  s = s.replace(/https?:\/\/\S+/g, 'a link');
  s = s.replace(/^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/gm, ''); // table separators
  s = s.replace(/\|/g, ', ');
  s = s.replace(/^\s{0,3}#{1,6}\s*/gm, '');
  s = s.replace(/^\s*[-*•]\s+/gm, '');
  s = s.replace(/^\s*(\d+)[.)]\s+/gm, '$1. ');
  s = s.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/__([^_]+)__/g, '$1');
  s = s.replace(EMOJI, '');
  s = s.replace(/[→←↗↘▶►›»]/g, ' ');
  s = s.replace(/\b(UGX|KSH|USD)\s?(\d[\d,]*)/g, '$2 $1');
  s = s.replace(/\bSYS-([A-Z0-9]{6})\b/g, (_, id: string) => 'reference ' + id.split('').join(' '));
  s = s.replace(/&/g, ' and ');
  s = s.replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n').trim();
  return s;
}

/** Sentence-aware pieces of at most `max` characters. */
export function chunkForSpeech(text: string, max = 180): string[] {
  const clean = text.replace(/\s*\n\s*/g, '. ').replace(/\.\s*\./g, '.').trim();
  if (!clean) return [];
  const sentences = clean.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) || [clean];
  const out: string[] = [];
  let cur = '';
  const push = () => { if (cur.trim()) out.push(cur.trim()); cur = ''; };
  for (const sent of sentences) {
    if (sent.length > max) {
      push();
      // very long sentence: split at commas / spaces
      let rest = sent.trim();
      while (rest.length > max) {
        let cut = Math.max(rest.lastIndexOf(', ', max), rest.lastIndexOf('; ', max), rest.lastIndexOf(' ', max));
        if (cut < max * 0.4) cut = max;
        out.push(rest.slice(0, cut + 1).trim());
        rest = rest.slice(cut + 1).trim();
      }
      cur = rest;
    } else if ((cur + ' ' + sent).trim().length > max) {
      push();
      cur = sent;
    } else cur = (cur + ' ' + sent).trim();
  }
  push();
  return out.filter(Boolean);
}

/** Only the first `n` words of a reply, ending on a sentence, for "short" read-aloud mode. */
export function firstSentences(text: string, maxChars = 320): string {
  if (text.length <= maxChars) return text;
  const cut = text.slice(0, maxChars);
  const stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  return stop > 80 ? cut.slice(0, stop + 1) : cut.trimEnd() + '…';
}
