// src/utils/chatEngine/remoteLLM.ts
//
// OPTIONAL: use your own self-hosted model server instead of (or alongside) the in-browser one.
// Works with any OpenAI-compatible streaming endpoint you run yourself, e.g. Ollama:
//
//   .env.local
//   NEXT_PUBLIC_LLM_ENDPOINT=http://localhost:11434/v1/chat/completions
//   NEXT_PUBLIC_LLM_MODEL=llama3.2
//
// Do NOT put paid API keys in NEXT_PUBLIC_ variables (they are visible to every visitor).
// If you ever want a keyed provider, call it from a Next.js route handler instead.

import type { ChatMsg } from './localLLM';

const ENDPOINT = process.env.NEXT_PUBLIC_LLM_ENDPOINT || '';
const MODEL = process.env.NEXT_PUBLIC_LLM_MODEL || 'llama3.2';

export function isRemoteLLMConfigured(): boolean {
  return ENDPOINT.length > 0;
}

export async function generateRemote(
  messages: ChatMsg[],
  onToken?: (text: string) => void,
  signal?: AbortSignal
): Promise<string> {
  if (!ENDPOINT) throw new Error('Remote LLM endpoint not configured');

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, messages, stream: true, temperature: 0.6, max_tokens: 512 }),
    signal,
  });
  if (!res.ok || !res.body) throw new Error(`LLM server responded ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const raw of lines) {
      const line = raw.trim();
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (data === '[DONE]') return full.trim();
      try {
        const delta: string | undefined = JSON.parse(data)?.choices?.[0]?.delta?.content;
        if (delta) {
          full += delta;
          onToken?.(full);
        }
      } catch {
        /* partial JSON line — ignore */
      }
    }
  }
  return full.trim();
}

// ---------------------------------------------------------------------------------------------
// CLOUD tier: a small model the site owner hosts (see /inference). The browser only ever talks to this
// site's own /api/llm route; nothing is downloaded and no endpoint or key is exposed.
// ---------------------------------------------------------------------------------------------
const CLOUD_PREF = 'cloud-ai-off';
let cloud: { up: boolean; label: string; checkedAt: number } = { up: false, label: 'CLOUD', checkedAt: 0 };
let cloudInflight: Promise<void> | null = null;
const cloudSubs = new Set<() => void>();
const emitCloud = () => cloudSubs.forEach((f) => f());

export function subscribeCloud(fn: () => void): () => void {
  cloudSubs.add(fn);
  return () => {
    cloudSubs.delete(fn);
  };
}

export function cloudUserOff(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(CLOUD_PREF) === '1';
  } catch {
    return false;
  }
}

export function setCloudUserOff(off: boolean): void {
  try {
    if (off) localStorage.setItem(CLOUD_PREF, '1');
    else localStorage.removeItem(CLOUD_PREF);
  } catch {
    /* private mode — preference just won't persist */
  }
  emitCloud();
}

/** True when the server model answered its last probe and the visitor hasn't switched it off. */
export function isCloudReady(): boolean {
  return cloud.up && !cloudUserOff();
}

export function cloudLabel(): string {
  return cloud.label;
}

/** Ask the site whether the cloud model is up. Cheap (the server caches the probe); re-checked at most every 45 s. */
export function checkCloud(force = false): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (!force && Date.now() - cloud.checkedAt < 45_000) return Promise.resolve();
  if (cloudInflight) return cloudInflight;
  cloudInflight = (async () => {
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 6000);
      const res = await fetch('/api/llm', { cache: 'no-store', signal: ctl.signal });
      clearTimeout(timer);
      const j = res.ok ? await res.json() : null;
      cloud = { up: !!j?.available, label: String(j?.label || 'CLOUD').slice(0, 30), checkedAt: Date.now() };
    } catch {
      cloud = { ...cloud, up: false, checkedAt: Date.now() };
    }
    cloudInflight = null;
    emitCloud();
  })();
  return cloudInflight;
}

/** After a failed answer, stop sending to the cloud for a while instead of making every message wait. */
export function markCloudDown(): void {
  cloud = { ...cloud, up: false, checkedAt: Date.now() };
  emitCloud();
}

/** Streams an answer through /api/llm. `onToken` receives the full text so far (same as the other tiers). */
export async function generateCloud(messages: ChatMsg[], onToken?: (text: string) => void, signal?: AbortSignal): Promise<string> {
  const ctl = new AbortController();
  const link = () => ctl.abort();
  signal?.addEventListener('abort', link);
  // A cold free server can take a while to wake; if nothing arrives quickly, answer from the rules instead.
  let first = setTimeout(() => ctl.abort(), 14_000);
  let full = '';
  try {
    const res = await fetch('/api/llm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
      signal: ctl.signal,
    });
    if (!res.ok || !res.body) throw new Error(`cloud ${res.status}`);
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() || '';
      for (const raw of lines) {
        const line = raw.trim();
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (data === '[DONE]') return full.trim();
        try {
          const j = JSON.parse(data);
          if (j.error && !full) throw new Error('cloud upstream');
          if (typeof j.delta === 'string' && j.delta) {
            clearTimeout(first);
            first = setTimeout(() => ctl.abort(), 20_000); // stall guard between chunks
            full += j.delta;
            onToken?.(full);
          }
        } catch (e) {
          if (e instanceof Error && e.message === 'cloud upstream') throw e;
        }
      }
    }
    return full.trim();
  } finally {
    clearTimeout(first);
    signal?.removeEventListener('abort', link);
  }
}
