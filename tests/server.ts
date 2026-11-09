import http from 'node:http';
import fs from 'node:fs';
import { POST as BUILDER } from '@/app/api/builder/route';
import { GET as TEMPLATES } from '@/app/api/builder/templates/route';
const HTML = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
.hidden{display:none}.flex{display:flex}.grid{display:grid}@media(min-width:1024px){.lg\\:flex{display:flex}.lg\\:hidden{display:none}.lg\\:block{display:block}}@media(min-width:640px){.sm\\:flex-row{flex-direction:row}}
html,body{margin:0;background:#09090b;color:#f4f4f5;font-family:system-ui}.h-dvh{height:100dvh}.flex-col{flex-direction:column}.overflow-y-auto{overflow-y:auto}.min-h-0{min-height:0}iframe{background:#fff}
.fixed{position:fixed}.inset-0{inset:0}.absolute{position:absolute}
</style></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>`;
const toWeb = async (req: http.IncomingMessage, port: number) => {
  const chunks: Buffer[] = []; for await (const c of req) chunks.push(c as Buffer);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  return new Request(`http://localhost:${port}${req.url}`, { method: req.method, headers: req.headers as any, body: req.method === 'GET' ? undefined : body });
};
const srv = http.createServer(async (req, res) => {
  const port = (srv.address() as any).port; const url = req.url || '/';
  try {
    if (url === '/bundle.js') { res.writeHead(200, { 'content-type': 'text/javascript' }); return res.end(fs.readFileSync('/tmp/harness_bundle.js')); }
    if (url.startsWith('/api/builder/templates')) { const r: any = await (TEMPLATES as any)(); res.writeHead(r.status, { 'content-type': 'application/json' }); return res.end(await r.text()); }
    if (url.startsWith('/api/builder')) { const r: any = await (BUILDER as any)(await toWeb(req, port)); res.writeHead(r.status, { 'content-type': 'application/json' }); return res.end(await r.text()); }
    if (url.startsWith('/api/ev')) { res.writeHead(204); return res.end(); }
    res.writeHead(200, { 'content-type': 'text/html' }); res.end(HTML);
  } catch (e: any) { res.writeHead(500); res.end(String(e?.stack || e)); }
});
srv.listen(Number(process.env.PORT || 4010), () => console.log('harness on', (srv.address() as any).port));
