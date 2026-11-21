// src/server/llmProviders.ts
//
// Free AI services the OWNER can switch on and off from /admin/ai-providers. Visitors never see keys or addresses.
// The chat tries the enabled providers in the owner's priority order; one that is out of quota, rate-limited, broken or over its own
// daily cap is skipped and the next one answers. When none can answer, the chat falls back to its built-in engine (nothing breaks).
// The environment variables LLM_ENDPOINT/LLM_API_KEY (see llm.ts) still work: they appear as the provider "env".
import 'server-only';
import crypto from 'node:crypto';
import { readJson, update } from './store';
import { llmConfig, llmHealth, streamCompletion, type ChatMsgIn, type Target } from './llm';

export interface CatalogEntry { id: string; name: string; base: string; model: string; signup: string; keys: string; docs: string; note: string }
/** Addresses and model names are best-known defaults: free tiers change, so the admin page tells the owner to check the provider's list. */
export const CATALOG: CatalogEntry[] = [
  { id: 'groq', name: 'Groq', base: 'https://api.groq.com/openai/v1', model: 'llama-3.1-8b-instant', signup: 'https://console.groq.com', keys: 'https://console.groq.com/keys', docs: 'https://console.groq.com/docs/models', note: 'Very fast. Free plan, no card at the time of writing.' },
  { id: 'gemini', name: 'Google Gemini', base: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.5-flash', signup: 'https://aistudio.google.com', keys: 'https://aistudio.google.com/apikey', docs: 'https://ai.google.dev/gemini-api/docs/models', note: 'Google account only. Generous free tier, small daily request cap.' },
  { id: 'openrouter', name: 'OpenRouter', base: 'https://openrouter.ai/api/v1', model: 'meta-llama/llama-3.3-70b-instruct:free', signup: 'https://openrouter.ai', keys: 'https://openrouter.ai/keys', docs: 'https://openrouter.ai/models?q=free', note: 'Many models; pick one whose name ends in ":free". Low free requests per day.' },
  { id: 'mistral', name: 'Mistral', base: 'https://api.mistral.ai/v1', model: 'mistral-small-latest', signup: 'https://console.mistral.ai', keys: 'https://console.mistral.ai/api-keys', docs: 'https://docs.mistral.ai/getting-started/models/', note: 'Free "Experiment" plan (their terms allow using your prompts to improve models).' },
  { id: 'cerebras', name: 'Cerebras', base: 'https://api.cerebras.ai/v1', model: 'llama3.1-8b', signup: 'https://cloud.cerebras.ai', keys: 'https://cloud.cerebras.ai', docs: 'https://inference-docs.cerebras.ai/models/overview', note: 'Very fast. Free tier with daily token limits.' },
];
const CATALOG_IDS = new Set(CATALOG.map((c) => c.id));

export interface ProviderCfg { id: string; name: string; enabled: boolean; keyEnc: string; baseUrl: string; model: string; dailyCap: number; custom?: boolean }
export interface ProvDb { v: 1; master: boolean; order: string[]; envEnabled: boolean; items: Record<string, ProviderCfg> }
interface UsageDay { day: string; by: Record<string, { ok: number; fail: number; skipped: number; last?: string }> }

const DB = 'llm-providers', USAGE = 'llm-usage';
const emptyDb = (): ProvDb => ({ v: 1, master: true, order: [], envEnabled: true, items: {} });

/* ───────── secrets at rest ───────── */
const secretKey = () => crypto.createHash('sha256').update(`llm-keys:${process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || 'dev-secret'}`).digest();
export function seal(plain: string): string {
  const iv = crypto.randomBytes(12); const c = crypto.createCipheriv('aes-256-gcm', secretKey(), iv);
  const ct = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), ct].map((b) => b.toString('base64url')).join('.');
}
export function unseal(enc: string): string {
  try {
    const [iv, tag, ct] = enc.split('.').map((x) => Buffer.from(x, 'base64url'));
    const d = crypto.createDecipheriv('aes-256-gcm', secretKey(), iv); d.setAuthTag(tag);
    return Buffer.concat([d.update(ct), d.final()]).toString('utf8');
  } catch { return ''; }
}

