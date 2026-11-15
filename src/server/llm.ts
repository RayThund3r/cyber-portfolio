// src/server/llm.ts
//
// "Cloud" tier for the chat assistant: a small model (Qwen2.5 0.5B / 1.5B) that YOU host on a free
// inference server (see /inference). Visitors download nothing; the browser talks to /api/llm and this
// module talks to the inference server, so its address and key never reach the visitor.
//
// Env (all server-side, none are NEXT_PUBLIC_):
//   LLM_ENDPOINT   base URL of an OpenAI-compatible server, e.g. https://you-space.hf.space  (…/v1/chat/completions is added)
//                  a full ".../chat/completions" URL is accepted as well.
//   LLM_MODEL      model name sent upstream (default "qwen2.5-1.5b-instruct"; llama.cpp ignores it)
//   LLM_API_KEY    optional bearer token if your server requires one
//   LLM_LABEL      what the chat panel shows, e.g. "BALANCED (cloud)"
//   LLM_MAX_TOKENS cap per answer (default 400)
//   LLM_RATE_PER_MIN per-visitor requests per minute (default 12)
import 'server-only';

export interface ChatMsgIn { role: 'system' | 'user' | 'assistant'; content: string }

const env = (k: string) => (process.env[k] || '').trim();

export function llmConfig() {
  const raw = env('LLM_ENDPOINT');
  let url = '';
  if (raw) {
    const base = raw.replace(/\/+$/, '');
    url = /\/chat\/completions$/.test(base) ? base : /\/v1$/.test(base) ? `${base}/chat/completions` : `${base}/v1/chat/completions`;
  }
  const num = (k: string, d: number, lo: number, hi: number) => {
    const n = parseInt(env(k), 10);
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
  };
  return {
    url,
    model: env('LLM_MODEL') || 'qwen2.5-1.5b-instruct',
    key: env('LLM_API_KEY'),
    label: env('LLM_LABEL') || 'CLOUD',
    maxTokens: num('LLM_MAX_TOKENS', 400, 32, 1024),
    ratePerMin: num('LLM_RATE_PER_MIN', 12, 1, 120),
  };
}

export const llmConfigured = () => !!llmConfig().url;

// Health probe, cached so status polling from many visitors never hammers (or wakes) the upstream.
let probe: { at: number; ok: boolean; ms: number } | null = null;
export async function llmHealth(force = false): Promise<{ ok: boolean; ms: number; cached: boolean }> {
  const c = llmConfig();
  if (!c.url) return { ok: false, ms: 0, cached: false };
  if (!force && probe && Date.now() - probe.at < (probe.ok ? 60_000 : 20_000)) return { ok: probe.ok, ms: probe.ms, cached: true };
  const t0 = Date.now();
  let ok = false;
  try {
    const origin = new URL(c.url).origin;
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 4000);
    const res = await fetch(`${origin}/health`, { signal: ctl.signal, headers: c.key ? { Authorization: `Bearer ${c.key}` } : undefined, cache: 'no-store' });
    clearTimeout(timer);
    // llama.cpp: /health → 200 when the model is loaded (503 while loading). Ollama has no /health, so any non-5xx counts.
    ok = res.status < 500;
  } catch {
    ok = false;
  }
  probe = { at: Date.now(), ok, ms: Date.now() - t0 };
  return { ok, ms: probe.ms, cached: false };
}

/** Validate and bound whatever the browser sent. Returns null when it isn't usable. */
export function sanitizeMessages(input: unknown): ChatMsgIn[] | null {
  if (!Array.isArray(input) || input.length === 0 || input.length > 14) return null;
  const out: ChatMsgIn[] = [];
  let total = 0;
  let systems = 0;
  for (const m of input) {
    const role = (m as any)?.role;
    const content = (m as any)?.content;
    if ((role !== 'system' && role !== 'user' && role !== 'assistant') || typeof content !== 'string') return null;
    if (role === 'system') {
      systems++;
      if (systems > 1 || out.length > 0) return null; // one system message, first
    }
    const cut = content.slice(0, role === 'system' ? 6000 : 1500);
    total += cut.length;
    out.push({ role, content: cut });
  }
  if (total > 14000 || out[out.length - 1].role !== 'user') return null;
  return out;
}

/** Streams the upstream answer as our own tiny SSE: `data: {"delta":"…"}` … `data: [DONE]`. */
export async function streamCompletion(messages: ChatMsgIn[], signal: AbortSignal): Promise<Response> {
  const c = llmConfig();
  const upstream = await fetch(c.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(c.key ? { Authorization: `Bearer ${c.key}` } : {}) },
    body: JSON.stringify({ model: c.model, messages, stream: true, temperature: 0.6, top_p: 0.9, max_tokens: c.maxTokens, repeat_penalty: 1.1 }),
    signal,
    cache: 'no-store',
  });
  if (!upstream.ok || !upstream.body) throw new Error(`upstream ${upstream.status}`);

  const enc = new TextEncoder();
  const dec = new TextDecoder();
  const reader = upstream.body.getReader();
  let buf = '';
  let emitted = false;

  const stream = new ReadableStream<Uint8Array>({
    async pull(ctl) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          ctl.enqueue(enc.encode('data: [DONE]\n\n'));
          ctl.close();
          return;
        }
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() || '';
        for (const raw of lines) {
          const line = raw.trim();
          if (!line.startsWith('data:')) continue;
          const data = line.slice(5).trim();
          if (data === '[DONE]') {
            ctl.enqueue(enc.encode('data: [DONE]\n\n'));
            ctl.close();
            reader.cancel().catch(() => {});
            return;
          }
          try {
            const d: string | undefined = JSON.parse(data)?.choices?.[0]?.delta?.content;
            if (d) {
              emitted = true;
              ctl.enqueue(enc.encode(`data: ${JSON.stringify({ delta: d })}\n\n`));
            }
          } catch {
            /* partial line */
          }
        }
      } catch {
        ctl.enqueue(enc.encode(`data: ${JSON.stringify({ error: emitted ? 'cut' : 'upstream' })}\n\n`));
        ctl.close();
      }
    },
    cancel() {
      reader.cancel().catch(() => {});
    },
  });
  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store, no-transform', 'X-Accel-Buffering': 'no' },
  });
}
