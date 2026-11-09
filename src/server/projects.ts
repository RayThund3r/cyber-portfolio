// src/server/projects.ts — customers' website projects: edit-key auth, assets, orders, zip export.
//
// Storage layout (so a save never rewrites megabytes of pictures):
//   projects/<PRJ-ID>.json            config + small asset index  (rewritten on every autosave — small)
//   assets/<PRJ-ID>/<assetId>.json    one file per picture (base64)  (written once)
import 'server-only';
import crypto from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { createTicket, findTicket, listNames, mutateTicket, readJson, removeJson, update, type Ticket } from './store';
import { getTemplates, putJson, removeTree } from './builderUtil';
import { makeZip, type ZipFile } from './zip';
import { buildSite, readmeText } from '@/lib/builder/generate';
import { referencedAssets, sanitizeConfig } from '@/lib/builder/sanitize';
import type { SiteConfig } from '@/lib/builder/schema';
import { effectiveUGX } from '@/lib/builder/pricing';
import { getRates } from './rates';
import { notifyOwner } from './mail';
import { esc } from './util';

export interface AssetMeta { mime: string; bytes: number }
export interface Asset { mime: string; data: string /* base64 */ }
export interface Project {
  id: string; keyHash: string; templateId: string; templateName: string; name: string;
  /** increments on every save — lets two open tabs detect they are overwriting each other */
  rev: number;
  config: SiteConfig; assets: Record<string, AssetMeta>;
  order?: { ticket: string; at: string; price: number; snapshot: SiteConfig };
  contact?: { name: string; email: string; phone: string };
  ai?: { day: string; n: number };
  createdAt: string; updatedAt: string;
}

const PID_RE = /^PRJ-[A-Z0-9]{6}$/;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const hash = (k: string) => crypto.createHash('sha256').update(k).digest('hex');
const rnd = (n: number, alpha: string) => Array.from(crypto.randomBytes(n), (x) => alpha[x % alpha.length]).join('');
const pname = (id: string) => `projects/${id}`;
const aname = (pid: string, aid: string) => `assets/${pid}/${aid}`;
const AID_RE = /^[a-z0-9]{8}$/;

export const MAX_ASSET_BYTES = 600 * 1024;
const MAX_ASSETS = 60;
const MAX_TOTAL_BYTES = 14 * 1024 * 1024;
export const MIME_EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };

function magicOk(mime: string, b: Buffer): boolean {
  if (mime === 'image/jpeg') return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  if (mime === 'image/png') return b.subarray(0, 4).toString('hex') === '89504e47';
  if (mime === 'image/gif') return b.subarray(0, 3).toString() === 'GIF';
  if (mime === 'image/webp') return b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP';
  return false;
}

export async function loadProject(id: string): Promise<Project | null> {
  if (!PID_RE.test(id)) return null;
  const p = await readJson<Project | null>(pname(id), null);
  if (!p) return null;
  p.rev ||= 0; p.assets ||= {};
  // One-time migration of projects saved by the previous version, which kept pictures INSIDE the project file.
  const legacy = Object.entries(p.assets).filter(([, a]) => typeof (a as any).data === 'string');
  if (legacy.length) {
    for (const [aid, a] of legacy) {
      const data = (a as any).data as string;
      await putJson(aname(p.id, aid), { mime: a.mime, data } satisfies Asset);
      p.assets[aid] = { mime: a.mime, bytes: Math.floor(data.length * 0.75) };
    }
    await putJson(pname(p.id), p);
  }
  return p;
}

/** Loads a project only if the secret edit key matches. */
export async function authProject(id: string, key: string): Promise<Project | null> {
  const p = await loadProject(String(id || '').toUpperCase());
  if (!p || typeof key !== 'string' || key.length < 16 || key.length > 64) return null;
  const a = Buffer.from(hash(key)), b = Buffer.from(p.keyHash);
  return a.length === b.length && crypto.timingSafeEqual(a, b) ? p : null;
}

async function insertProject(base: Omit<Project, 'id' | 'keyHash' | 'rev' | 'createdAt' | 'updatedAt'>): Promise<{ id: string; key: string }> {
  const id = 'PRJ-' + rnd(6, ALPHABET);
  const key = crypto.randomBytes(15).toString('base64url');
  const now = new Date().toISOString();
  await putJson(pname(id), { ...base, id, keyHash: hash(key), rev: 0, createdAt: now, updatedAt: now } satisfies Project);
  return { id, key };
}

