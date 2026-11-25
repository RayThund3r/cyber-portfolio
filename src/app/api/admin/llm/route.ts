// src/app/api/admin/llm/route.ts — owner-only: is the cloud model configured and reachable, how fast is it, and a test prompt.
import { admin } from '@/lib/admin/api';
import { llmConfig, llmHealth } from '@/server/llm';
import { candidates, getDb, streamWithFallback } from '@/server/llmProviders';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export const GET = admin(async () => {
  const c = llmConfig();
  let host = '';
  try { host = c.url ? new URL(c.url).host : ''; } catch { host = 'invalid URL'; }
  const h = c.url ? await llmHealth(true) : { ok: false, ms: 0 };
  // The whole fallback chain (Groq, Gemini, … then your own server), which is what visitors actually use
  const db = await getDb(); const list = await candidates();
  const chain = { master: db.master, live: list.length, first: list[0]?.label || '', names: list.map((x) => x.label) };
  return { chain, configured: !!c.url, ok: h.ok, pingMs: h.ms, host, model: c.model, label: c.label, keySet: !!c.key, maxTokens: c.maxTokens, ratePerMin: c.ratePerMin };
});

/** Sends one short prompt and reports time to first token, total time and the answer. */
export const POST = admin(async ({ body }) => {
  const list = await candidates();
  if (!list.length) throw Object.assign(new Error('No AI provider is ready. Add a free key on the AI Providers page (and make sure the master switch is on).'), { status: 400 });
  const prompt = String(body.prompt || 'Say hello in one short sentence.').slice(0, 300);
  const t0 = Date.now();
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 45_000);
  try {
    const { res, via } = await streamWithFallback([{ role: 'system', content: 'You are a concise assistant for a small repair and design studio website.' }, { role: 'user', content: prompt }], ctl.signal);
    const reader = res.body!.getReader();
    const dec = new TextDecoder();
    let buf = '', text = '', first = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n'); buf = lines.pop() || '';
      for (const l of lines) {
        if (!l.startsWith('data:')) continue;
        const d = l.slice(5).trim();
        if (d === '[DONE]') continue;
        try { const j = JSON.parse(d); if (j.delta) { if (!first) first = Date.now() - t0; text += j.delta; } } catch { /* partial */ }
      }
    }
    const total = Date.now() - t0;
    const words = text.split(/\s+/).filter(Boolean).length;
    return { ok: true, via: list.find((x) => x.id === via)?.label || via, text: text.trim(), firstTokenMs: first, totalMs: total, wordsPerSec: total > first ? Math.round((words / ((total - first) / 1000)) * 10) / 10 : 0 };
  } catch {
    throw Object.assign(new Error('No provider answered in time (or all of them refused). Open AI Providers and use each one's Test to see why.'), { status: 502 });
  } finally { clearTimeout(timer); }
}, true);
