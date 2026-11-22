// src/lib/admin/liveChecks.ts — owner-only "does it REALLY work from the live server?" probes for the Launch Pad.
// Each check is read-only (or writes then deletes one tiny test record), has a short timeout, and reports no secret values.
import { putJson, readJson, removeJson, storageInfo } from '@/server/store';
import { searchWeb } from '@/utils/chatEngine/webSearch';

export interface LiveCheck { id: string; title: string; ok: boolean | null; detail: string; fix?: string; ms: number }

const TIMEOUT = 7000;
const timed = async <T,>(fn: (s: AbortSignal) => Promise<T>): Promise<T> => {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), TIMEOUT);
  try { return await fn(c.signal); } finally { clearTimeout(t); }
};
const msg = (e: unknown) => (e instanceof Error ? (e.name === 'AbortError' ? 'timed out' : e.message) : 'failed').slice(0, 140);

async function check(id: string, title: string, fn: () => Promise<Omit<LiveCheck, 'id' | 'title' | 'ms'>>): Promise<LiveCheck> {
  const t0 = Date.now();
  try { return { id, title, ms: Date.now() - t0, ...(await fn()) }; } catch (e) { return { id, title, ok: false, detail: msg(e), ms: Date.now() - t0 }; }
}

export async function runLiveChecks(env: Record<string, string | undefined>, fetchImpl: typeof fetch = fetch): Promise<LiveCheck[]> {
  const out: Promise<LiveCheck>[] = [];

  out.push(check('storage', 'Storage read/write', async () => {
    const name = 'health-probe';
    const stamp = String(Date.now());
    await putJson(name, { stamp });
    const back = await readJson<{ stamp?: string }>(name, {});
    await removeJson(name).catch(() => {});
    const info = storageInfo();
    if (back.stamp !== stamp) return { ok: false, detail: 'A test record was written but not read back.', fix: 'Check the UPSTASH_REDIS_REST_URL and token values.' };
    return info.persistent
      ? { ok: true, detail: `Working and persistent (${info.where}).` }
      : { ok: true, detail: `Working, but NOT persistent (${info.where}). Orders and settings can be lost on redeploy.`, fix: 'Add a free Upstash Redis database (UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN).' };
  }));

  out.push(check('web', 'Internet answers (Wikipedia)', async () => {
    const r = await timed((signal) => searchWeb('who invented the telephone', 'FRIENDLY', signal));
    if (!r) return { ok: false, detail: 'The server could not get a confident answer from Wikipedia.', fix: 'Outbound requests may be blocked. The chat still works from its built-in knowledge.' };
    return { ok: true, detail: `Got “${r.title}” with confidence ${(r.confidence ?? 0).toFixed(2)}.` };
  }));

  out.push(check('resend', 'Email sending (Resend)', async () => {
    const key = env.RESEND_API_KEY;
    if (!key) return { ok: null, detail: 'Not set up. Contact messages are saved but no email is sent.', fix: 'Add RESEND_API_KEY in Vercel.' };
    const res = await timed((signal) => fetchImpl('https://api.resend.com/domains', { headers: { Authorization: `Bearer ${key}` }, signal }));
    if (res.status === 200) return { ok: true, detail: 'The key is valid.' };
    const body = (await res.text().catch(() => '')).toLowerCase();
    if (res.status === 401 && /restricted/.test(body)) return { ok: true, detail: 'The key is valid (send-only key).' };
    return { ok: false, detail: `Resend rejected the key (HTTP ${res.status}).`, fix: 'Create a new API key at resend.com and update RESEND_API_KEY.' };
  }));

  out.push(check('site', 'Public site address', async () => {
    const url = (env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');
    if (!/^https:\/\//.test(url)) return { ok: null, detail: 'NEXT_PUBLIC_SITE_URL is not an https address.', fix: 'Set it to your live address, e.g. https://your-site.vercel.app' };
    const res = await timed((signal) => fetchImpl(`${url}/api/health`, { signal, cache: 'no-store' }));
    return res.ok ? { ok: true, detail: `${url} answers.` } : { ok: false, detail: `${url} answered HTTP ${res.status}.`, fix: 'Check the address matches your deployment.' };
  }));

  return Promise.all(out);
}
