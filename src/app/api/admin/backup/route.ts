import { admin, fail } from '@/lib/admin/api';
import { db } from '@/lib/admin/store';
import { readConfig, writeConfig } from '@/lib/admin/siteconfig';
import { jsonResponse } from '@/lib/admin/auth';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const GET = admin(async () => {
  const dump = { kind: 'sys-portfolio-admin-backup', version: 1, at: new Date().toISOString(), config: await readConfig(), board: await db.getJSON('admin:board', []), questions: await db.list('s:q', 500) };
  return jsonResponse(dump, 200, { 'content-disposition': `attachment; filename="sys-admin-backup-${new Date().toISOString().slice(0, 10)}.json"` });
});
export const POST = admin(async ({ body }) => {
  const d = body.data as Record<string, unknown> | undefined;
  if (!d || d.kind !== 'sys-portfolio-admin-backup') return fail(400, 'That is not a backup file from this panel.');
  if (d.config) await writeConfig(d.config);
  if (Array.isArray(d.board)) await db.setJSON('admin:board', d.board.slice(0, 300));
  return { ok: true };
}, true);
