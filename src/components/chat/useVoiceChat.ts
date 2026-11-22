// src/components/chat/useVoiceChat.ts
//
// The conversation layer for voice: ties the microphone (useVoice), read-aloud (useSpeech) and the visitor's settings to the chat.
//   * dictation fills the message box; "send it" sends, "cancel" clears, "stop talking" silences the reply, "say that again" repeats it
//   * auto-send when the visitor stops talking (optional)
//   * "read replies aloud" speaks each new answer; talking over it (or sending) stops it
//   * hands-free: listen -> send -> read the answer -> listen again, until the visitor taps stop or stays quiet
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Message } from '@/utils/chatEngine/types';
import { voiceMeta } from '@/utils/chatEngine/voiceText';
import { firstSentences } from '@/lib/voice/speechText';
import { DEFAULT_VOICE_PREFS, loadPrefs, savePrefs, type VoicePrefs } from '@/lib/voice/prefs';
import { useVoice } from './useVoice';
import { useSpeech } from './useSpeech';

interface Args {
  draft: string;
  setDraft: (v: string) => void;
  send: (text: string) => void;
  max: number;
  messages: Message[];
  isThinking: boolean;
  /** Reply still typing out on screen (don't read it yet). */
  revealingId: string | null;
  toast: (m: string) => void;
  /** Chat window is open. Everything stops when it closes. */
  open: boolean;
}

export function useVoiceChat(a: Args) {
  const [prefs, setPrefs] = useState<VoicePrefs>(DEFAULT_VOICE_PREFS);
  const [panelOpen, setPanelOpen] = useState(false);
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const A = useRef(a);
  A.current = a;
  const base = useRef('');
  const loop = useRef(false); // hands-free loop is running
  const lastSpoken = useRef<string | null>(null);
  const lastReply = useRef<{ id: string; text: string } | null>(null);
  const speech = useSpeech();
  const speechRef = useRef(speech);
  speechRef.current = speech;

  useEffect(() => { setPrefs(loadPrefs()); }, []);

  const setPref = useCallback(<K extends keyof VoicePrefs>(k: K, v: VoicePrefs[K]) => {
    setPrefs((p) => { const n = { ...p, [k]: v }; savePrefs(n); return n; });
  }, []);

  const join = (text: string) => ((base.current ? base.current.trimEnd() + ' ' : '') + text).slice(0, A.current.max);

  /** Spoken controls ("send it", "cancel", "stop talking", "say that again"). Returns true when the transcript was a control. */
  const control = (text: string): boolean => {
    const vm = voiceMeta(text);
    if (!vm.meta) return false;
    if (vm.meta === 'clear') { base.current = ''; A.current.setDraft(''); voiceRef.current?.reset(); }
    else if (vm.meta === 'stop') { loop.current = false; voiceRef.current?.stop(); }
    else if (vm.meta === 'quiet') { loop.current = false; speechRef.current.stop(); }
    else if (vm.meta === 'slower' || vm.meta === 'faster') {
      const r = Math.round((prefsRef.current.rate + (vm.meta === 'faster' ? 0.15 : -0.15)) * 100) / 100;
      setPref('rate', Math.min(1.4, Math.max(0.7, r)));
    }
    else if (vm.meta === 'repeat') { const r = lastReply.current; if (r) speakNow(r.id, r.text); }
    else if (vm.meta === 'send') {
      const full = join(vm.text);
      base.current = '';
      A.current.setDraft('');
      voiceRef.current?.reset();
      speechRef.current.stop();
      if (full.trim()) A.current.send(full);
    }
    return true;
  };

  const voice = useVoice(
    {
      onText: (text, final) => {
        if (final && control(text)) return;
        if (final || text) A.current.setDraft(join(text));
      },
      onSilence: (text) => {
        if (control(text)) return;
        const full = join(text);
        base.current = '';
        A.current.setDraft('');
        speechRef.current.stop();
        if (full.trim()) A.current.send(full);
      },
      onProblem: (m) => { loop.current = false; A.current.toast(m); },
    },
    { lang: prefs.lang, autoSend: prefs.autoSend }
  );
  const voiceRef = useRef(voice);
  voiceRef.current = voice;

  const speakNow = useCallback((id: string, text: string) => {
    const p = prefsRef.current;
    voiceRef.current?.stop();
    speechRef.current.speak(id, firstSentences(text, 520), {
      rate: p.rate,
      voice: p.voice,
      lang: 'en-US',
      onEnd: () => { if (loop.current && prefsRef.current.handsFree && A.current.open) window.setTimeout(() => startListening(), 250); },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startListening = useCallback(() => {
    speechRef.current.stop();
    base.current = A.current.draft;
    voiceRef.current?.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleMic = useCallback(() => {
    if (voiceRef.current?.listening) { loop.current = false; voiceRef.current.stop(); return; }
    loop.current = prefsRef.current.handsFree;
    startListening();
  }, [startListening]);

  // Barge-in: when the visitor starts talking, stop reading.
  useEffect(() => { if (voice.hearing) speechRef.current.stop(); }, [voice.hearing]);

  // Read each new finished reply aloud.
  useEffect(() => {
    const last = a.messages[a.messages.length - 1];
    if (!last || last.sender !== 'bot' || last.id === 'welcome') return;
    if (a.isThinking || last.streaming || a.revealingId === last.id) return;
    if (lastSpoken.current === last.id) return;
    lastSpoken.current = last.id;
    lastReply.current = { id: last.id, text: last.text };
    const p = prefsRef.current;
    if (!a.open) return;
    if (p.speakReplies || (loop.current && p.handsFree)) {
      if (speechRef.current.supported) speakNow(last.id, last.text);
      else if (loop.current) window.setTimeout(() => startListening(), 300);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a.messages, a.isThinking, a.revealingId, a.open]);

  // On first mount the existing last message counts as already spoken.
  useEffect(() => {
    const last = A.current.messages[A.current.messages.length - 1];
    if (last) { lastSpoken.current = last.id; if (last.sender === 'bot') lastReply.current = { id: last.id, text: last.text }; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Closing the chat silences everything.
  useEffect(() => {
    if (a.open) return;
    loop.current = false;
    voiceRef.current?.stop();
    speechRef.current.stop();
  }, [a.open]);

  /** Typed sends and button taps also stop the reply that is playing. */
  const onUserSend = useCallback(() => { speechRef.current.stop(); base.current = ''; voiceRef.current?.stop(); loop.current = false; }, []);

  return {
    prefs,
    setPref,
    voice,
    speech,
    toggleMic,
    panelOpen,
    setPanelOpen,
    onUserSend,
    ui: {
      canSpeak: speech.supported,
      speakingId: speech.speakingId,
      speak: (id: string, text: string) => speakNow(id, text),
      stopSpeaking: speech.stop,
    },
  };
}
