// src/utils/chatEngine/localLLM.ts
//
// A real language model that runs INSIDE the visitor's browser (WebGPU) using WebLLM.
//   - no API key, no server, no per-message cost
//   - the model downloads once, is cached by the browser, then loads quickly next time
//   - needs a WebGPU browser (Chrome / Edge desktop, recent Android Chrome)
//
// Install once in your Next.js project:   npm i @mlc-ai/web-llm
//
// The model ids below are checked against WebLLM's own model list at load time, so if a
// build renames one, we fall back to the closest available instead of crashing.

import { getPrefs, setPrefs } from './learningEngine';

export interface ChatMsg {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ModelOption {
  id: string;
  label: string;
  /** Approximate one-time download. Rough figure — verify against your WebLLM version. */
  approxDownload: string;
  note: string;
}

export const MODEL_OPTIONS: ModelOption[] = [
  { id: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC', label: 'LITE', approxDownload: '≈0.4 GB', note: 'Fastest, basic quality' },
  { id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC', label: 'BALANCED', approxDownload: '≈1 GB', note: 'Good all-rounder' },
  { id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC', label: 'SMART', approxDownload: '≈2 GB', note: 'Best quality, needs a stronger GPU' },
];

export const DEFAULT_MODEL_ID = MODEL_OPTIONS[1].id;

export type LLMStatus = 'idle' | 'unsupported' | 'loading' | 'ready' | 'error';

export interface LLMState {
  status: LLMStatus;
  /** 0..1 while loading */
  progress: number;
  text: string;
  modelId?: string;
  error?: string;
}

let engine: any = null;
let loadPromise: Promise<void> | null = null;
let generating = false;
let state: LLMState = { status: 'idle', progress: 0, text: '' };
const listeners = new Set<(s: LLMState) => void>();

function setState(patch: Partial<LLMState>): void {
  state = { ...state, ...patch };
  listeners.forEach((l) => l(state));
}

export function isWebGPUSupported(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator;
}

export function getLLMState(): LLMState {
  if (state.status === 'idle' && typeof navigator !== 'undefined' && !isWebGPUSupported()) {
    return { ...state, status: 'unsupported', text: 'This browser has no WebGPU.' };
  }
  return state;
}

export function subscribeLLM(fn: (s: LLMState) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function isLocalLLMReady(): boolean {
  return state.status === 'ready' && !!engine;
}

export function labelForModel(id?: string): string {
  return MODEL_OPTIONS.find((m) => m.id === id)?.label || 'LOCAL';
}

export async function loadLocalLLM(requestedId: string = DEFAULT_MODEL_ID): Promise<void> {
  if (isLocalLLMReady()) return;
  if (loadPromise) return loadPromise;
  if (!isWebGPUSupported()) {
    setState({ status: 'unsupported', text: 'This browser has no WebGPU. Try Chrome or Edge on desktop.' });
    return;
  }

  setState({ status: 'loading', progress: 0, text: 'Preparing...', error: undefined, modelId: requestedId });

  loadPromise = (async () => {
    try {
      const webllm: any = await import('@mlc-ai/web-llm');

      // Validate against the library's own list.
      const available: string[] = (webllm.prebuiltAppConfig?.model_list || []).map((m: any) => m.model_id);
      let modelId = requestedId;
      if (available.length > 0 && !available.includes(modelId)) {
        const fallback =
          available.find((id) => /qwen2\.5-1\.5b-instruct.*q4f16_1/i.test(id)) ||
          available.find((id) => /instruct.*q4f16_1/i.test(id) && /(0\.5|1|1\.5)b/i.test(id));
        if (!fallback) throw new Error(`Model "${requestedId}" is not available in this WebLLM version.`);
        modelId = fallback;
      }

      engine = await webllm.CreateMLCEngine(modelId, {
        initProgressCallback: (r: { progress: number; text: string }) =>
          setState({ progress: r.progress ?? 0, text: r.text ?? '' }),
      });

      setState({ status: 'ready', progress: 1, text: 'Ready', modelId });
      setPrefs({ aiEnabled: true, modelId });
    } catch (err: any) {
      engine = null;
      setState({ status: 'error', error: String(err?.message || err), text: 'Failed to load the AI model.' });
    } finally {
      loadPromise = null;
    }
  })();

  return loadPromise;
}

export async function unloadLocalLLM(): Promise<void> {
  try {
    await engine?.unload?.();
  } catch {
    /* ignore */
  }
  engine = null;
  setState({ status: 'idle', progress: 0, text: '', error: undefined });
  setPrefs({ aiEnabled: false });
}

/** Re-load automatically if the visitor enabled AI on a previous visit (loads from cache, fast). */
export function autoLoadIfPreviouslyEnabled(): void {
  const prefs = getPrefs();
  if (prefs.aiEnabled && state.status === 'idle' && isWebGPUSupported()) {
    void loadLocalLLM(prefs.modelId || DEFAULT_MODEL_ID);
  }
}

/** Stream a reply. onToken receives the full text so far. */
export async function generateLocal(
  messages: ChatMsg[],
  onToken?: (text: string) => void,
  signal?: AbortSignal
): Promise<string> {
  if (!isLocalLLMReady()) throw new Error('Local model is not loaded');
  if (generating) throw new Error('Model is busy');
  generating = true;

  const abort = () => {
    try {
      engine?.interruptGenerate?.();
    } catch {
      /* ignore */
    }
  };
  signal?.addEventListener('abort', abort);

  try {
    const stream = await engine.chat.completions.create({
      messages,
      stream: true,
      temperature: 0.6,
      top_p: 0.9,
      max_tokens: 512,
      repetition_penalty: 1.1,
    });
    let full = '';
    for await (const chunk of stream) {
      const delta: string | undefined = chunk?.choices?.[0]?.delta?.content;
      if (delta) {
        full += delta;
        onToken?.(full);
      }
    }
    return full.trim();
  } finally {
    signal?.removeEventListener('abort', abort);
    generating = false;
  }
}
