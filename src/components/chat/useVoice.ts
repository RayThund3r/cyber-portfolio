// src/components/chat/useVoice.ts
//
// Speech-to-text with the browser's built-in recogniser (Chrome, Edge, Safari). Nothing is downloaded; where the browser can't do it
// the mic button simply doesn't appear. In Chrome the audio is processed by the browser vendor's service (the privacy page says so).
//
// What it adds over a plain recogniser:
//   * keeps listening across the short pauses people make, and quietly restarts if the browser ends the session early
//   * live "interim" text, and a `hearing` flag that pulses while speech is detected
//   * optional auto-send once the visitor has been quiet for a moment
//   * stops itself after repeated silence (a hands-free loop never listens forever)
//   * friendly, specific messages for blocked microphones, no microphone, offline, and so on
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { foldResults, type Piece } from '@/lib/voice/recognition';

type Rec = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onresult: ((e: any) => void) | null;
  onerror: ((e: any) => void) | null;
  onend: (() => void) | null;
  onspeechstart: (() => void) | null;
  onspeechend: (() => void) | null;
};

const ctor = (): (new () => Rec) | null => {
  if (typeof window === 'undefined') return null;
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
};

export type VoiceState = 'idle' | 'starting' | 'listening';

export interface VoiceHandlers {
  /** Every update: the text so far in this recording (final + interim) and whether the last piece is final. */
  onText: (text: string, final: boolean) => void;
  /** The visitor went quiet for `silenceMs` after speaking (only fires when `autoSend` is on). */
  onSilence: (text: string) => void;
  onProblem: (msg: string) => void;
}

export interface VoiceOptions {
  lang: string;
  autoSend: boolean;
  silenceMs?: number;
}