/* ───────── validation ───────── */
const PRIVATE_HOST = /^(localhost|.*\.local|.*\.internal|0\.0\.0\.0|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?$|\[?f[cd][0-9a-f]{2}:)/i;
/** Custom endpoints must be public https addresses (so this server can never be pointed at internal services). Returns the cleaned URL or null. */
export function cleanBaseUrl(input: unknown): string | null {
  try {
    const u = new URL(String(input || '').trim());
    if (u.protocol !== 'https:' || u.username || u.password || PRIVATE_HOST.test(u.hostname)) return null;
    return u.toString().replace(/\/+$/, '');
  } catch { return null; }
}
export const chatUrl = (base: string) => (/\/chat\/completions$/.test(base) ? base : `${base.replace(/\/+$/, '')}/chat/completions`);

/* ───────── storage ───────── */
export async function getDb(): Promise<ProvDb> {
  const d = await readJson<ProvDb>(DB, emptyDb());
  return { ...emptyDb(), ...d, items: d.items || {}, order: Array.isArray(d.order) ? d.order : [] };
}
const defaults = (e: CatalogEntry): ProviderCfg => ({ id: e.id, name: e.name, enabled: false, keyEnc: '', baseUrl: e.base, model: e.model, dailyCap: 0 });
/** All providers in priority order: saved order first, then anything not yet ordered. Catalog entries always exist (off until configured). */
export function ordered(db: ProvDb): ProviderCfg[] {
  const all: Record<string, ProviderCfg> = {};
  for (const e of CATALOG) all[e.id] = { ...defaults(e), ...(db.items[e.id] || {}), id: e.id, name: e.name };
  for (const [id, it] of Object.entries(db.items)) if (it.custom) all[id] = it;
  const ids = [...db.order.filter((i) => all[i]), ...Object.keys(all).filter((i) => !db.order.includes(i))];
  return ids.map((i) => all[i]);
}
const num = (v: unknown, lo: number, hi: number, d: number) => { const n = Math.floor(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };

export interface SaveInput { id: string; enabled?: boolean; key?: string; clearKey?: boolean; model?: string; baseUrl?: string; dailyCap?: number; name?: string }
export async function saveProvider(inp: SaveInput): Promise<void> {
  await update<ProvDb>(DB, emptyDb(), (d) => {
    const cur = ordered(d).find((p) => p.id === inp.id);
    if (!cur) throw Object.assign(new Error('Unknown provider.'), { status: 404 });
    const next: ProviderCfg = { ...cur };
    if (typeof inp.enabled === 'boolean') next.enabled = inp.enabled;
    if (inp.clearKey) next.keyEnc = '';
    else if (typeof inp.key === 'string' && inp.key.trim()) { const k = inp.key.trim(); if (k.length < 8 || k.length > 400 || /\s/.test(k)) throw Object.assign(new Error('That does not look like an API key.'), { status: 400 }); next.keyEnc = seal(k); }
    if (typeof inp.model === 'string') { const m = inp.model.trim(); if (!/^[\w./:@+-]{1,100}$/.test(m)) throw Object.assign(new Error('Model name has odd characters.'), { status: 400 }); next.model = m; }
    if (inp.dailyCap !== undefined) next.dailyCap = num(inp.dailyCap, 0, 1_000_000, 0);
    if (cur.custom) {
      if (inp.baseUrl !== undefined) { const u = cleanBaseUrl(inp.baseUrl); if (!u) throw Object.assign(new Error('Use a public https:// address.'), { status: 400 }); next.baseUrl = u; }
      if (typeof inp.name === 'string' && inp.name.trim()) next.name = inp.name.trim().slice(0, 40);
    }
    if (next.enabled && !next.keyEnc) throw Object.assign(new Error('Add an API key before switching this on.'), { status: 400 });
    d.items[next.id] = next;
    if (!d.order.includes(next.id)) d.order = ordered(d).map((p) => p.id);
  });
}
export async function addCustom(name: string, baseUrl: string): Promise<string> {
  const u = cleanBaseUrl(baseUrl); if (!u) throw Object.assign(new Error('Use a public https:// address.'), { status: 400 });
  const id = 'c' + crypto.randomBytes(4).toString('hex');
  await update<ProvDb>(DB, emptyDb(), (d) => {
    if (Object.values(d.items).filter((i) => i.custom).length >= 6) throw Object.assign(new Error('Maximum 6 custom endpoints.'), { status: 400 });
    d.items[id] = { id, name: (name || 'Custom').trim().slice(0, 40) || 'Custom', enabled: false, keyEnc: '', baseUrl: u, model: '', dailyCap: 0, custom: true };
    d.order = [...ordered(d).map((p) => p.id).filter((x) => x !== id), id];
  });
  return id;
}
export async function removeCustom(id: string): Promise<void> {
  await update<ProvDb>(DB, emptyDb(), (d) => { if (d.items[id]?.custom) { delete d.items[id]; d.order = d.order.filter((x) => x !== id); } });
}
export async function setOrder(order: string[]): Promise<void> {
  await update<ProvDb>(DB, emptyDb(), (d) => { const ids = new Set(ordered(d).map((p) => p.id).concat('env')); d.order = [...new Set(order.filter((x) => ids.has(x)))]; });
}
export async function setMaster(v: boolean): Promise<void> { await update<ProvDb>(DB, emptyDb(), (d) => { d.master = v; }); }
export async function setEnvEnabled(v: boolean): Promise<void> { await update<ProvDb>(DB, emptyDb(), (d) => { d.envEnabled = v; }); }

/* ───────── usage + cool-downs ───────── */
const today = () => new Date().toISOString().slice(0, 10);
export async function usageToday(): Promise<UsageDay> {
  const u = await readJson<UsageDay>(USAGE, { day: today(), by: {} });
  return u.day === today() ? u : { day: today(), by: {} };
}
async function note(id: string, kind: 'ok' | 'fail' | 'skipped', last?: string) {
  await update<UsageDay>(USAGE, { day: today(), by: {} }, (u) => {
    if (u.day !== today()) { u.day = today(); u.by = {}; }
    const r = (u.by[id] ||= { ok: 0, fail: 0, skipped: 0 });
    r[kind]++; if (last) r.last = last.slice(0, 160);
  });
}
const cooldown = new Map<string, number>(); // provider id → timestamp until which it is skipped (in-memory, per server instance)
export const coolUntil = (id: string) => cooldown.get(id) || 0;
export const clearCooldowns = () => cooldown.clear();
const coolFor = (status: number) => (status === 429 ? 90_000 : status === 401 || status === 403 || status === 404 || status === 400 ? 300_000 : 20_000);

export interface Candidate { id: string; label: string; target: Target; cap: number }
/** Providers that may answer right now, in priority order. */
export async function candidates(): Promise<Candidate[]> {
  const db = await getDb();
  if (!db.master) return [];
  const use = await usageToday();
  const out: Candidate[] = [];
  const envCfg = llmConfig();
  const push = (c: Candidate) => { if (coolUntil(c.id) <= Date.now() && !(c.cap > 0 && (use.by[c.id]?.ok || 0) >= c.cap)) out.push(c); };
  const items = new Map(ordered(db).map((p) => [p.id, p]));
  const seq = [...db.order.filter((i) => i === 'env' || items.has(i)), ...(db.order.includes('env') ? [] : ['env']), ...[...items.keys()].filter((i) => !db.order.includes(i))];
  for (const id of new Set(seq)) {
    if (id === 'env') {
      if (envCfg.url && db.envEnabled) push({ id: 'env', label: envCfg.label, cap: 0, target: { url: envCfg.url, model: envCfg.model, key: envCfg.key, maxTokens: envCfg.maxTokens, llamaCpp: true } });
      continue;
    }
    const p = items.get(id)!;
    const key = p.keyEnc ? unseal(p.keyEnc) : '';
    if (!p.enabled || !key || !p.model || !p.baseUrl) continue;
    push({ id: p.id, label: p.name, cap: p.dailyCap, target: { url: chatUrl(p.baseUrl), model: p.model, key, maxTokens: envCfg.maxTokens } });
  }
  return out;
}
export async function anyAvailable(): Promise<{ available: boolean; label: string }> {
  let c = await candidates();
  // A self-hosted server (env) may be asleep: keep the old cached health check for it. Hosted APIs are never pinged (that would burn free quota).
  if (c.some((x) => x.id === 'env')) { const h = await llmHealth(); if (!h.ok) c = c.filter((x) => x.id !== 'env'); }
  return { available: c.length > 0, label: c[0]?.label || '' };
}

/** Tries providers in order until one starts answering. Failures before the first word never reach the visitor. */
export async function streamWithFallback(messages: ChatMsgIn[], signal: AbortSignal): Promise<{ res: Response; via: string }> {
  const list = await candidates();
  let lastErr: unknown = new Error('no provider');
  for (const c of list) {
    try {
      const res = await streamCompletion(messages, signal, c.target);
      void note(c.id, 'ok').catch(() => {});
      return { res, via: c.id };
    } catch (e) {
      if (signal.aborted) throw e;
      const st = Number((e as { status?: number })?.status) || 0;
      cooldown.set(c.id, Date.now() + coolFor(st));
      void note(c.id, 'fail', (e as Error)?.message).catch(() => {});
      lastErr = e;
    }
  }
  throw lastErr;
}

/** Admin "Test" button: one short question to ONE provider; returns timings or the provider's own error text. */
export async function testProvider(id: string): Promise<{ ok: boolean; text?: string; firstTokenMs?: number; totalMs?: number; error?: string }> {
  const db = await getDb(); const envCfg = llmConfig();
  let target: Target | null = null;
  if (id === 'env') target = envCfg.url ? { url: envCfg.url, model: envCfg.model, key: envCfg.key, maxTokens: 60, llamaCpp: true } : null;
  else { const p = ordered(db).find((x) => x.id === id); const key = p?.keyEnc ? unseal(p.keyEnc) : ''; if (p && key && p.baseUrl && p.model) target = { url: chatUrl(p.baseUrl), model: p.model, key, maxTokens: 60 }; }
  if (!target) return { ok: false, error: 'Add an API key and model first.' };
  const t0 = Date.now(); const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 25_000);
  try {
    const res = await streamCompletion([{ role: 'user', content: 'Say hello in one short sentence.' }], ctl.signal, target);
    const reader = res.body!.getReader(); const dec = new TextDecoder(); let buf = '', text = '', first = 0;
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      buf += dec.decode(value, { stream: true }); const lines = buf.split('\n'); buf = lines.pop() || '';
      for (const l of lines) { if (!l.startsWith('data:')) continue; const d = l.slice(5).trim(); if (d === '[DONE]') continue; try { const j = JSON.parse(d); if (j.delta) { if (!first) first = Date.now() - t0; text += j.delta; } else if (j.error) return { ok: false, error: 'The service stopped answering.' }; } catch { /* partial */ } }
    }
    if (!text.trim()) return { ok: false, error: 'The service answered with nothing. Check the model name.' };
    cooldown.delete(id);
    return { ok: true, text: text.trim().slice(0, 300), firstTokenMs: first, totalMs: Date.now() - t0 };
  } catch (e) {
    const m = (e as Error)?.message || '';
    return { ok: false, error: ctl.signal.aborted ? 'No answer within 25 seconds.' : /upstream 401|upstream 403/.test(m) ? `The key was refused (${m.replace('upstream ', '')}).` : /upstream 404/.test(m) ? `Not found: check the model name. ${m.slice(13)}` : /upstream 429/.test(m) ? 'Rate limit or free quota reached right now.' : m.startsWith('upstream') ? `The service said: ${m.replace('upstream ', '')}` : 'Could not reach the service.' };
  } finally { clearTimeout(timer); }
}
