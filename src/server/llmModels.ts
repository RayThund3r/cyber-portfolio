// src/server/llmModels.ts — model discovery and plain-language error explanations for the AI Providers page.
// Free-tier model names change every few months, so instead of trusting a hard-coded name the admin can ask the provider
// which models THIS key may use (a free call that never touches the chat quota) and pick one.
export interface ModelInfo { id: string; retiring?: string }

/** Models the providers have announced they will shut down. Shown as a warning, never blocked. */
const RETIRING: Array<[RegExp, string]> = [
  [/^llama-3\.1-8b-instant$/, 'Groq shuts this model down on 16 Aug 2026'],
  [/^llama-3\.3-70b-versatile$/, 'Groq shuts this model down on 16 Aug 2026'],
  [/^qwen\/qwen3-32b$/, 'Groq has shut this model down'],
  [/^meta-llama\/llama-4-(scout|maverick)/, 'Groq has shut this model down'],
  [/^gemini-2\.5-(pro|flash)$/, 'Google retires this model on 1 Dec 2026'],
  [/^gemini-(1\.|2\.0)/, 'Google has retired or is retiring this model'],
];
export const retiringNote = (id: string): string | undefined => RETIRING.find(([re]) => re.test(id))?.[1];

/** Old built-in defaults that have been replaced. A saved model equal to one of these was never changed by the owner, so it is upgraded. */
export const OLD_DEFAULTS: Record<string, string> = { groq: 'llama-3.1-8b-instant', gemini: 'gemini-2.5-flash', cerebras: 'llama3.1-8b' };

const NOT_CHAT = /embed|whisper|tts|speech|audio|transcribe|guard|moderation|safeguard|image|imagen|veo|vision-preview|orpheus|rerank|dall|aqa|learnlm|robotics|computer-use|live|native-audio|lyria|prompt-guard|compound/i;

/** Pull chat-capable model ids out of an OpenAI-style /models answer. */
export function parseModels(providerId: string, json: unknown): ModelInfo[] {
  const j = json as { data?: unknown; models?: unknown } | null;
  const raw = Array.isArray(j?.data) ? (j!.data as unknown[]) : Array.isArray(j?.models) ? (j!.models as unknown[]) : [];
  const out = new Map<string, ModelInfo>();
  for (const r of raw) {
    const o = r as { id?: unknown; name?: unknown; pricing?: { prompt?: unknown; completion?: unknown } };
    let id = String(o?.id ?? o?.name ?? '').trim().replace(/^models\//, '');
    if (!id || id.length > 100 || !/^[\w./:@+-]+$/.test(id) || NOT_CHAT.test(id)) continue;
    if (providerId === 'gemini' && !/^(gemini|gemma)/i.test(id)) continue;
    if (providerId === 'openrouter') {
      const free = id.endsWith(':free') || (Number(o?.pricing?.prompt) === 0 && Number(o?.pricing?.completion) === 0 && o?.pricing?.prompt !== undefined);
      if (!free) continue;
    }
    out.set(id, { id, retiring: retiringNote(id) });
  }
  return [...out.values()].sort((a, b) => Number(!!a.retiring) - Number(!!b.retiring) || a.id.localeCompare(b.id));
}

/** Best-first preferences: small, fast, generous-free-tier models that are not being retired. */
const PREFER: Record<string, RegExp[]> = {
  groq: [/^openai\/gpt-oss-20b$/, /^openai\/gpt-oss-120b$/, /^qwen\/qwen3\.8/, /instant/],
  gemini: [/^gemini-3\.5-flash-lite/, /^gemini-2\.5-flash-lite$/, /flash-lite/, /^gemini-3.*flash/, /flash/],
  openrouter: [/gpt-oss-120b:free$/, /llama-3\.3-70b-instruct:free$/, /gpt-oss-20b:free$/, /:free$/],
  mistral: [/^mistral-small-latest$/, /small/, /^ministral/],
  cerebras: [/^gpt-oss-120b$/, /^qwen-3/, /llama/],
};
export function pickBest(providerId: string, models: ModelInfo[]): string {
  const usable = models.filter((m) => !m.retiring);
  const pool = usable.length ? usable : models;
  for (const re of PREFER[providerId] || []) { const hit = pool.find((m) => re.test(m.id)); if (hit) return hit.id; }
  return pool[0]?.id || '';
}

/** Turn a provider's raw error into something the owner can act on. */
export function explainError(status: number, body: string, model: string): { text: string; kind: 'key' | 'model' | 'quota' | 'minute' | 'down' | 'other' } {
  let msg = body || '';
  try { const j = JSON.parse(body); msg = String(j?.error?.message ?? j?.[0]?.error?.message ?? j?.message ?? body); } catch { /* keep raw */ }
  msg = msg.replace(/\s+/g, ' ').slice(0, 220);
  const low = `${body} ${msg}`.toLowerCase();
  if (status === 401 || status === 403) return { kind: 'key', text: 'The key was refused. Check it was copied completely, has not been deleted, and belongs to this service.' };
  if (status === 429) {
    if (/limit:\s*0|no quota|not available on the free|free tier.*not/.test(low)) return { kind: 'quota', text: `Your free plan has no quota for "${model}". Pick a different model (a "flash-lite" or small one) with Load models.` };
    if (/per ?day|daily|rpd|resource_exhausted|quota/.test(low) && !/per ?minute|rpm|tpm/.test(low)) return { kind: 'quota', text: `The free daily quota for "${model}" is used up. It refills on its own (usually overnight). Meanwhile pick another model, or let the next service answer. Every Test click counts against it.` };
    return { kind: 'minute', text: 'Too many requests this minute. Wait about a minute and try again. The chat will use the next service in your list meanwhile.' };
  }
  if (status === 404 || (status === 400 && /model/.test(low))) return { kind: 'model', text: `"${model}" is not available. It may have been retired or renamed. Use Load models to see what your key can use.` };
  if (status >= 500) return { kind: 'down', text: 'The service is having trouble right now. Try again in a few minutes.' };
  return { kind: 'other', text: `The service said: ${msg || 'error ' + status}` };
}
