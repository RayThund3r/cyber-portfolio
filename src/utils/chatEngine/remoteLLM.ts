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
