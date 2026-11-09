// src/app/api/builder/ai/route.ts — the builder's AI assistant.
// Hefty-task friendly: up to 6 attachments (images, PDFs, Word, PowerPoint, text/CSV/JSON), 2-minute budget,
// whole-page rebuilds. The model can only return validated operations (see lib/builder/ops.ts).
import { NextResponse } from 'next/server';
import { aiSetup, askForOps, systemPrompt, type AiFile, type AiMsg } from '@/server/ai';
import { extractOfficeText } from '@/server/docx';
import { authProject, isLocked } from '@/server/projects';
import { update } from '@/server/store';
import { clean, clientIp, isLimited, rateLimit, readJsonLimited, sameOrigin } from '@/server/util';
import { sanitizeConfig } from '@/lib/builder/sanitize';
import { applyOps } from '@/lib/builder/ops';
import { reportServerError } from '@/server/mail';

export const runtime = 'nodejs';
export const maxDuration = 120;

// read per request so the limits can be changed without restarting the server
const perProject = () => Math.max(1, Number(process.env.AI_DAILY_LIMIT) || 40);
const perDay = () => Math.max(1, Number(process.env.AI_GLOBAL_DAILY_LIMIT) || 600);
const MAX_FILES = 6;
const MAX_FILE_B64 = 14 * 1024 * 1024;   // ≈10 MB file
const MAX_TOTAL_B64 = 30 * 1024 * 1024;
const IMG = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const OFFICE = new Set(['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.presentationml.presentation']);
const TEXTY = /^(text\/(plain|markdown|csv|html)|application\/(json|csv))$/;

const bad = (error: string, status = 400, extra: Record<string, unknown> = {}) => NextResponse.json({ error, ...extra }, { status });
const today = () => new Date().toISOString().slice(0, 10);

