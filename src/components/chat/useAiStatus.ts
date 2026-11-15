// src/components/chat/useAiStatus.ts
// Status of the optional on-device / server AI, for the strip under the header.
'use client';

import { useEffect, useState } from 'react';
import { DEFAULT_MODEL_ID, LLMState, autoLoadIfPreviouslyEnabled, getLLMState, subscribeLLM } from '@/utils/chatEngine/localLLM';
import { checkCloud, cloudLabel, cloudUserOff, isCloudReady, isRemoteLLMConfigured, subscribeCloud } from '@/utils/chatEngine/remoteLLM';
import { getPrefs } from '@/utils/chatEngine/learningEngine';

export function useAiStatus() {
  const [llm, setLlm] = useState<LLMState>({ status: 'idle', progress: 0, text: '' });
  const [modelId, setModelId] = useState<string>(DEFAULT_MODEL_ID);
  const [cloud, setCloud] = useState({ ready: false, off: false, label: 'CLOUD' });

  useEffect(() => {
    const prefs = getPrefs();
    if (prefs.modelId) setModelId(prefs.modelId);
    setLlm(getLLMState());
    const unsub = subscribeLLM(setLlm);
    const sync = () => setCloud({ ready: isCloudReady(), off: cloudUserOff(), label: cloudLabel() });
    const unCloud = subscribeCloud(sync);
    checkCloud();
    const t = window.setInterval(() => checkCloud(), 60_000);
    autoLoadIfPreviouslyEnabled();
    return () => {
      unsub();
      unCloud();
      window.clearInterval(t);
    };
  }, []);

  return { llm, modelId, setModelId, remote: isRemoteLLMConfigured(), cloud };
}
