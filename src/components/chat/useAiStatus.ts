// src/components/chat/useAiStatus.ts
// Status of the optional on-device / server AI, for the strip under the header.
'use client';

import { useEffect, useState } from 'react';
import { DEFAULT_MODEL_ID, LLMState, autoLoadIfPreviouslyEnabled, getLLMState, subscribeLLM } from '@/utils/chatEngine/localLLM';
import { isRemoteLLMConfigured } from '@/utils/chatEngine/remoteLLM';
import { getPrefs } from '@/utils/chatEngine/learningEngine';

export function useAiStatus() {
  const [llm, setLlm] = useState<LLMState>({ status: 'idle', progress: 0, text: '' });
  const [modelId, setModelId] = useState<string>(DEFAULT_MODEL_ID);

  useEffect(() => {
    const prefs = getPrefs();
    if (prefs.modelId) setModelId(prefs.modelId);
    setLlm(getLLMState());
    const unsub = subscribeLLM(setLlm);
    autoLoadIfPreviouslyEnabled();
    return unsub;
  }, []);

  return { llm, modelId, setModelId, remote: isRemoteLLMConfigured() };
}
