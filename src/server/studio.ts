// src/server/studio.ts — storage and rendering for Studio sites (admin only; public demos are rendered from here).
import 'server-only';
import crypto from 'crypto';
import { listNames, readJson, removeJson, update } from './store';
import { makeZip } from './zip';
import { buildStudioSite, referencedAssetIds, siteCsp } from '@/lib/studio/generate';
import { parseEngineSite } from '@/lib/studio/import';
import { presetData, sanitizeStudio, type StudioData } from '@/lib/studio/schema';
import { PRESETS } from '@/lib/studio/presets';

export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;
const sname = (slug: string) => `studio/${slug}`;
const MAX_ASSET_BYTES = 600 * 1024, MAX_ASSETS = 80, MAX_TOTAL_BYTES = 20 * 1024 * 1024, MAX_PROJECTS = 60;
const MIME_EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
const EXT_MIME: Record<string, string> = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };

export interface StudioProject {
  slug: string; name: string; preset: string; data: StudioData;
  assets: Record<string, { mime: string; data: string }>;
  published: boolean; portfolioId?: string; createdAt: string; updatedAt: string;
}
export type StudioResult<T> = T | { error: string; status: number };
export const isError = (v: unknown): v is { error: string; status: number } => !!v && typeof v === 'object' && 'error' in (v as object);

function magicOk(mime: string, b: Buffer): boolean {
  if (mime === 'image/jpeg') return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  if (mime === 'image/png') return b.subarray(0, 4).toString('hex') === '89504e47';
  if (mime === 'image/gif') return b.subarray(0, 3).toString() === 'GIF';
  if (mime === 'image/webp') return b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP';
  return false;
}

const slugify = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32) || 'site';
/** 12 characters from an alphabet without look-alikes (about 58 bits): strong even if someone obtains the site's hash. */
const randPass = () => { const A = 'abcdefghjkmnpqrstuvwxyz23456789'; return Array.from(crypto.randomBytes(12), (b) => A[b % A.length]).join(''); };

export const loadStudio = (slug: string) => (SLUG_RE.test(slug) ? readJson<StudioProject | null>(sname(slug), null) : Promise.resolve(null));

async function uniqueSlug(base: string): Promise<string> {
  const taken = new Set(await listNames('studio'));
  let slug = slugify(base); if (slug.length < 3) slug = `${slug}-site`;
  for (let i = 2; taken.has(slug); i++) slug = `${slugify(base).slice(0, 28)}-${i}`;
  return slug;
}

