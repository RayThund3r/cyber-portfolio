// src/components/chat/VoiceMode.tsx
//
// Voice conversation, full screen inside the chat: one big orb that shows what is happening (listening, hearing you, thinking,
// speaking), live captions, tap the orb to interrupt or pause, and a small sheet for language / speed / voice.
// It talks like a normal voice assistant: you speak, it answers aloud, then it listens again by itself until you end it.
'use client';

import { useEffect, useState } from 'react';
import { VOICE_LANGS } from '@/lib/voice/prefs';
import type { Message } from '@/utils/chatEngine/types';
import { plainText } from './chatUtils';
import type { useVoiceChat } from './useVoiceChat';

type VC = ReturnType<typeof useVoiceChat>;
type Phase = 'starting' | 'listening' | 'hearing' | 'thinking' | 'speaking' | 'paused';

const LABEL: Record<Phase, string> = {
  starting: 'Starting microphone…',
  listening: 'Listening',
  hearing: 'Listening',
  thinking: 'Thinking',
  speaking: 'Speaking · tap to interrupt',
  paused: 'Paused · tap to talk',
};

export default function VoiceMode({ vc, messages, isThinking, onClose }: { vc: VC; messages: Message[]; isThinking: boolean; onClose: () => void }) {
  const { voice, speech, prefs, setPref } = vc;
  const [sheet, setSheet] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      if (sheet) setSheet(false);
      else onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [sheet, onClose]);

  const phase: Phase = speech.speaking
    ? 'speaking'
    : isThinking
      ? 'thinking'
      : voice.state === 'starting'
        ? 'starting'
        : voice.hearing
          ? 'hearing'
          : voice.listening
            ? 'listening'
            : 'paused';

  const lastUser = [...messages].reverse().find((m) => m.sender === 'user');
  const lastBot = [...messages].reverse().find((m) => m.sender === 'bot' && m.id !== 'welcome' && !m.streaming);
  const heard = voice.interim.trim();
  const showReply = (phase === 'speaking' || phase === 'paused' || phase === 'thinking') && lastBot && lastUser;
  const reply = showReply ? plainText(lastBot.text) : '';

  const enVoices = speech.voices.filter((v) => v.lang.toLowerCase().startsWith('en'));
  const shown = enVoices.length ? enVoices : speech.voices;

  const orb =
    phase === 'speaking'
      ? 'bg-accent/30 scale-110'
      : phase === 'hearing'
        ? 'bg-accent/40 scale-105'
        : phase === 'thinking'
          ? 'bg-zinc-600/30 animate-pulse'
          : phase === 'listening'
            ? 'bg-accent/20'
            : 'bg-zinc-700/30';

  return (
    <div role="dialog" aria-label="Voice conversation" className="animate-msg-in absolute inset-0 z-40 flex flex-col bg-zinc-950 max-sm:pt-[env(safe-area-inset-top)] max-sm:pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-between px-3 py-2">
        <button type="button" onClick={onClose} aria-label="Back to the chat" className="flex h-10 cursor-pointer items-center gap-1.5 rounded-xl px-2.5 text-xs text-zinc-400 hover:bg-white/5 hover:text-zinc-100">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
          Chat
        </button>
        <button type="button" onClick={() => setSheet((v) => !v)} aria-expanded={sheet} aria-label="Voice settings" className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl text-zinc-400 hover:bg-white/5 hover:text-zinc-100">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><circle cx="16" cy="7" r="2" /><circle cx="8" cy="17" r="2" /></svg>
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
        <button
          type="button"
          onClick={vc.tapOrb}
          aria-label={phase === 'speaking' ? 'Interrupt and talk' : voice.listening ? 'Pause listening' : 'Start talking'}
          className="relative flex h-40 w-40 cursor-pointer items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <span className={`absolute inset-0 rounded-full transition-all duration-500 ${orb}`} aria-hidden="true" />
          <span className={`absolute inset-6 rounded-full border border-accent/40 transition-all duration-500 ${phase === 'hearing' || phase === 'speaking' ? 'bg-accent/25' : 'bg-accent/5'}`} aria-hidden="true" />
          <svg className="relative text-accent" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {phase === 'speaking' ? (
              <path d="M11 5 6 9H3v6h3l5 4V5zM15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
            ) : (
              <>
                <rect x="9" y="3" width="6" height="11" rx="3" />
                <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
              </>
            )}
          </svg>
        </button>

        <div className="max-w-sm" role="status" aria-live="polite">
          <p className="font-sans text-sm font-medium text-zinc-200">{LABEL[phase]}</p>
          <p className="mt-2 min-h-[3.5rem] font-sans text-[13px] leading-relaxed text-zinc-400">
            {phase === 'hearing' || phase === 'listening'
              ? heard || 'Go ahead, I’m listening.'
              : phase === 'thinking'
                ? lastUser
                  ? `“${lastUser.text.slice(0, 120)}”`
                  : ''
                : reply
                  ? reply.length > 280
                    ? reply.slice(0, 280).trimEnd() + '…'
                    : reply
                  : 'Tap the circle and ask me anything.'}
          </p>
        </div>
      </div>

      <div className="px-4 pb-4 pt-2 text-center">
        <p className="mb-3 font-sans text-[11px] text-zinc-600">Say “stop talking”, “say that again” or “slower” any time.</p>
        <button type="button" onClick={onClose} className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-full bg-red-500/15 px-6 text-sm font-medium text-red-200 transition-colors hover:bg-red-500/25">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          End
        </button>
      </div>

      {sheet && (
        <div className="animate-sheet-in absolute inset-x-0 bottom-0 z-10 max-h-[70%] overflow-y-auto rounded-t-2xl border-t border-white/10 bg-zinc-900 p-4 shadow-2xl">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-sans text-sm font-semibold text-zinc-100">Voice settings</p>
            <button type="button" onClick={() => setSheet(false)} aria-label="Close settings" className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-zinc-400 hover:bg-white/5">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </div>
          <label className="flex min-h-11 items-center justify-between gap-3 text-xs text-zinc-300">
            <span>I speak</span>
            <select value={prefs.lang} onChange={(e) => setPref('lang', e.target.value)} className="min-w-0 max-w-[60%] rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-2 text-zinc-200">
              {VOICE_LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
          </label>
          {speech.supported && (
            <>
              <label className="flex min-h-11 items-center justify-between gap-3 text-xs text-zinc-300">
                <span>Speaking speed</span>
                <input type="range" min={0.7} max={1.4} step={0.1} value={prefs.rate} onChange={(e) => setPref('rate', parseFloat(e.target.value))} className="w-36 accent-[var(--accent)]" />
              </label>
              {shown.length > 1 && (
                <label className="flex min-h-11 items-center justify-between gap-3 text-xs text-zinc-300">
                  <span>Voice</span>
                  <select value={prefs.voice} onChange={(e) => setPref('voice', e.target.value)} className="min-w-0 max-w-[60%] rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-2 text-zinc-200">
                    <option value="">Best match</option>
                    {shown.slice(0, 40).map((v) => <option key={v.voiceURI} value={v.voiceURI}>{v.name}</option>)}
                  </select>
                </label>
              )}
              <button type="button" onClick={() => vc.ui.speak('voice-test', 'Hi! This is how I sound. Tell me what you need fixed, designed or built.')} className="mt-1 min-h-10 cursor-pointer rounded-lg border border-zinc-700 px-3 text-xs text-zinc-200 hover:border-accent hover:text-accent">
                Play a sample
              </button>
            </>
          )}
          <p className="mt-3 text-[10px] leading-snug text-zinc-600">I listen in the language above and answer in English. In Chrome your browser’s speech service processes the audio. Settings stay on this device.</p>
        </div>
      )}
    </div>
  );
}
