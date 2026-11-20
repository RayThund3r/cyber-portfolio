// src/components/chat/useSpeech.ts
//
// Read-aloud for chat replies with the browser's built-in speech synthesis (no download, no cost, works offline on most devices).
// Long replies are read sentence by sentence (Chrome stops long utterances), and anything new stops what is playing.
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { chunkForSpeech, cleanForSpeech } from '@/lib/voice/speechText';

export interface SpeakOpts {
  rate?: number;
  /** Voice id (voiceURI); falls back to the best match for `lang`. */
  voice?: string;
  lang?: string;
  /** Called only when the whole text was read to the end (not when stopped). */
  onEnd?: () => void;
}

const supportedNow = () => typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

export function pickVoice(voices: SpeechSynthesisVoice[], want: string, lang: string): SpeechSynthesisVoice | null {
  if (!voices.length) return null;
  if (want) {
    const exact = voices.find((v) => v.voiceURI === want);
    if (exact) return exact;
  }
  const base = lang.toLowerCase().split('-')[0];
  const same = voices.filter((v) => v.lang.toLowerCase().startsWith(base));
  const pool = same.length ? same : voices;
  return pool.find((v) => v.lang.toLowerCase() === lang.toLowerCase() && v.default) || pool.find((v) => v.lang.toLowerCase() === lang.toLowerCase()) || pool.find((v) => v.default) || pool[0];
}

export function useSpeech() {
  const [supported, setSupported] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const token = useRef(0);

  useEffect(() => {
    if (!supportedNow()) return;
    setSupported(true);
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.addEventListener?.('voiceschanged', load);
    const hide = () => { token.current++; window.speechSynthesis.cancel(); setSpeakingId(null); };
    window.addEventListener('pagehide', hide);
    return () => {
      window.speechSynthesis.removeEventListener?.('voiceschanged', load);
      window.removeEventListener('pagehide', hide);
      token.current++;
      try { window.speechSynthesis.cancel(); } catch { /* ignore */ }
    };
  }, []);

  const stop = useCallback(() => {
    token.current++;
    setSpeakingId(null);
    if (supportedNow()) try { window.speechSynthesis.cancel(); } catch { /* ignore */ }
  }, []);

  const speak = useCallback(
    (id: string, markdown: string, opts: SpeakOpts = {}) => {
      if (!supportedNow()) return false;
      const parts = chunkForSpeech(cleanForSpeech(markdown));
      if (!parts.length) { opts.onEnd?.(); return false; }
      const mine = ++token.current;
      try { window.speechSynthesis.cancel(); } catch { /* ignore */ }
      setSpeakingId(id);
      const lang = opts.lang || 'en-US';
      const voice = pickVoice(window.speechSynthesis.getVoices(), opts.voice || '', lang);
      let i = 0;
      const next = () => {
        if (token.current !== mine) return;
        if (i >= parts.length) { setSpeakingId((cur) => (cur === id ? null : cur)); opts.onEnd?.(); return; }
        const u = new SpeechSynthesisUtterance(parts[i++]);
        u.lang = voice?.lang || lang;
        if (voice) u.voice = voice;
        u.rate = Math.min(1.4, Math.max(0.7, opts.rate || 1));
        u.onend = next;
        u.onerror = (e) => {
          // "canceled"/"interrupted" are what we cause ourselves; anything else ends the reading quietly.
          if (token.current === mine) { setSpeakingId((cur) => (cur === id ? null : cur)); if (e.error !== 'canceled' && e.error !== 'interrupted') opts.onEnd?.(); }
        };
        try { window.speechSynthesis.speak(u); } catch { setSpeakingId(null); }
      };
      next();
      return true;
    },
    []
  );

  return { supported, speakingId, speaking: speakingId !== null, voices, speak, stop };
}
