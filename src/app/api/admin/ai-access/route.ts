// src/app/api/admin/ai-access/route.ts — owner-only: limits, plans, passes, payment requests and usage for the cloud model.
import { admin, fail } from '@/lib/admin/api';
import {
  addPasses, approveRequest, deletePass, getConfig, getDb, makePass, rejectRequest, revokePass, sanitizeConfig, saveConfig, usageHistory, usageToday,
} from '@/server/aiAccess';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = admin(async () => {
  const [config, db, today, history] = await Promise.all([getConfig(), getDb(), usageToday(), usageHistory(7)]);
  const passes = Object.values(db.passes).sort((a, b) => b.created - a.created).slice(0, 200);
  return { config, passes, requests: db.requests.slice(0, 100), today, history };
});

export const POST = admin(async ({ body }) => {
  const action = String(body.action || '');
  if (action === 'saveConfig') {
    return { config: await saveConfig(sanitizeConfig(body.config as object)) };
  }
  if (action === 'createPass') {
    const cfg = await getConfig();
    const plan = cfg.plans.find((p) => p.id === body.plan) || null;
    const count = Math.max(1, Math.min(50, Math.floor(Number(body.count) || 1)));
    const custom = !plan;
    if (custom && !Number.isFinite(Number(body.messages))) fail(400, 'Pick a plan or enter a number of answers.');
    const made = Array.from({ length: count }, () => makePass(plan, {
      messages: custom ? Number(body.messages) : undefined, days: Number(body.days) || undefined,
      label: custom ? String(body.label || 'Gift') : undefined, note: String(body.note || ''),
    }));
    await addPasses(made);
    return { codes: made.map((p) => p.code) };
  }
  if (action === 'approve') {
    const r = await approveRequest(String(body.id));
    if (!r) fail(404, 'That request is not pending any more.');
    return r;
  }
  if (action === 'reject') { await rejectRequest(String(body.id)); return { ok: true }; }
  if (action === 'revoke') { await revokePass(String(body.code)); return { ok: true }; }
  if (action === 'delete') { await deletePass(String(body.code)); return { ok: true }; }
  return fail(400, 'Unknown action.');
}, true);
