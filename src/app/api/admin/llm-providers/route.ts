// src/app/api/admin/llm-providers/route.ts — owner-only: switch free AI services on/off, set order, caps, keys; test one.
import { admin, fail } from '@/lib/admin/api';
import { llmConfig } from '@/server/llm';
import { CATALOG, autoPickModel, listModels, addCustom, getDb, ordered, removeCustom, saveProvider, setEnvEnabled, setMaster, setOrder, testProvider, detectProvider, unseal, usageToday, coolUntil } from '@/server/llmProviders';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export const GET = admin(async () => {
  const [db, use] = await Promise.all([getDb(), usageToday()]);
  const env = llmConfig();
  let envHost = ''; try { envHost = env.url ? new URL(env.url).host : ''; } catch { envHost = 'invalid URL'; }
  const cat = new Map(CATALOG.map((c) => [c.id, c]));
  const items = ordered(db).map((p) => {
    const key = p.keyEnc ? unseal(p.keyEnc) : '';
    const c = cat.get(p.id);
    return {
      id: p.id, name: p.name, enabled: p.enabled, custom: !!p.custom, model: p.model, baseUrl: p.baseUrl, dailyCap: p.dailyCap,
      keySet: !!key, keyTail: key ? key.slice(-4) : '', keyLost: !!p.keyEnc && !key,
      links: c ? { signup: c.signup, keys: c.keys, docs: c.docs } : null, note: c?.note || (p.custom ? 'Any OpenAI-compatible service with a public https address.' : ''),
      today: use.by[p.id] || { ok: 0, fail: 0, skipped: 0 }, coolingMs: Math.max(0, coolUntil(p.id) - Date.now()),
    };
  });
  const order = db.order.length ? db.order : items.map((i) => i.id);
  return {
    master: db.master, items, order,
    env: { configured: !!env.url, enabled: db.envEnabled, host: envHost, model: env.model, today: use.by.env || { ok: 0, fail: 0, skipped: 0 } },
    day: use.day,
  };
});

export const POST = admin(async ({ body }) => {
  const action = String(body.action || '');
  const id = String(body.id || '');
  switch (action) {
    case 'master': await setMaster(!!body.value); return { ok: true };
    case 'env': await setEnvEnabled(!!body.value); return { ok: true };
    case 'save':
      await saveProvider({ id, enabled: typeof body.enabled === 'boolean' ? body.enabled : undefined, key: typeof body.key === 'string' ? body.key : undefined, clearKey: !!body.clearKey, model: typeof body.model === 'string' ? body.model : undefined, baseUrl: typeof body.baseUrl === 'string' ? body.baseUrl : undefined, dailyCap: body.dailyCap as number | undefined, name: typeof body.name === 'string' ? body.name : undefined });
      return { ok: true };
    case 'order': if (!Array.isArray(body.order)) fail(400, 'Bad order.'); await setOrder((body.order as unknown[]).map(String)); return { ok: true };
    case 'addCustom': return { id: await addCustom(String(body.name || ''), String(body.baseUrl || '')) };
    case 'removeCustom': await removeCustom(id); return { ok: true };
    case 'test': return testProvider(id);
    case 'models': return listModels(id);
    case 'autopick': return autoPickModel(id);
    case 'quick': {
      // Paste any supported key: the service is recognised from its prefix, saved, switched on, and tested in one go.
      const key = String(body.key || '').trim();
      if (key.length < 20 || key.length > 400) fail(400, 'That does not look like an API key.');
      const pid = detectProvider(key);
      if (!pid) fail(400, 'I could not tell which service that key is for. Paste it into the matching card below instead.');
      await saveProvider({ id: pid!, enabled: true, key });
      await setMaster(true);
      const pick = await autoPickModel(pid!).catch(() => ({ model: '', changed: false }));
      return { id: pid, model: pick.model, switched: pick.changed, test: await testProvider(pid!) };
    }
    default: return fail(400, 'Unknown action.');
  }
}, true);
