// src/lib/voice/prefs.ts — the visitor's voice settings, remembered on this device only.
import { safeLocal } from '@/lib/safeStorage';

export interface VoicePrefs {
  /** Language the microphone listens for (BCP-47). '' = the browser's language. */
  lang: string;
  /** Send automatically when the visitor stops talking. */
  autoSend: boolean;
  /** Read every new reply aloud. */
  speakReplies: boolean;
  /** Listen again by itself after a reply has been read (a spoken conversation). */
  handsFree: boolean;
  /** Reading speed, 0.7 - 1.4. */
  rate: number;
  /** Chosen voice (voiceURI); '' = best match for the reply language. */
  voice: string;
}

export const DEFAULT_VOICE_PREFS: VoicePrefs = { lang: '', autoSend: true, speakReplies: false, handsFree: false, rate: 1, voice: '' };

/** What the recogniser can listen for. The assistant itself still answers in English. */
export const VOICE_LANGS: Array<{ code: string; label: string }> = [
  { code: '', label: 'Auto (browser language)' },
  { code: 'en-US', label: 'English (US)' },
  { code: 'en-GB', label: 'English (UK)' },
  { code: 'en-KE', label: 'English (Kenya)' },
  { code: 'en-NG', label: 'English (Nigeria)' },
  { code: 'en-ZA', label: 'English (South Africa)' },
  { code: 'sw-KE', label: 'Kiswahili' },
  { code: 'fr-FR', label: 'Français' },
  { code: 'ar-SA', label: 'العربية' },
  { code: 'es-ES', label: 'Español' },
  { code: 'pt-BR', label: 'Português' },
  { code: 'hi-IN', label: 'हिन्दी' },
  { code: 'de-DE', label: 'Deutsch' },
];

const KEY = 'sys_voice_prefs';

export function sanitizePrefs(v: unknown): VoicePrefs {
  const o = (v && typeof v === 'object' ? v : {}) as Partial<VoicePrefs>;
  const d = DEFAULT_VOICE_PREFS;
  const rate = typeof o.rate === 'number' && isFinite(o.rate) ? Math.min(1.4, Math.max(0.7, o.rate)) : d.rate;
  return {
    lang: typeof o.lang === 'string' && VOICE_LANGS.some((l) => l.code === o.lang) ? o.lang : d.lang,
    autoSend: typeof o.autoSend === 'boolean' ? o.autoSend : d.autoSend,
    speakReplies: typeof o.speakReplies === 'boolean' ? o.speakReplies : d.speakReplies,
    handsFree: typeof o.handsFree === 'boolean' ? o.handsFree : d.handsFree,
    rate,
    voice: typeof o.voice === 'string' ? o.voice.slice(0, 200) : d.voice,
  };
}

export function loadPrefs(): VoicePrefs {
  try { return sanitizePrefs(JSON.parse(safeLocal.get(KEY) || '{}')); } catch { return DEFAULT_VOICE_PREFS; }
}
export function savePrefs(p: VoicePrefs): void { safeLocal.set(KEY, JSON.stringify(p)); }
