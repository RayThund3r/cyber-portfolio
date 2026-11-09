// src/components/chat/useVoiceInput.ts
//
// Optional dictation with the browser's built-in speech recognition (Chrome, Edge, Safari). Nothing
// extra is downloaded and the button simply doesn't appear where the browser can't do it.
// Heads-up for the privacy note: in Chrome the audio is processed by the browser vendor's service.
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type Rec = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: any) => void) | null;
  onerror: ((e: any) => void) | null;
  onend: (() => void) | null;
};

function ctor(): (new () => Rec) | null {
  if (typeof window === 'undefined') return null;
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function useVoiceInput(onText: (text: string, final: boolean) => void, onProblem: (msg: string) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recRef = useRef<Rec | null>(null);
  const cb = useRef({ onText, onProblem });
  cb.current = { onText, onProblem };

  useEffect(() => {
    setSupported(!!ctor());
    return () => {
      try {
        recRef.current?.abort();
      } catch {
        /* ignore */
      }
    };
  }, []);

  const stop = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {
      /* ignore */
    }
  }, []);

  const start = useCallback(() => {
    const C = ctor();
    if (!C || recRef.current) return;
    try {
      const rec = new C();
      rec.lang = (typeof navigator !== 'undefined' && navigator.language) || 'en-US';
      rec.continuous = false;
      rec.interimResults = true;
      rec.onresult = (e: any) => {
        let text = '';
        let final = false;
        for (let i = e.resultIndex; i < e.results.length; i++) {
          text += e.results[i][0].transcript;
          if (e.results[i].isFinal) final = true;
        }
        cb.current.onText(text.trim(), final);
      };
      rec.onerror = (e: any) => {
        const code = e?.error;
        if (code === 'not-allowed' || code === 'service-not-allowed') cb.current.onProblem('Microphone access was blocked. You can allow it in your browser settings.');
        else if (code === 'no-speech') cb.current.onProblem("I didn't hear anything. Try again?");
        else if (code !== 'aborted') cb.current.onProblem('Voice input stopped. You can keep typing.');
      };
      rec.onend = () => {
        recRef.current = null;
        setListening(false);
      };
      recRef.current = rec;
      rec.start();
      setListening(true);
    } catch {
      recRef.current = null;
      setListening(false);
      cb.current.onProblem('Voice input is not available right now.');
    }
  }, []);

  const toggle = useCallback(() => (listening ? stop() : start()), [listening, start, stop]);

  return { supported, listening, toggle, stop };
}