export async function createProject(templateId: string, contact?: Project['contact']): Promise<{ id: string; key: string } | { error: string }> {
  const tpl = (await getTemplates()).find((t) => t.id === templateId && t.enabled);
  if (!tpl) return { error: 'That template is not available.' };
  if ((await listNames('projects')).length > 5000) return { error: 'The builder is temporarily full. Please contact us.' };
  const config = sanitizeConfig(JSON.parse(JSON.stringify(tpl.config)), { assetIds: new Set() });
  return insertProject({ templateId: tpl.id, templateName: tpl.name, name: `My ${tpl.name} site`, config, assets: {}, contact });
}

export const isLocked = (p: Project) => !!p.order;

/** The customer removes their own site and pictures (not allowed once an order exists: that is a record we must keep). */
export async function deleteOwnProject(id: string, key: string): Promise<{ ok: true } | { error: string; status: number }> {
  const p = await authProject(id, key);
  if (!p) return { error: 'Project not found.', status: 404 };
  if (p.order) return { error: 'This site has an order, so it cannot be deleted here. Please contact us.', status: 409 };
  await removeTree(`assets/${p.id}`);
  await removeJson(pname(p.id));
  return { ok: true };
}

export async function saveProject(
  id: string, key: string, input: { config: unknown; name?: string; baseRev?: number; force?: boolean }
): Promise<{ rev: number; updatedAt: string } | { error: string; status: number; rev?: number }> {
  const p = await authProject(id, key);
  if (!p) return { error: 'Project not found.', status: 404 };
  if (isLocked(p)) return { error: 'This site is locked because an order was placed. Unlock it to keep editing.', status: 409 };
  if (!input.force && typeof input.baseRev === 'number' && input.baseRev !== p.rev) {
    return { error: 'This project was changed in another tab or device.', status: 409, rev: p.rev };
  }
  let config: SiteConfig;
  try { config = sanitizeConfig(input.config, { assetIds: new Set(Object.keys(p.assets)) }); } catch (e: any) { return { error: e.message, status: 400 }; }
  const name = typeof input.name === 'string' ? input.name.replace(/[\r\n\t]+/g, ' ').trim().slice(0, 60) : p.name;
  let out = { rev: 0, updatedAt: '' };
  await update<Project | null>(pname(p.id), null, (d) => {
    if (!d) return;
    d.config = config; d.name = name || d.name; d.rev = (d.rev || 0) + 1; d.updatedAt = new Date().toISOString();
    out = { rev: d.rev, updatedAt: d.updatedAt };
  });
  return out;
}

/* ───────── pictures ───────── */
export async function addAsset(id: string, key: string, mime: string, base64: string): Promise<{ id: string } | { error: string; status: number }> {
  const p = await authProject(id, key);
  if (!p) return { error: 'Project not found.', status: 404 };
  if (isLocked(p)) return { error: 'Site is locked.', status: 409 };
  if (!MIME_EXT[mime]) return { error: 'Only JPG, PNG, WebP or GIF images are allowed.', status: 400 };
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) return { error: 'Invalid image data.', status: 400 };
  const buf = Buffer.from(base64, 'base64');
  if (buf.length > MAX_ASSET_BYTES) return { error: 'That image is too large (max 600 KB after compression).', status: 413 };
  if (!magicOk(mime, buf)) return { error: 'That file is not a valid image.', status: 400 };
  const total = Object.values(p.assets).reduce((n, a) => n + a.bytes, 0);
  if (Object.keys(p.assets).length >= MAX_ASSETS || total + buf.length > MAX_TOTAL_BYTES) return { error: 'Picture storage for this project is full. Remove unused pictures first.', status: 413 };
  const aid = rnd(8, 'abcdefghijklmnopqrstuvwxyz0123456789');
  await putJson(aname(p.id, aid), { mime, data: base64 } satisfies Asset);
  await update<Project | null>(pname(p.id), null, (d) => { if (d) { d.assets[aid] = { mime, bytes: buf.length }; d.updatedAt = new Date().toISOString(); } });
  return { id: aid };
}

export async function deleteAsset(id: string, key: string, aid: string): Promise<{ ok: true } | { error: string; status: number }> {
  const p = await authProject(id, key);
  if (!p) return { error: 'Project not found.', status: 404 };
  if (isLocked(p)) return { error: 'Site is locked.', status: 409 };
  if (!AID_RE.test(aid) || !p.assets[aid]) return { error: 'Picture not found.', status: 404 };
  await removeJson(aname(p.id, aid));
  await update<Project | null>(pname(p.id), null, (d) => { if (d) delete d.assets[aid]; });
  return { ok: true };
}

