// src/app/api/studio/route.ts — Studio (website designer) API. Admin only.
//   POST { action: list | create | import | restore | get | save | upload | delete | duplicate | publish | portfolio }
//   GET  ?download=<slug>  → the finished website as a .zip
//   GET  ?backup=<slug>    → everything needed to restore the site later (settings + pictures)
import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { audit, ipAllowed, isAdmin } from '@/server/auth';
import { readJsonLimited, sameOrigin } from '@/server/util';
import { getProjects, saveProjects } from '@/server/store';
import {
  addStudioAsset, assetDataUrls, backupStudio, restoreStudio, createStudio, deleteStudio, duplicateStudio, importStudio, isError, listStudio, loadStudio, patchStudio, renderZip, saveStudio,
} from '@/server/studio';
import { PRESETS } from '@/lib/studio/presets';
import type { ProjectItem } from '@/data/portfolioData';

export const runtime = 'nodejs';
const ok = (data: unknown = {}) => NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
const bad = (error: string, status = 400) => NextResponse.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } });
const fail = (e: { error: string; status: number }) => bad(e.error, e.status);

const summary = (p: NonNullable<Awaited<ReturnType<typeof loadStudio>>>) => ({
  slug: p.slug, name: p.name, preset: p.preset, data: p.data, assets: assetDataUrls(p), published: p.published, portfolioId: p.portfolioId ?? null, updatedAt: p.updatedAt,
});

export async function GET(req: Request) {
  if (!ipAllowed(req) || !(await isAdmin())) return bad('Not found.', 404);
  const q = new URL(req.url).searchParams;
  const backup = q.get('backup');
  if (backup) {
    const bp = await loadStudio(backup);
    if (!bp) return bad('Site not found.', 404);
    await audit(req, `studio-backup:${bp.slug}`, true);
    return new Response(JSON.stringify(backupStudio(bp)), { headers: { 'Content-Type': 'application/json', 'Content-Disposition': `attachment; filename="${bp.slug}-studio-backup.json"`, 'Cache-Control': 'no-store' } });
  }
  const slug = q.get('download') || '';
  const p = await loadStudio(slug);
  if (!p) return bad('Site not found.', 404);
  await audit(req, `studio-download:${p.slug}`, true);
  const zip = renderZip(p);
  return new Response(new Uint8Array(zip), { headers: { 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="${p.slug}-website.zip"`, 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  if (!sameOrigin(req)) return bad('Request blocked.', 403);
  if (!ipAllowed(req) || !(await isAdmin())) return bad('Please sign in again.', 401);
  const parsed = await readJsonLimited(req, 32_000_000); // admin only; a backup with many pictures can be large
  if (!parsed.ok) return bad(parsed.error, parsed.status);
  const body: any = parsed.body;
  const action = String(body?.action || '');
  const slug = String(body?.slug || '');

  try {
    switch (action) {
      case 'list':
        return ok({ sites: await listStudio(), presets: Object.entries(PRESETS).map(([id, p]) => ({ id, label: p.label, desc: p.desc })) });

      case 'create': {
        const r = await createStudio({ name: body?.name, preset: body?.preset });
        return isError(r) ? fail(r) : ok({ slug: r.slug });
      }
      case 'restore': {
        const r = await restoreStudio(body?.backup);
        return isError(r) ? fail(r) : ok({ slug: r.slug });
      }
      case 'import': {
        const r = await importStudio(String(body?.html || ''), typeof body?.name === 'string' ? body.name : undefined);
        return isError(r) ? fail(r) : ok({ slug: r.project.slug, warnings: r.warnings });
      }
      case 'get': {
        const p = await loadStudio(slug);
        return p ? ok(summary(p)) : bad('Site not found.', 404);
      }
      case 'save': {
        const r = await saveStudio(slug, { data: body?.data, name: body?.name });
        return isError(r) ? fail(r) : ok({ updatedAt: r.updatedAt, passKept: !!(r as any).passKept });
      }
      case 'upload': {
        const r = await addStudioAsset(slug, String(body?.mime || ''), String(body?.data || ''));
        return isError(r) ? fail(r) : ok(r);
      }
      case 'duplicate': {
        const r = await duplicateStudio(slug);
        return isError(r) ? fail(r) : ok({ slug: r.slug });
      }
      case 'delete': {
        await audit(req, `studio-delete:${slug}`, true);
        await deleteStudio(slug);
        return ok();
      }
      case 'publish': {
        const r = await patchStudio(slug, (d) => { d.published = !!body?.published; });
        return isError(r) ? fail(r) : ok({ published: r.published });
      }
      // One click: put the live site in the portfolio, with a link to the working demo.
      case 'portfolio': {
        const p = await loadStudio(slug);
        if (!p) return bad('Site not found.', 404);
        if (!p.published) return bad('Publish the live demo first, then add it to your portfolio.');
        const pics = [...(p.data.slides || []), ...(p.data.gallery || []), ...(p.data.products || [])].map((x: any) => String(x.u || ''))
          .map((u) => (/^asset:([a-z0-9]{8})$/.test(u) && p.assets[u.slice(6)] ? `/demo/${p.slug}/assets/${u.slice(6)}.${p.assets[u.slice(6)].mime.split('/')[1].replace('jpeg', 'jpg')}` : u))
          .filter((u) => u.startsWith('/') || /^https:\/\/[^\s]+$/.test(u));
        if (!pics.length) return bad('Add at least one picture (a hero slide, product or gallery photo) so the portfolio has an image.');
        const items = [...(await getProjects())];
        const entry = (id: string): ProjectItem => ({
          id, title: p.name, category: 'WEBAPP', image: pics[0], gallery: pics.slice(0, 6),
          description: `${p.data.tag ? p.data.tag + '. ' : ''}A complete responsive website with a ${p.data.mode === 'quote' ? 'quote-request flow' : 'booking system'}, product catalogue, cart with WhatsApp ordering, light and dark modes, three languages and an owner admin panel. Try the live demo.`.slice(0, 600),
          tools: ['Site Studio', 'Responsive', 'Light & dark', 'WhatsApp orders'], clientType: 'Business website', liveUrl: `/demo/${p.slug}`,
        });
        const existing = p.portfolioId ? items.findIndex((i) => i.id === p.portfolioId) : -1;
        if (existing >= 0) { items[existing] = { ...entry(items[existing].id), featured: items[existing].featured, metrics: items[existing].metrics }; }
        else {
          const next = String(Math.max(0, ...items.map((i) => parseInt(i.id, 10) || 0)) + 1).padStart(2, '0');
          items.push(entry(next)); await patchStudio(slug, (d) => { d.portfolioId = next; });
        }
        await saveProjects(items);
        revalidatePath('/', 'layout');
        return ok({ updated: existing >= 0 });
      }
      default:
        return bad('Unknown action.');
    }
  } catch (e: any) {
    return bad('Something went wrong. Please try again.', 500);
  }
}
