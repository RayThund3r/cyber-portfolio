import { admin, fail } from '@/lib/admin/api';
import { deleteArt, listArt, moveArt, saveArt } from '@/server/art';
import { publishChange } from '@/server/liveVersion';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const GET = admin(async () => ({ items: await listArt() }));
// Pictures arrive already shrunk by the browser (about 300 KB + a small thumbnail), so the body limit is 900 KB.
export const POST = admin(async ({ body }) => {
  const action = String(body.action || '');
  let items;
  if (action === 'save') items = await saveArt({ item: body.item, image: body.image, thumb: body.thumb, w: body.w, h: body.h, color: body.color, tone: body.tone });
  else if (action === 'delete') items = await deleteArt(String(body.id || ''));
  else if (action === 'move') items = await moveArt(String(body.id || ''), body.dir === 'up' ? 'up' : 'down');
  else return fail(400, 'Unknown action.');
  await publishChange('/art');
  return { items };
}, true, 900_000);
