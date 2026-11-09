// src/app/api/admin/route.ts — one authenticated endpoint, action-based (POST only).
import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { adminConfigured, checkPassword, createSession, destroySession, isAdmin, ipAllowed, lockedOut, noteFailure, totpRequired, verifyTotp, logoutEverywhere, audit, readAudit, clearAudit } from '@/server/auth';
import { clean, clientIp, rateLimit, readJsonLimited, safeLink, sameOrigin, toWaNumber } from '@/server/util';
import { listTickets, mutateTicket, getProjects, saveProjects, readStats, storageInfo, bulkSetStatus, deleteTickets, importTickets, type Ticket } from '@/server/store';
import { notifyCustomer, notifyOwner, reportServerError } from '@/server/mail';
import { esc } from '@/server/util';
import { assetDataUrls, deleteProject, listProjects, loadProject } from '@/server/projects';
import { getTemplates, saveTemplates } from '@/server/builderUtil';
import { getRates } from '@/server/rates';
import { CATEGORIES as TEMPLATE_CATEGORIES } from '@/lib/builder/schema';
import { sanitizeConfig } from '@/lib/builder/sanitize';
import type { TemplateDef } from '@/lib/builder/templates';
import { STATUS_FLOW, type TicketStatus } from '@/lib/shared';
import type { ProjectItem } from '@/data/portfolioData';

export const runtime = 'nodejs';

const STATUSES = new Set<string>([...STATUS_FLOW, 'CANCELLED']);
const CATEGORIES = ['UI/UX', 'BRANDING', 'WEBAPP', 'HARDWARE'] as const;
const ok = (data: unknown = {}) => NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