export async function listStudio() {
  const out = [];
  for (const n of await listNames('studio')) {
    const p = await loadStudio(n);
    if (!p) continue;
    out.push({
      slug: p.slug, name: p.name, preset: p.preset, mode: p.data.mode, published: p.published, portfolioId: p.portfolioId ?? null,
      products: (p.data.products || []).length, updatedAt: p.updatedAt, createdAt: p.createdAt,
      kb: Math.round(Object.values<{ data: string }>(p.assets).reduce((a, x) => a + x.data.length * 0.75, 0) / 1024),
    });
  }
  return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

async function persist(p: StudioProject) { await update<StudioProject | null>(sname(p.slug), null, () => p); return p; }

export async function createStudio(input: { name?: string; preset?: string; data?: StudioData }): Promise<StudioResult<StudioProject>> {
  if ((await listNames('studio')).length >= MAX_PROJECTS) return { error: `You can have up to ${MAX_PROJECTS} sites.`, status: 409 };
  const preset = input.preset && PRESETS[input.preset] ? input.preset : 'rose';
  const name = String(input.name || PRESETS[preset].label).replace(/[\r\n\t]+/g, ' ').trim().slice(0, 60) || 'My site';
  const slug = await uniqueSlug(name);
  let data: StudioData;
  try { data = sanitizeStudio(input.data ?? { ...presetData(preset), name }); } catch (e: any) { return { error: e.message, status: 400 }; }
  data.key = slug; if (!data.pass) data.pass = randPass(); if (!input.data) data.name = name;
  const now = new Date().toISOString();
  return persist({ slug, name, preset, data, assets: {}, published: false, createdAt: now, updatedAt: now });
}

export async function importStudio(html: string, name?: string): Promise<StudioResult<{ project: StudioProject; warnings: string[] }>> {
  if (typeof html !== 'string' || html.length > 3_000_000) return { error: 'That file is too large.', status: 413 };
  let r;
  try { r = parseEngineSite(html); } catch (e: any) { return { error: e.message, status: 400 }; }
  const p = await createStudio({ name: name || r.name, preset: 'fresh', data: r.data });
  return isError(p) ? p : { project: p, warnings: r.warnings };
}

export async function saveStudio(slug: string, input: { data: unknown; name?: string }): Promise<StudioResult<StudioProject>> {
  const cur = await loadStudio(slug);
  if (!cur) return { error: 'Site not found.', status: 404 };
  let data: StudioData;
  try { data = sanitizeStudio(input.data, { assetIds: new Set(Object.keys(cur.assets)) }); } catch (e: any) { return { error: e.message, status: 400 }; }
  data.key = cur.slug;
  // a weak passcode is never accepted silently: keep the stored one and tell the caller
  let passKept = false;
  if (data.pass && data.pass.length < 8) { data.pass = cur.data.pass; passKept = true; }
  if (!data.pass) data.pass = cur.data.pass;
  const name = typeof input.name === 'string' ? input.name.replace(/[\r\n\t]+/g, ' ').trim().slice(0, 60) : cur.name;
  const next = await update<StudioProject | null>(sname(slug), null, (d) => {
    if (d) { d.data = data; d.name = name || d.name; d.updatedAt = new Date().toISOString(); }
  });
  return { ...(next as StudioProject), passKept } as StudioProject & { passKept: boolean };
}

export async function addStudioAsset(slug: string, mime: string, base64: string): Promise<StudioResult<{ id: string }>> {
  const p = await loadStudio(slug);
  if (!p) return { error: 'Site not found.', status: 404 };
  if (!MIME_EXT[mime]) return { error: 'Only JPG, PNG, WebP or GIF pictures are allowed.', status: 400 };
  if (typeof base64 !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) return { error: 'Invalid picture data.', status: 400 };
  const buf = Buffer.from(base64, 'base64');
  if (buf.length > MAX_ASSET_BYTES) return { error: 'That picture is too large (max 600 KB after compression).', status: 413 };
  if (!magicOk(mime, buf)) return { error: 'That file is not a valid picture.', status: 400 };
  const total = Object.values<{ data: string }>(p.assets).reduce((n, a) => n + a.data.length * 0.75, 0);
  if (Object.keys(p.assets).length >= MAX_ASSETS || total + buf.length > MAX_TOTAL_BYTES) return { error: 'Picture storage for this site is full. Remove unused pictures first.', status: 413 };
  const id = crypto.randomBytes(8).toString('hex').replace(/[a-f]/g, (c) => 'ghijkl'['abcdef'.indexOf(c)]).slice(0, 8);
  await update<StudioProject | null>(sname(slug), null, (d) => { if (d) { d.assets[id] = { mime, data: base64 }; d.updatedAt = new Date().toISOString(); } });
  return { id };
}

export const assetDataUrls = (p: StudioProject) => Object.fromEntries(Object.entries(p.assets).map(([k, a]) => [k, `data:${a.mime};base64,${a.data}`]));

export async function deleteStudio(slug: string) { if (SLUG_RE.test(slug)) await removeJson(sname(slug)); }

export async function duplicateStudio(slug: string): Promise<StudioResult<StudioProject>> {
  const src = await loadStudio(slug);
  if (!src) return { error: 'Site not found.', status: 404 };
  if ((await listNames('studio')).length >= MAX_PROJECTS) return { error: `You can have up to ${MAX_PROJECTS} sites.`, status: 409 };
  const name = `${src.name} copy`.slice(0, 60), ns = await uniqueSlug(name), now = new Date().toISOString();
  return persist({ ...JSON.parse(JSON.stringify(src)), slug: ns, name, data: { ...src.data, key: ns, pass: randPass() }, published: false, portfolioId: undefined, createdAt: now, updatedAt: now });
}

export async function patchStudio(slug: string, fn: (p: StudioProject) => void): Promise<StudioResult<StudioProject>> {
  const next = await update<StudioProject | null>(sname(slug), null, (d) => { if (d) { fn(d); d.updatedAt = new Date().toISOString(); } });
  return next ? next : { error: 'Site not found.', status: 404 };
}

/* ───────── rendering ───────── */
export const assetFileName = (p: StudioProject, id: string) => `${id}.${MIME_EXT[p.assets[id]?.mime] || 'jpg'}`;

/** The file you hand to the customer: index.html + an assets/ folder. */
export function renderExport(p: StudioProject) {
  const used = new Set(referencedAssetIds(p.data));
  const html = buildStudioSite(p.data, { assetUrl: (id) => (p.assets[id] ? `assets/${assetFileName(p, id)}` : ''), cspMeta: true });
  const files = [{ name: 'index.html', data: Buffer.from(html, 'utf8') }];
  for (const id of used) if (p.assets[id]) files.push({ name: `assets/${assetFileName(p, id)}`, data: Buffer.from(p.assets[id].data, 'base64'), store: true } as any);
  const readme = [
    `${p.data.name} — website`, '', 'HOW TO PUBLISH', '1. Upload everything in this folder (index.html and the assets folder) to any web host (Netlify, Cloudflare Pages, GitHub Pages, cPanel, ...).',
    '2. Open the website. Add #admin to the address (https://yoursite.com/#admin) to reach the owner admin page.', `3. Owner passcode: ${p.data.pass} (change it after the first sign-in).`, '',
    'GOOD TO KNOW', '- Orders, bookings and enquiries are sent to your WhatsApp number as messages.',
    '- Without a cloud database URL, the admin page only shows what happened in the browser you are using. Add your own Firebase Realtime Database URL in the studio (Advanced) to collect everything in one place.',
    '- Keep this passcode private.', '',
  ].join('\n');
  files.push({ name: 'README.txt', data: Buffer.from(readme, 'utf8') });
  return files;
}
export const renderZip = (p: StudioProject) => makeZip(renderExport(p));

/** The public live demo: no cloud database, the real passcode is never exposed. */
export function renderDemo(p: StudioProject): string {
  return buildStudioSite(p.data, {
    assetUrl: (id) => (p.assets[id] ? `/demo/${p.slug}/assets/${assetFileName(p, id)}` : ''),
    demo: { slug: p.slug, adminPass: p.data.demoAdmin ? 'demo1234' : null },
  });
}

export function demoAsset(p: StudioProject, file: string): { mime: string; body: Buffer } | null {
  const m = /^([a-z0-9]{8})\.(jpg|png|webp|gif)$/.exec(file);
  const a = m && p.assets[m[1]];
  return a && EXT_MIME[m![2]] === a.mime ? { mime: a.mime, body: Buffer.from(a.data, 'base64') } : null;
}

/* ───────── backup / restore of a whole site (settings + pictures) ───────── */
export function backupStudio(p: StudioProject) {
  return { app: 'system-portfolio-studio', version: 1, exportedAt: new Date().toISOString(), name: p.name, preset: p.preset, data: p.data, assets: p.assets };
}

/** Re-creates a site from a backup file. Everything is re-validated; nothing is trusted. */
export async function restoreStudio(b: any): Promise<StudioResult<StudioProject>> {
  if (!b || b.app !== 'system-portfolio-studio' || b.version !== 1) return { error: 'This is not a Studio backup file.', status: 400 };
  const assets: StudioProject['assets'] = {};
  let total = 0;
  for (const [id, a] of Object.entries<any>(b.assets && typeof b.assets === 'object' ? b.assets : {})) {
    if (!/^[a-z0-9]{8}$/.test(id) || !MIME_EXT[a?.mime] || typeof a?.data !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(a.data)) continue;
    const buf = Buffer.from(a.data, 'base64');
    total += buf.length;
    if (buf.length > MAX_ASSET_BYTES || !magicOk(a.mime, buf) || Object.keys(assets).length >= MAX_ASSETS || total > MAX_TOTAL_BYTES) continue;
    assets[id] = { mime: a.mime, data: a.data };
  }
  const made = await createStudio({ name: String(b.name || 'Restored site'), preset: typeof b.preset === 'string' ? b.preset : 'rose', data: b.data });
  if (isError(made)) return made;
  return patchStudio(made.slug, (d) => { d.assets = assets; });
}

/** Header for the live demo (the page itself carries no meta policy, the header is stronger and adds frame rules). */
export const DEMO_CSP = siteCsp({ extra: ["frame-ancestors 'self'"] });