export async function POST(req: Request) {
  if (!sameOrigin(req)) return bad('Request blocked.', 403);
  const ip = clientIp(req);
  if (rateLimit(`ai:${ip}`, 24, 10 * 60_000)) return bad('You are going a little fast — please wait a minute and try again.', 429);

  // bounded while it is read: 6 files of up to ~10 MB (base64 ≈ 30 MB) plus the text
  const parsed = await readJsonLimited(req, 33 * 1024 * 1024);
  if (!parsed.ok) return bad(parsed.status === 413 ? 'Request too large (the files may be too big).' : parsed.error, parsed.status);
  const b: any = parsed.body;

  // same wrong-key protection as the main builder API (per address AND per project)
  const pid = clean(b?.id, 12).toUpperCase();
  if (isLimited(`b-loadfail:${ip}`, 20, 10 * 60_000) || isLimited(`b-guess:${pid}`, 10, 60 * 60_000)) return bad('Too many wrong attempts. Please wait a few minutes and try again.', 429);
  const p = await authProject(pid, clean(b?.key, 64));
  if (!p) { rateLimit(`b-loadfail:${ip}`, 20, 10 * 60_000); rateLimit(`b-guess:${pid}`, 10, 60 * 60_000); return bad('Project not found.', 404); }
  if (isLocked(p)) return bad('This site is locked because an order was placed. Unlock it to keep using the AI.', 409);

  const setup = aiSetup();
  if (!setup) return bad('AI is not connected on this server yet.', 501, { code: 'no_ai' });

  const prompt = clean(b?.prompt, 6000);
  if (!prompt) return bad('Tell the AI what you would like.');

  // ── attachments ──
  const raw: any[] = Array.isArray(b?.attachments) ? b.attachments.slice(0, MAX_FILES) : [];
  let total = 0;
  const files: AiFile[] = [];
  const docs: { name: string; text: string }[] = [];
  const notes: string[] = [];
  for (const a of raw) {
    const name = clean(a?.name, 80) || 'file';
    const mime = clean(a?.mime, 120);
    const data = typeof a?.data === 'string' ? a.data : '';
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(data) || data.length > MAX_FILE_B64) { notes.push(`“${name}” was skipped (unreadable or too large).`); continue; }
    total += data.length;
    if (total > MAX_TOTAL_B64) { notes.push(`“${name}” was skipped (too much data in one request).`); continue; }
    const buf = Buffer.from(data, 'base64');
    try {
      if (IMG.has(mime)) {
        files.push({ name, mime, data });
        if (typeof a?.assetId === 'string' && /^[a-z0-9]{8}$/.test(a.assetId) && p.assets[a.assetId]) docs.push({ name: `Image “${name}”`, text: `This picture is available to use on the site as asset:${a.assetId}` });
      } else if (mime === 'application/pdf') {
        if (setup.provider === 'openai') notes.push(`“${name}”: this AI connection cannot read PDFs — please paste the text or upload a Word file.`);
        else files.push({ name, mime, data });
      } else if (OFFICE.has(mime)) {
        docs.push({ name, text: extractOfficeText(buf) });
      } else if (TEXTY.test(mime) || /\.(txt|md|csv|json)$/i.test(name)) {
        docs.push({ name, text: buf.toString('utf8').slice(0, 100_000) });
      } else notes.push(`“${name}” (${mime || 'unknown type'}) is not supported.`);
    } catch (e: any) { notes.push(`“${name}” could not be read (${String(e.message).slice(0, 80)}).`); }
  }

  // ── quotas (cost protection) ──
  const day = today();
  const g = await update<{ day: string; n: number }>('aiusage', { day, n: 0 }, (d) => { if (d.day !== day) { d.day = day; d.n = 0; } d.n++; });
  if (g.n > perDay()) return bad('The AI has reached its daily limit for everyone. Please try again tomorrow.', 429);
  let over = false;
  await update<any>(`projects/${p.id}`, null, (d) => {
    if (!d) return;
    d.ai = d.ai?.day === day ? d.ai : { day, n: 0 };
    if (d.ai.n >= perProject()) over = true; else d.ai.n++;
  });
  if (over) return bad(`You have used today's ${perProject()} AI requests for this project. It resets tomorrow.`, 429);

  // ── run ──
  let current;
  try { current = sanitizeConfig(b?.config ?? p.config, { assetIds: new Set(Object.keys(p.assets)) }); } catch { current = p.config; }
  const history: AiMsg[] = (Array.isArray(b?.history) ? b.history.slice(-6) : [])
    .map((m: any) => ({ role: m?.role === 'assistant' ? 'assistant' : 'user', text: clean(m?.text, 1500) } as AiMsg)).filter((m: AiMsg) => m.text);
  const firstIsUser = history.length === 0 || history[0].role === 'user';
  const msgs: AiMsg[] = [...(firstIsUser ? history : history.slice(1)), { role: 'user', text: prompt, files }];
  // providers require alternating roles — merge consecutive same-role messages
  const merged: AiMsg[] = [];
  for (const m of msgs) { const l = merged[merged.length - 1]; if (l && l.role === m.role) { l.text += '\n\n' + m.text; l.files = [...(l.files || []), ...(m.files || [])]; } else merged.push({ ...m }); }

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 110_000);
  try {
    const out = await askForOps(setup, systemPrompt(current, Object.keys(p.assets), docs, b?.allowCode === true), merged, ctl.signal);
    const r = applyOps(current, out.ops, { assetIds: new Set(Object.keys(p.assets)), allowCode: b?.allowCode === true });
    return NextResponse.json({ message: out.message, config: r.config, applied: r.applied, skipped: r.skipped, notes, remaining: Math.max(0, perProject() - (p.ai?.day === day ? p.ai.n : 0) - 1) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e: any) {
    // the model never produced a usable answer — don't charge the customer's daily allowance
    await update<any>(`projects/${p.id}`, null, (d) => { if (d?.ai?.day === day && d.ai.n > 0) d.ai.n--; }).catch(() => {});
    if (e?.name === 'AbortError') return bad('That was a big job and it timed out. Try asking for one part at a time.', 504);
    if (e?.status === 401 || e?.status === 403) { await reportServerError('ai:auth', e); return bad('The AI connection is not authorised. The site owner needs to check the AI key.', 502); }
    if (e?.status === 429) return bad('The AI service is busy right now. Please try again in a minute.', 503);
    await reportServerError('ai:call', e);
    return bad(e?.message ? `The AI had a problem: ${String(e.message).slice(0, 160)}` : 'The AI had a problem. Please try again.', 502);
  } finally { clearTimeout(timer); }
}