const url = (v: unknown) => safeLink(v, 600); // /path or https:// only ("//other.site" and backslash tricks are refused)
const num = (v: unknown, max = 100_000_000) => {
  if (v === '' || v === null || v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.min(max, Math.round(n)) : undefined;
};

const iso = (v: unknown) => {
  const d = new Date(String(v ?? ''));
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
};

/** Validates a ticket coming from a backup file; returns null when it is not a real ticket. */
function cleanImportedTicket(t: any): Ticket | null {
  const id = clean(t?.id, 20).toUpperCase();
  if (!/^SYS-[A-Z0-9]{6}$/.test(id)) return null;
  if (!['repair', 'design', 'template'].includes(t?.kind)) return null;
  const status = (STATUSES.has(t?.status) ? t.status : 'RECEIVED') as TicketStatus;
  const slot = t?.slot && /^\d{4}-\d{2}-\d{2}$/.test(String(t.slot.date)) && /^\d{2}:\d{2}$/.test(String(t.slot.time)) ? { date: String(t.slot.date), time: String(t.slot.time) } : undefined;
  const payments = (Array.isArray(t.payments) ? t.payments : []).slice(0, 20).map((p: any, i: number) => ({
    id: clean(p?.id, 40) || `imp${i}`,
    network: ['MTN', 'AIRTEL', 'OTHER'].includes(p?.network) ? p.network : 'OTHER',
    txId: clean(p?.txId, 60),
    ...(num(p?.amountUGX) !== undefined ? { amountUGX: num(p?.amountUGX) } : {}),
    status: ['SUBMITTED', 'CONFIRMED', 'REJECTED'].includes(p?.status) ? p.status : 'SUBMITTED',
    at: iso(p?.at),
  }));
  const history = (Array.isArray(t.history) ? t.history : []).slice(0, 100).map((h: any) => ({
    at: iso(h?.at),
    status: (STATUSES.has(h?.status) ? h.status : status) as TicketStatus,
    ...(h?.note ? { note: clean(h.note, 500) } : {}),
  }));
  const projectId = clean(t?.projectId, 40);
  const adminNotes = clean(t?.adminNotes, 2000);
  return {
    id, kind: t.kind, ...(projectId ? { projectId } : {}),
    name: clean(t?.name, 100), email: clean(t?.email, 254), phone: clean(t?.phone, 30), details: clean(t?.details, 5000),
    ...(slot ? { slot } : {}), status,
    ...(num(t?.quoteUGX) !== undefined ? { quoteUGX: num(t?.quoteUGX) } : {}),
    ...(num(t?.depositUGX) !== undefined ? { depositUGX: num(t?.depositUGX) } : {}),
    payments, history, ...(adminNotes ? { adminNotes } : {}),
    createdAt: iso(t?.createdAt), updatedAt: iso(t?.updatedAt),
  };
}

function cleanProject(p: any, id: string): ProjectItem | string {
  const title = clean(p?.title, 120);
  const description = clean(p?.description, 600);
  const image = url(p?.image);
  if (!title || !description) return 'Title and description are required.';
  if (!image) return 'Image must be an https:// URL or a /path in /public.';
  const category = (CATEGORIES as readonly string[]).includes(p?.category) ? p.category : 'WEBAPP';
  const list = (v: unknown, n: number, f: (s: unknown) => string) => (Array.isArray(v) ? v.map(f).filter(Boolean).slice(0, n) : []);
  const metrics = clean(p?.metrics, 80);
  const clientType = clean(p?.clientType, 80);
  return {
    id, title, description, image, category,
    ...(metrics ? { metrics } : {}),
    ...(clientType ? { clientType } : {}),
    tools: list(p?.tools, 10, (s) => clean(s, 40)),
    gallery: list(p?.gallery, 10, url),
    featured: !!p?.featured,
    ...(url(p?.liveUrl) ? { liveUrl: url(p?.liveUrl) } : {}),
  };
}

export async function POST(req: Request) {
  if (!sameOrigin(req)) return bad('Request blocked.', 403);
  if (!ipAllowed(req)) { await audit(req, 'blocked-ip', false); return bad('Not found.', 404); }
  // A stranger can only ever sign in (tiny body); only a signed-in admin may send large ones (backup restore).
  const signedIn = await isAdmin();
  const parsed = await readJsonLimited(req, signedIn ? 12_000_000 : 4_000);
  if (!parsed.ok) return bad(parsed.error, parsed.status);
  const body: any = parsed.body;
  const action = String(body?.action || '');

  if (action === 'login') {
    if (!adminConfigured()) return bad('Admin is not configured. Set ADMIN_PASSWORD (10+ characters) in your environment.', 503);
    if (lockedOut()) return bad('Admin sign-in is temporarily locked after repeated failures. Try again in 15 minutes.', 429);
    if (rateLimit(`login:${clientIp(req)}`, 6, 15 * 60_000)) return bad('Too many attempts. Try again in 15 minutes.', 429);
    // Password AND (if enabled) the authenticator code must both be right; the error never says which part failed.
    const passOk = checkPassword(String(body?.password || ''));
    const codeOk = verifyTotp(String(body?.code || ''));
    if (!passOk || !codeOk) {
      noteFailure();
      await audit(req, 'login', false);
      await new Promise((r) => setTimeout(r, 600));
      return bad(totpRequired() ? 'Wrong password or code.' : 'Wrong password.', 401);
    }
    await createSession();
    const entry = await audit(req, 'login', true);
    await notifyOwner('[admin] New sign-in to your admin panel', `<p>Signed in at ${esc(entry.at)}<br/>IP: ${esc(entry.ip)}<br/>Device: ${esc(entry.ua)}</p><p>If this wasn't you, open /admin → Insights → "Log out all devices" and change ADMIN_PASSWORD.</p>`);
    return ok();
  }
  if (action === 'logout') { await destroySession(); return ok(); }

  if (!(await isAdmin())) return NextResponse.json({ error: 'Not signed in.', totp: totpRequired() }, { status: 401 });

  try {
    switch (action) {
      case 'me':
        return ok({ ok: true, storage: storageInfo() });

      case 'tickets': {
        const all = await listTickets();
        return ok({ tickets: all.map((t) => ({ ...t, wa: t.phone ? toWaNumber(t.phone) : '' })) });
      }

      case 'ticket.update': {
        const id = clean(body?.id, 20);
        const status = body?.status && STATUSES.has(body.status) ? (body.status as TicketStatus) : undefined;
        const note = clean(body?.note, 500);
        let before: TicketStatus | undefined;
        const t = await mutateTicket(id, (x: Ticket) => {
          before = x.status;
          const quote = num(body?.quoteUGX); const dep = num(body?.depositUGX);
          if ('quoteUGX' in body) x.quoteUGX = quote;
          if ('depositUGX' in body) x.depositUGX = dep;
          if ('adminNotes' in body) x.adminNotes = clean(body.adminNotes, 2000);
          if (body?.paymentId && ['CONFIRMED', 'REJECTED'].includes(body?.paymentStatus)) {
            const p = x.payments.find((q) => q.id === body.paymentId);
            if (p) {
              p.status = body.paymentStatus;
              const tpl = x.kind === 'template';
              if (tpl && p.status === 'CONFIRMED') x.status = 'COMPLETED';
              x.history.push({ at: new Date().toISOString(), status: x.status, note: p.status === 'CONFIRMED' ? (tpl ? 'Payment confirmed — your website download is unlocked. 🎉' : 'Deposit confirmed — thank you!') : 'We could not verify your payment — please contact us.' });
            }
          }
          if (status && status !== x.status) x.status = status;
          if ((status && status !== before) || note) x.history.push({ at: new Date().toISOString(), status: x.status, note: note || undefined });
        });
        if (!t) return bad('Ticket not found.', 404);
        if (body?.notify !== false && ((status && status !== before) || note)) void notifyCustomer(t.email, t.id, t.status, note);
        return ok({ ticket: { ...t, wa: t.phone ? toWaNumber(t.phone) : '' } });
      }

      // Bulk actions on many requests at once (customers are NOT emailed for these).
      case 'tickets.bulk': {
        const ids = Array.isArray(body?.ids) ? [...new Set<string>(body.ids.map((i: unknown) => clean(i, 20)).filter(Boolean))].slice(0, 200) : [];
        if (!ids.length) return bad('Select at least one request.');
        if (body?.op === 'delete') {
          const deleted = await deleteTickets(ids);
          await audit(req, `tickets-delete:${deleted}`, true);
          return ok({ deleted });
        }
        const status = body?.status;
        if (!status || !STATUSES.has(status)) return bad('Choose a status.');
        const updated = await bulkSetStatus(ids, status as TicketStatus, clean(body?.note, 500) || undefined);
        return ok({ updated });
      }

      // Everything you would need to rebuild the dashboard: requests and the portfolio.
      case 'backup': {
        await audit(req, 'backup-download', true);
        return ok({ app: 'system-portfolio', version: 1, exportedAt: new Date().toISOString(), tickets: await listTickets(), portfolio: await getProjects() });
      }

      // Restore ADDS what is missing (by id) and never overwrites or deletes anything that exists.
      case 'restore': {
        const data = body?.data;
        if (!data || data.app !== 'system-portfolio' || data.version !== 1) return bad('This is not a backup file from this dashboard.');
        const rawTickets: unknown[] = Array.isArray(data.tickets) ? data.tickets.slice(0, 5000) : [];
        const tickets = rawTickets.map(cleanImportedTicket).filter((t): t is Ticket => !!t);
        const tRes = await importTickets(tickets);
        let pAdded = 0;
        const rawProjects: unknown[] = Array.isArray(data.portfolio) ? data.portfolio.slice(0, 200) : [];
        if (rawProjects.length) {
          const items = [...(await getProjects())];
          const have = new Set(items.map((p) => p.id));
          for (const raw of rawProjects) {
            const id = clean((raw as any)?.id, 20);
            if (!id || have.has(id)) continue;
            const c = cleanProject(raw, id);
            if (typeof c === 'string') continue;
            items.push(c);
            have.add(id);
            pAdded++;
          }
          if (pAdded) { await saveProjects(items); revalidatePath('/', 'layout'); }
        }
        await audit(req, `restore:${tRes.added}t/${pAdded}p`, true);
        return ok({ tickets: { ...tRes, invalid: rawTickets.length - tickets.length }, projects: { added: pAdded } });
      }

      case 'projects':
        return ok({ projects: await getProjects() });

      case 'project.save': {
        const items = [...(await getProjects())];
        const incomingId = clean(body?.project?.id, 20);
        const nextId = String(Math.max(0, ...items.map((p) => parseInt(p.id, 10) || 0)) + 1).padStart(2, '0');
        const id = incomingId || nextId;
        const proj = cleanProject(body?.project, id);
        if (typeof proj === 'string') return bad(proj);
        const i = items.findIndex((p) => p.id === id);
        if (i >= 0) items[i] = proj; else items.push(proj);
        await saveProjects(items);
        revalidatePath('/', 'layout');
        return ok({ projects: items });
      }

      case 'project.delete': {
        const id = clean(body?.id, 20);
        const items = (await getProjects()).filter((p) => p.id !== id);
        if (!items.length) return bad('Keep at least one project (an empty list restores the defaults).');
        await saveProjects(items);
        revalidatePath('/', 'layout');
        return ok({ projects: items });
      }

      case 'project.move': {
        const items = [...(await getProjects())];
        const i = items.findIndex((p) => p.id === clean(body?.id, 20));
        const j = i + (body?.dir === 'up' ? -1 : 1);
        if (i < 0 || j < 0 || j >= items.length) return ok({ projects: items });
        [items[i], items[j]] = [items[j], items[i]];
        await saveProjects(items);
        revalidatePath('/', 'layout');
        return ok({ projects: items });
      }

      case 'clearAudit':
        await clearAudit(req);
        return ok({ audit: (await readAudit()).slice(0, 15) });

      case 'logoutAll':
        await logoutEverywhere();
        await audit(req, 'logout-all', true);
        return ok();

      /* ───── website templates ───── */
      case 'templates.list':
        return ok({ templates: (await getTemplates()).map((t) => ({ ...t, config: undefined })), rates: await getRates() });

      case 'template.get': {
        const t = (await getTemplates()).find((x) => x.id === clean(body?.id, 30));
        return t ? ok({ template: t }) : bad('Template not found.', 404);
      }

      case 'template.save': {
        const items = [...(await getTemplates())];
        const id = clean(body?.id, 30);
        const t = items.find((x) => x.id === id);
        if (!t) return bad('Template not found.', 404);
        t.name = clean(body?.name, 60) || t.name;
        t.description = clean(body?.description, 240);
        t.category = TEMPLATE_CATEGORIES.some((c) => c.id === body?.category) ? body.category : t.category;
        t.tag = clean(body?.tag, 16) || undefined;
        t.enabled = !!body?.enabled;
        const blank = (v: unknown) => v === null || v === '' || v === undefined;
        t.priceUGX = blank(body?.priceUGX) ? null : (num(body.priceUGX) ?? null);      // fixed UGX override (0 = free)
        t.priceUSD = blank(body?.priceUSD) ? null : (num(body.priceUSD, 10000) ?? null); // market reference in US$
        await saveTemplates(items);
        return ok({ templates: items.map((x) => ({ ...x, config: undefined })) });
      }

      case 'template.saveConfig': {
        const items = [...(await getTemplates())];
        const t = items.find((x) => x.id === clean(body?.id, 30));
        if (!t) return bad('Template not found.', 404);
        t.config = sanitizeConfig(body?.config, { assetIds: new Set() }); // templates use image URLs only
        await saveTemplates(items);
        return ok();
      }

      case 'template.duplicate': {
        const items = [...(await getTemplates())];
        const t = items.find((x) => x.id === clean(body?.id, 30));
        if (!t) return bad('Template not found.', 404);
        const copy: TemplateDef = { ...JSON.parse(JSON.stringify(t)), id: 'tpl' + Math.random().toString(36).slice(2, 8), name: t.name + ' (copy)', priceUGX: null, enabled: false };
        items.push(copy);
        await saveTemplates(items);
        return ok({ templates: items.map((x) => ({ ...x, config: undefined })) });
      }

      case 'template.delete': {
        const items = (await getTemplates()).filter((x) => x.id !== clean(body?.id, 30));
        if (!items.length) return bad('Keep at least one template.');
        await saveTemplates(items);
        return ok({ templates: items.map((x) => ({ ...x, config: undefined })) });
      }

      /* ───── customers' website projects ───── */
      case 'sites.list':
        return ok({ sites: await listProjects() });

      case 'site.get': {
        const p = await loadProject(clean(body?.id, 12).toUpperCase());
        if (!p) return bad('Project not found.', 404);
        return ok({ id: p.id, name: p.name, config: p.order?.snapshot ?? p.config, assets: await assetDataUrls(p) });
      }

      case 'site.delete':
        await deleteProject(clean(body?.id, 12).toUpperCase());
        return ok();

      case 'stats': {
        const s = await readStats();
        const days = Object.keys(s.days).sort().slice(-14);
        const total = (k: 'views' | 'events') => {
          const out: Record<string, number> = {};
          for (const d of Object.values(s.days)) for (const [n, c] of Object.entries(d[k])) out[n] = (out[n] || 0) + c;
          return out;
        };
        const tickets = await listTickets();
        const byStatus: Record<string, number> = {};
        tickets.forEach((t) => (byStatus[t.status] = (byStatus[t.status] || 0) + 1));
        return ok({
          daily: days.map((d) => ({ day: d, views: Object.values(s.days[d].views).reduce((a, b) => a + b, 0) })),
          pages: total('views'), events: total('events'), byStatus,
          unanswered: Object.entries(s.unanswered).sort((a, b) => b[1].n - a[1].n).slice(0, 25).map(([q, v]) => ({ q, ...v })),
          audit: (await readAudit()).slice(0, 15),
          errors: Object.values(s.errors).sort((a, b) => b.last.localeCompare(a.last)).slice(0, 25),
        });
      }

      default:
        return bad('Unknown action.');
    }
  } catch (e) {
    await reportServerError(`admin:${action}`, e);
    return bad('Server error — check the server logs. (If you deploy on a read-only host, the file store cannot save.)', 500);
  }
}