export async function readAsset(pid: string, aid: string): Promise<Asset | null> {
  return AID_RE.test(aid) && PID_RE.test(pid) ? readJson<Asset | null>(aname(pid, aid), null) : null;
}
async function readAssets(p: Project, ids: Iterable<string>): Promise<Record<string, Asset>> {
  const out: Record<string, Asset> = {};
  await Promise.all([...ids].filter((i) => p.assets[i]).map(async (i) => { const a = await readAsset(p.id, i); if (a) out[i] = a; }));
  return out;
}
export async function assetDataUrls(p: Project): Promise<Record<string, string>> {
  const all = await readAssets(p, Object.keys(p.assets));
  return Object.fromEntries(Object.entries(all).map(([k, a]) => [k, `data:${a.mime};base64,${a.data}`]));
}

/** Copy of a project (pictures included) with its own private edit key. Orders are NOT copied. */
export async function duplicateProject(id: string, key: string): Promise<{ id: string; key: string } | { error: string; status: number }> {
  const p = await authProject(id, key);
  if (!p) return { error: 'Project not found.', status: 404 };
  if ((await listNames('projects')).length > 5000) return { error: 'The builder is temporarily full.', status: 503 };
  const created = await insertProject({
    templateId: p.templateId, templateName: p.templateName, name: `Copy of ${p.name}`.slice(0, 60),
    config: JSON.parse(JSON.stringify(p.order?.snapshot ?? p.config)), assets: { ...p.assets }, contact: p.contact,
  });
  await Promise.all(Object.keys(p.assets).map(async (aid) => { const a = await readAsset(p.id, aid); if (a) await putJson(aname(created.id, aid), a); }));
  return created;
}

/* ───────── ordering / payment state ───────── */
export const ticketPaid = (t?: Ticket) => !!t && t.payments.some((x) => x.status === 'CONFIRMED');

export async function orderState(p: Project): Promise<{ ticket: string; paid: boolean; cancelled: boolean; price: number } | null> {
  if (!p.order) return null;
  const t = await findTicket(p.order.ticket);
  return { ticket: p.order.ticket, paid: ticketPaid(t), cancelled: t?.status === 'CANCELLED', price: p.order.price };
}

/** The UGX price a customer would pay RIGHT NOW (market USD reference × live rate, or the owner's fixed UGX price). */
export async function priceNow(templateId: string): Promise<number | null> {
  const tpl = (await getTemplates()).find((t) => t.id === templateId);
  if (!tpl) return null;
  return effectiveUGX(tpl, (await getRates()).rates.UGX);
}

export async function placeOrder(id: string, key: string, c: { name: string; email: string; phone: string }): Promise<{ ticket: string } | { error: string; status: number }> {
  const p = await authProject(id, key);
  if (!p) return { error: 'Project not found.', status: 404 };
  if (p.order) { const st = await orderState(p); if (st && !st.cancelled) return { ticket: p.order.ticket }; }

  const price = await priceNow(p.templateId);
  if (price === null) return { error: 'This template is not for sale yet — please contact us.', status: 409 };

  const snapshot = sanitizeConfig(p.config, { assetIds: new Set(Object.keys(p.assets)) });
  const ticket = await createTicket({
    kind: 'template', projectId: p.id, name: c.name, email: c.email, phone: c.phone,
    details: `Website template order — ${p.templateName}\nProject: ${p.id}\nSite name: ${snapshot.brand.name}`,
    quoteUGX: price, depositUGX: price,
  });
  if (price === 0) {
    await mutateTicket(ticket.id, (t) => {
      t.payments.push({ id: 'free', network: 'OTHER', txId: 'FREE', status: 'CONFIRMED', at: new Date().toISOString() });
      t.status = 'COMPLETED';
      t.history.push({ at: new Date().toISOString(), status: 'COMPLETED', note: 'This template is free — your download is ready.' });
    });
  } else {
    await mutateTicket(ticket.id, (t) => {
      t.status = 'AWAITING_DEPOSIT';
      t.history.push({ at: new Date().toISOString(), status: 'AWAITING_DEPOSIT', note: 'Design confirmed. Pay with mobile money to unlock your website download.' });
    });
  }
  await update<Project | null>(pname(p.id), null, (d) => {
    if (d) { d.order = { ticket: ticket.id, at: new Date().toISOString(), price, snapshot }; d.contact = c; d.updatedAt = new Date().toISOString(); }
  });
  await notifyOwner(`[${ticket.id}] Template order: ${p.templateName}`, `<p>${esc(c.name)} confirmed their site <strong>${esc(snapshot.brand.name)}</strong> (${esc(p.id)}) — price UGX ${price}. Verify payment in /admin → Tickets; the download unlocks when you confirm it.</p>`);
  return { ticket: ticket.id };
}

