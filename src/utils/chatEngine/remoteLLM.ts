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
export interface CloudQuota {
  enabled: boolean; plan: 'free' | 'pass' | 'unlimited'; planName: string;
  left: number; limit: number; freeLeft: number; passLeft: number; resetAt: number; expires: number; // left / passLeft: -1 = unlimited
}
let cloud: { up: boolean; label: string; checkedAt: number; quota: CloudQuota | null } = { up: false, label: 'CLOUD', checkedAt: 0, quota: null };
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

export const cloudQuota = (): CloudQuota | null => cloud.quota;

/** Today's free answers (and any pass) are used up: the chat runs on the built-in rules until the reset or a pass. */
export function cloudExhausted(): boolean {
  const q = cloud.quota;
  return !!q && q.enabled && q.left === 0 && Date.now() < q.resetAt;
}

/** True when the server model answered its last probe, the visitor hasn't switched it off, and they still have answers left. */
export function isCloudReady(): boolean {
  return cloud.up && !cloudUserOff() && !cloudExhausted();
}

/** The model server is up but this visitor has hit their limit (used to show the "get more" panel). */
export function isCloudLimited(): boolean {
  return cloud.up && cloudExhausted();
}

function setQuota(q: CloudQuota | null | undefined) {
  if (q && typeof q === 'object') { cloud = { ...cloud, quota: q }; emitCloud(); }
}

export async function loadAccess(): Promise<{ plans: Array<{ id: string; name: string; price: string; note: string }>; payInfo: string; quota: CloudQuota } | null> {
  try {
    const r = await fetch('/api/ai-pass', { cache: 'no-store' });
    if (!r.ok) return null;
    const j = await r.json();
    setQuota(j.quota);
    return j;
  } catch { return null; }
}

async function postPass(body: Record<string, unknown>): Promise<{ ok: boolean; error?: string; message?: string }> {
  try {
    const r = await fetch('/api/ai-pass', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (r.ok && j.quota) { setQuota(j.quota); void checkCloud(true); }
    return r.ok ? { ok: true, message: j.message } : { ok: false, error: j.error || 'Something went wrong. Please try again.' };
  } catch { return { ok: false, error: 'No connection. Please try again.' }; }
}
export const redeemPass = (code: string) => postPass({ action: 'redeem', code });
export const requestPass = (r: { plan: string; name: string; contact: string; txId: string }) => postPass({ action: 'request', ...r });

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
      cloud = { up: !!j?.available, label: String(j?.label || 'CLOUD').slice(0, 30), checkedAt: Date.now(), quota: j?.quota || cloud.quota };
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
    if (res.status === 429) {
      const j = await res.json().catch(() => null);
      if (j?.error === 'limit') { setQuota(j.quota); throw new Error('cloud limit'); }
      throw new Error('cloud busy');
    }
    if (!res.ok || !res.body) throw new Error(`cloud ${res.status}`);
    const left = parseInt(res.headers.get('X-AI-Left') || '', 10);
    if (Number.isFinite(left) && cloud.quota) setQuota({ ...cloud.quota, left });
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
