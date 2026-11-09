// src/lib/admin/api.ts — wraps an admin route handler with the auth gate, JSON body parsing and uniform errors.
import { jsonResponse, requireAdmin, type Session } from './auth';

export interface Ctx { session: Session; req: Request; url: URL; body: Record<string, unknown> }
type Handler = (ctx: Ctx) => Promise<unknown>;

export async function readBody(req: Request, max = 400_000): Promise<Record<string, unknown>> {
  const text = await req.text();
  if (text.length > max) throw Object.assign(new Error('Request too large.'), { status: 413 });
  if (!text.trim()) return {};
  try {
    const v = JSON.parse(text);
    if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('x');
    return v as Record<string, unknown>;
  } catch { throw Object.assign(new Error('Invalid JSON body.'), { status: 400 }); }
}

export function admin(handler: Handler, mutating = false) {
  return async (req: Request): Promise<Response> => {
    const gate = await requireAdmin(req, mutating);
    if ('error' in gate) return gate.error;
    try {
      const body = mutating ? await readBody(req) : {};
      const out = await handler({ session: gate.session, req, url: new URL(req.url), body });
      return out instanceof Response ? out : jsonResponse(out ?? { ok: true }, 200);
    } catch (e) {
      const status = (e as { status?: number })?.status || 500;
      if (status === 500) console.error('admin route error:', e);
      return jsonResponse({ error: status === 500 ? 'Server error.' : (e as Error).message }, status);
    }
  };
}
export class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }
export const fail = (status: number, message: string): never => { throw new HttpError(status, message); };