export async function cancelOrder(id: string, key: string): Promise<{ ok: true } | { error: string; status: number }> {
  const p = await authProject(id, key);
  if (!p || !p.order) return { error: 'No order to cancel.', status: 404 };
  const st = await orderState(p);
  if (st?.paid) return { error: 'This order is already paid, so it cannot be unlocked.', status: 409 };
  await mutateTicket(p.order.ticket, (t) => { t.status = 'CANCELLED'; t.history.push({ at: new Date().toISOString(), status: 'CANCELLED', note: 'Order cancelled by the customer to keep editing.' }); });
  await update<Project | null>(pname(p.id), null, (d) => { if (d) { delete d.order; d.updatedAt = new Date().toISOString(); } });
  return { ok: true };
}

export async function deleteProject(id: string) {
  if (!PID_RE.test(id)) return;
  await removeTree(`assets/${id}`);
  await removeJson(pname(id));
}

export async function listProjects() {
  const out = [];
  for (const n of await listNames('projects')) {
    const p = await loadProject(n);
    if (!p) continue;
    const st = await orderState(p);
    out.push({
      id: p.id, name: p.name, template: p.templateName, siteName: p.config.brand.name, updatedAt: p.updatedAt, createdAt: p.createdAt,
      status: !st ? 'DRAFT' : st.cancelled ? 'DRAFT' : st.paid ? 'PAID' : 'AWAITING_PAYMENT',
      ticket: st && !st.cancelled ? st.ticket : null, price: p.order?.price ?? null, contact: p.contact ?? null,
      kb: Math.round(Object.values(p.assets).reduce((a, x) => a + x.bytes, 0) / 1024),
    });
  }
  return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/* ───────── zip export ───────── */
async function vendorBootstrap(): Promise<{ css: Buffer; js: Buffer } | null> {
  try {
    const dir = path.join(process.cwd(), 'public', 'vendor', 'bootstrap');
    return { css: await fs.readFile(path.join(dir, 'bootstrap.min.css')), js: await fs.readFile(path.join(dir, 'bootstrap.bundle.min.js')) };
  } catch { return null; }
}

export async function buildProjectZip(cfg: SiteConfig, p: Project): Promise<Buffer> {
  const used = [...referencedAssets(cfg)].filter((id) => p.assets[id]);
  const assets = await readAssets(p, used);
  const fileOf = (id: string) => `assets/img-${id}.${MIME_EXT[assets[id].mime]}`;
  const vendor = await vendorBootstrap();
  const site = buildSite(cfg, {
    mode: 'export',
    assetSrc: (id) => (assets[id] ? fileOf(id) : ''),
    bootstrap: vendor ? { css: 'vendor/bootstrap/bootstrap.min.css', js: 'vendor/bootstrap/bootstrap.bundle.min.js' } : undefined,
  });
  const files: ZipFile[] = [
    { name: 'index.html', data: Buffer.from(site.html) },
    { name: 'css/style.css', data: Buffer.from(site.css) },
    ...(site.customCss ? [{ name: 'css/custom.css', data: Buffer.from(site.customCss) }] : []),
    { name: 'js/script.js', data: Buffer.from(site.js) },
    ...(site.customJs ? [{ name: 'js/custom.js', data: Buffer.from(site.customJs) }] : []),
    { name: 'README.txt', data: Buffer.from(readmeText(cfg, !!vendor)) },
    ...used.filter((id) => assets[id]).map((id) => ({ name: fileOf(id), data: Buffer.from(assets[id].data, 'base64'), store: true })),
  ];
  if (vendor) files.push({ name: 'vendor/bootstrap/bootstrap.min.css', data: vendor.css }, { name: 'vendor/bootstrap/bootstrap.bundle.min.js', data: vendor.js });
  return makeZip(files);
}

/** Customer download: only for a PAID order, always from the frozen snapshot. */
export async function downloadFor(p: Project): Promise<Buffer | { error: string; status: number }> {
  const st = await orderState(p);
  if (!p.order || !st || st.cancelled) return { error: 'Confirm your design first.', status: 402 };
  if (!st.paid) return { error: 'Your payment has not been confirmed yet.', status: 402 };
  return buildProjectZip(p.order.snapshot, p);
}
