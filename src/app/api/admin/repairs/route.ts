import { admin, fail } from '@/lib/admin/api';
import { deleteRepair, listRepairs, moveRepair, saveRepair } from '@/server/repairs';
import { publishChange } from '@/server/liveVersion';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const GET = admin(async () => ({ items: await listRepairs() }));
// Two shrunk pictures (about 350 KB each) travel in one request.
export const POST = admin(async ({ body }) => {
  const action = String(body.action || '');
  let items;
  if (action === 'save') items = await saveRepair({ item: body.item, before: body.before, after: body.after, w: body.w, h: body.h });
  else if (action === 'delete') items = await deleteRepair(String(body.id || ''));
  else if (action === 'move') items = await moveRepair(String(body.id || ''), body.dir === 'up' ? 'up' : 'down');
  else return fail(400, 'Unknown action.');
  await publishChange('/services');
  return { items };
}, true, 1_100_000);
