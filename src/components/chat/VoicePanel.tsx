// src/components/chat/VoicePanel.tsx
//
// The voice strip above the message box: shows what the microphone is doing, the words heard so far, and the voice settings
// (language, auto-send, read replies aloud, hands-free, speed, voice). Opens while listening or from the settings button.
'use client';

import { VOICE_LANGS } from '@/lib/voice/prefs';
import type { useVoiceChat } from './useVoiceChat';

type VC = ReturnType<typeof useVoiceChat>;

function Switch({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex min-h-10 w-full cursor-pointer items-center justify-between gap-3 rounded-lg px-2 text-left hover:bg-white/5"
    >
      <span className="min-w-0">
        <span className="block text-xs text-zinc-200">{label}</span>
        {hint && <span className="block text-[10px] leading-snug text-zinc-500">{hint}</span>}
      </span>
      <span className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? 'bg-accent' : 'bg-zinc-700'}`} aria-hidden="true">
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${checked ? 'left-[18px]' : 'left-0.5'}`} />
      </span>
    </button>
  );
}

export default function VoicePanel({ vc }: { vc: VC }) {
  const { voice, prefs, setPref, speech } = vc;
  const open = voice.listening || vc.panelOpen;
  if (!open || !voice.supported) return null;

  const status = voice.state === 'starting' ? 'Starting the microphone…' : voice.hearing ? 'Hearing you…' : voice.listening ? 'Listening. Go ahead.' : 'Microphone is off';
  const enVoices = speech.voices.filter((v) => v.lang.toLowerCase().startsWith('en'));
  const shown = enVoices.length ? enVoices : speech.voices;

  return (
    <div className="max-h-[46dvh] overflow-y-auto overscroll-contain border-t border-white/5 bg-zinc-900/95 px-3 pb-2 pt-3" role="region" aria-label="Voice">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={vc.toggleMic}
          aria-label={voice.listening ? 'Stop listening' : 'Start listening'}
          className={`relative flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full border transition-colors ${
            voice.listening ? 'border-red-400/60 bg-red-500/15 text-red-200' : 'border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-accent hover:text-accent'
          }`}
        >
          {voice.hearing && <span className="absolute inset-0 animate-ping rounded-full bg-red-400/25" aria-hidden="true" />}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="9" y="3" width="6" height="11" rx="3" />
            <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
          </svg>
        </button>
        <div className="min-w-0 flex-1" role="status" aria-live="polite">
          <p className="font-mono text-[11px] text-zinc-300">{status}</p>
          <p className="truncate text-xs text-zinc-500">{voice.interim || (voice.listening ? 'Say “send it” to send, “cancel” to clear.' : 'Tap the mic to talk.')}</p>
        </div>
        {speech.speaking && (
          <button type="button" onClick={speech.stop} className="min-h-9 shrink-0 cursor-pointer rounded-lg border border-zinc-700 px-2.5 font-mono text-[11px] text-zinc-300 hover:border-accent">
            ■ Stop reading
          </button>
        )}
        <button type="button" onClick={() => vc.setPanelOpen(false)} aria-label="Hide voice settings" className="flex min-h-9 min-w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-200">
          ✕
        </button>
      </div>

      <details className="mt-1" open={vc.panelOpen}>
        <summary className="flex min-h-9 cursor-pointer list-none items-center justify-between rounded-lg px-2 font-mono text-[11px] text-zinc-400 hover:bg-white/5">
          <span>Voice settings</span>
          <span aria-hidden="true">▾</span>
        </summary>
        <div className="mt-1 space-y-1">
          <label className="flex min-h-10 items-center justify-between gap-3 px-2 text-xs text-zinc-200">
            <span>I speak</span>
            <select
              value={prefs.lang}
              onChange={(e) => setPref('lang', e.target.value)}
              className="min-w-0 max-w-[60%] rounded border border-zinc-700 bg-zinc-950 px-1.5 py-1.5 text-zinc-300 focus:outline-none"
            >
              {VOICE_LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
          </label>
          <Switch checked={prefs.autoSend} onChange={(v) => setPref('autoSend', v)} label="Send when I stop talking" hint="Off: the words wait in the box until you press send or say “send it”." />
          <Switch checked={prefs.speakReplies} onChange={(v) => setPref('speakReplies', v)} label="Read replies aloud" hint={speech.supported ? 'Every new answer is spoken. The speaker button on a reply reads just that one.' : 'This browser can’t read aloud.'} />
          <Switch checked={prefs.handsFree} onChange={(v) => setPref('handsFree', v)} label="Hands-free conversation" hint="After a reply is read, I listen again by myself. Say “stop listening” to end it." />
          {speech.supported && (
            <>
              <label className="flex min-h-10 items-center justify-between gap-3 px-2 text-xs text-zinc-200">
                <span>Reading speed</span>
                <input type="range" min={0.7} max={1.4} step={0.1} value={prefs.rate} onChange={(e) => setPref('rate', parseFloat(e.target.value))} className="w-32 accent-[var(--accent,#22d3ee)]" aria-label="Reading speed" />
              </label>
              {shown.length > 1 && (
                <label className="flex min-h-10 items-center justify-between gap-3 px-2 text-xs text-zinc-200">
                  <span>Voice</span>
                  <select value={prefs.voice} onChange={(e) => setPref('voice', e.target.value)} className="min-w-0 max-w-[60%] rounded border border-zinc-700 bg-zinc-950 px-1.5 py-1.5 text-zinc-300 focus:outline-none">
                    <option value="">Best match</option>
                    {shown.slice(0, 40).map((v) => <option key={v.voiceURI} value={v.voiceURI}>{v.name}</option>)}
                  </select>
                </label>
              )}
              <div className="px-2 pt-1">
                <button type="button" onClick={() => vc.ui.speak('voice-test', 'Hi! This is how I sound. Tell me what you need fixed, designed or built.')} className="min-h-9 cursor-pointer rounded-lg border border-zinc-700 px-3 font-mono text-[11px] text-zinc-300 hover:border-accent hover:text-accent">
                  ▶ Test voice
                </button>
              </div>
            </>
          )}
          <p className="px-2 pt-1 text-[10px] leading-snug text-zinc-600">
            The microphone listens in the language above; I answer in English. In Chrome the audio is processed by your browser’s speech service. Settings stay on this device.
          </p>
        </div>
      </details>
    </div>
  );
}