export function useVoice(handlers: VoiceHandlers, opts: VoiceOptions) {
  const [supported, setSupported] = useState(false);
  const [state, setState] = useState<VoiceState>('idle');
  const [hearing, setHearing] = useState(false);
  const [interim, setInterim] = useState('');
  const recRef = useRef<Rec | null>(null);
  const wanted = useRef(false); // the visitor wants the mic on (restart if the browser ends early)
  const finalText = useRef('');
  const lastHeard = useRef(0);
  const silenceTimer = useRef(0);
  const quietRuns = useRef(0); // sessions in a row that heard nothing
  const heardThisSession = useRef(false);
  const resultsLen = useRef(0); // how many results the recogniser holds right now
  const consumed = useRef(0); // results already handed over (sent), so a continuous session never repeats them
  const h = useRef(handlers);
  h.current = handlers;
  const o = useRef(opts);
  o.current = opts;

  useEffect(() => {
    setSupported(!!ctor());
    return () => {
      wanted.current = false;
      window.clearTimeout(silenceTimer.current);
      try { recRef.current?.abort(); } catch { /* ignore */ }
    };
  }, []);

  const clearTimers = () => window.clearTimeout(silenceTimer.current);

  const armSilence = () => {
    clearTimers();
    if (!o.current.autoSend) return;
    silenceTimer.current = window.setTimeout(() => {
      const text = finalText.current.trim();
      if (!text || !wanted.current) return;
      finalText.current = '';
      consumed.current = resultsLen.current;
      setInterim('');
      h.current.onSilence(text);
    }, o.current.silenceMs ?? 1600);
  };

  const finish = useCallback(() => {
    wanted.current = false;
    clearTimers();
    setHearing(false);
    setInterim('');
    try { recRef.current?.stop(); } catch { /* ignore */ }
  }, []);

  const begin = useCallback(() => {
    const C = ctor();
    if (!C) return;
    try {
      const rec = new C();
      rec.lang = o.current.lang || (typeof navigator !== 'undefined' && navigator.language) || 'en-US';
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 1;
      heardThisSession.current = false;
      resultsLen.current = 0;
      consumed.current = 0;

      rec.onstart = () => setState('listening');
      rec.onspeechstart = () => { setHearing(true); heardThisSession.current = true; quietRuns.current = 0; window.clearTimeout(silenceTimer.current); };
      rec.onspeechend = () => setHearing(false);
      rec.onresult = (e: any) => {
        resultsLen.current = e.results.length;
        const pieces: Piece[] = [];
        for (let i = consumed.current; i < e.results.length; i++) pieces.push({ t: e.results[i][0]?.transcript || '', final: !!e.results[i].isFinal });
        const { fin, tmp } = foldResults(pieces);
        heardThisSession.current = true;
        quietRuns.current = 0;
        lastHeard.current = Date.now();
        finalText.current = fin;
        setInterim(tmp.trim());
        const full = (fin + ' ' + tmp).replace(/\s+/g, ' ').trim();
        h.current.onText(full, !tmp);
        if (!tmp) armSilence(); else window.clearTimeout(silenceTimer.current);
      };
      rec.onerror = (e: any) => {
        const code = e?.error as string;
        if (code === 'no-speech') return; // handled in onend (counted as a quiet run)
        if (code === 'aborted') return;
        wanted.current = false;
        if (code === 'not-allowed' || code === 'service-not-allowed') h.current.onProblem('Microphone access is blocked. Allow it in your browser’s site settings, then try again.');
        else if (code === 'audio-capture') h.current.onProblem('I can’t find a microphone on this device.');
        else if (code === 'network') h.current.onProblem('Voice needs an internet connection right now. You can keep typing.');
        else if (code === 'language-not-supported') h.current.onProblem('This browser can’t listen in that language. Try another one in the voice settings.');
        else h.current.onProblem('Voice input stopped. You can keep typing.');
      };
      rec.onend = () => {
        recRef.current = null;
        setHearing(false);
        if (!heardThisSession.current) quietRuns.current++;
        // Browsers end a session after a long pause or ~1 minute. Keep going unless the visitor stopped it or it has been silent twice.
        if (wanted.current && quietRuns.current < 2) {
          window.setTimeout(() => { if (wanted.current && !recRef.current) begin(); }, 200);
          return;
        }
        const pending = finalText.current.trim();
        const wasWanted = wanted.current;
        wanted.current = false;
        clearTimers();
        setState('idle');
        setInterim('');
        if (wasWanted && quietRuns.current >= 2) h.current.onProblem('I didn’t hear anything, so I stopped listening. Tap the mic to try again.');
        // If we ended with text that never got sent (auto-send off or the browser cut in), hand it over as final.
        if (pending && o.current.autoSend && wasWanted) { finalText.current = ''; h.current.onSilence(pending); }
      };
      recRef.current = rec;
      rec.start();
    } catch {
      recRef.current = null;
      wanted.current = false;
      setState('idle');
      h.current.onProblem('Voice input is not available right now.');
    }
  }, []);

  const start = useCallback(() => {
    if (!ctor() || wanted.current) return;
    wanted.current = true;
    quietRuns.current = 0;
    finalText.current = '';
    setInterim('');
    setState('starting');
    begin();
  }, [begin]);

  const stop = useCallback(() => {
    finish();
    setState('idle');
  }, [finish]);

  /** Forget what has been heard so far in this session (after a send or a clear) without stopping the microphone. */
  const reset = useCallback(() => {
    window.clearTimeout(silenceTimer.current);
    finalText.current = '';
    consumed.current = resultsLen.current;
    setInterim('');
  }, []);

  const toggle = useCallback(() => (wanted.current ? stop() : start()), [start, stop]);

  /** Restart with a new language without losing the "listening" state. */
  useEffect(() => {
    if (!wanted.current) return;
    try { recRef.current?.abort(); } catch { /* ignore */ }
  }, [opts.lang]);

  return { supported, state, listening: state !== 'idle', hearing, interim, start, stop, toggle, reset };
}
