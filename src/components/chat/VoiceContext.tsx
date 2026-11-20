// src/components/chat/VoiceContext.tsx — lets any chat bubble show a "read aloud" button without passing props through every layer.
'use client';
import { createContext, useContext } from 'react';

export interface VoiceUi {
  /** Browser can read text aloud. */
  canSpeak: boolean;
  /** Id of the message being read right now. */
  speakingId: string | null;
  speak: (id: string, text: string) => void;
  stopSpeaking: () => void;
}

export const VoiceUiContext = createContext<VoiceUi>({ canSpeak: false, speakingId: null, speak: () => {}, stopSpeaking: () => {} });
export const useVoiceUi = () => useContext(VoiceUiContext);
