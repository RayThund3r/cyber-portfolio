// src/lib/admin/health.ts — environment checklist, store check, and a tiny SEO / uptime audit of the site's own pages.
import { adminEnv } from './auth';
import { getStore, storeConfigured } from './store';

export interface EnvCheck { name: string; set: boolean; required: boolean; purpose: string; hint: string }
export function envChecklist(): EnvCheck[] {
  const e = adminEnv();
  return [
    { name: 'ADMIN_PASSWORD', set: e.password.length >= 10, required: true, purpose: 'Turns the admin area on (10+ characters).', hint: 'Vercel → Settings → Environment Variables' },
    { name: 'RESEND_API_KEY', set: !!process.env.RESEND_API_KEY, required: true, purpose: 'Sends contact-form, request and chat hand-off emails.', hint: 'Free key at resend.com' },
    { name: 'CONTACT_TO', set: !!(process.env.CONTACT_TO || process.env.CONTACT_TO_EMAIL), required: false, purpose: 'Where owner emails go (a default is used if empty).', hint: 'Your inbox address' },
    { name: 'UPSTASH_REDIS_REST_URL / KV_REST_API_URL', set: storeConfigured(), required: false, purpose: 'Keeps analytics, settings and the board permanent on serverless hosting.', hint: 'Vercel → Storage → Upstash Redis (free plan)' },
    { name: 'ADMIN_TOTP_SECRET', set: !!e.totp, required: false, purpose: 'Two-factor codes (Google Authenticator, Authy…).', hint: 'Generate one under Security' },
    { name: 'ADMIN_SESSION_SECRET', set: e.secret.length >= 16, required: false, purpose: 'Separate cookie-signing secret (16+ characters).', hint: 'Any long random string' },
    { name: 'ADMIN_ALLOWED_IPS', set: !!process.env.ADMIN_ALLOWED_IPS, required: false, purpose: 'Only these IPs can reach the admin.', hint: 'Comma-separated list; skip if your IP changes' },
    { name: 'ADMIN_WEBHOOK_URL / ADMIN_NTFY_TOPIC', set: !!(e.webhook || e.ntfy), required: false, purpose: 'Phone/Discord/Slack alerts for new requests and failed logins.', hint: 'Discord webhook URL, or a private ntfy.sh topic name' },
  ];
}

export async function storeCheck(): Promise<{ mode: string; ok: boolean; ms: number; error?: string }> {
  const t = Date.now();
  try {
    const s = getStore();
    await s.cmd('SET', 'health:ping', String(t), 'EX', 60);
    const v = await s.cmd<string | null>('GET', 'health:ping');
    return { mode: s.mode, ok: v === String(t), ms: Date.now() - t };
  } catch (e) {
    return { mode: storeConfigured() ? 'upstash' : 'memory', ok: false, ms: Date.now() - t, error: e instanceof Error ? e.message : 'failed' };
  }
}

export interface PageAudit {
  path: string; status: number; ms: number; bytes: number; score: number;
  title: string; description: string; h1: number; imgs: number; imgsNoAlt: number; lang: string; viewport: boolean; canonical: boolean; og: boolean; noindex: boolean;
  issues: string[]; error?: string;
}

const attr = (tag: string, name: string) => new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i').exec(tag)?.[2] ?? new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i').exec(tag)?.[3] ?? '';
const decode = (s: string) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

export function auditHtml(path: string, html: string, status: number, ms: number): PageAudit {
  const title = decode(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]?.trim() ?? '');
  const metas = html.match(/<meta\b[^>]*>/gi) || [];
  const meta = (key: string, by: 'name' | 'property' = 'name') => { for (const m of metas) if (attr(m, by).toLowerCase() === key) return decode(attr(m, 'content')); return ''; };
  const description = meta('description');
  const imgs = html.match(/<img\b[^>]*>/gi) || [];
  const imgsNoAlt = imgs.filter((i) => !/\balt\s*=/.test(i)).length;
  const h1 = (html.match(/<h1\b/gi) || []).length;
  const lang = /<html\b[^>]*\blang\s*=\s*["']?([A-Za-z-]+)/i.exec(html)?.[1] ?? '';
  const viewport = !!meta('viewport');
  const canonical = /<link\b[^>]*rel\s*=\s*["']canonical["']/i.test(html);
  const og = !!meta('og:title', 'property');
  const noindex = /noindex/i.test(meta('robots'));
  const issues: string[] = [];
  let score = 100;
  const bad = (cond: boolean, pts: number, msg: string) => { if (cond) { score -= pts; issues.push(msg); } };
  bad(status >= 400 || status === 0, 60, `Returned HTTP ${status || 'no response'}`);
  bad(!title, 15, 'Missing <title>');
  bad(!!title && (title.length < 15 || title.length > 70), 5, `Title is ${title.length} characters (15–70 reads best in search results)`);
  bad(!description, 12, 'Missing meta description');
  bad(!!description && (description.length < 50 || description.length > 170), 4, `Description is ${description.length} characters (50–170 is ideal)`);
  bad(h1 === 0, 8, 'No <h1> heading');
  bad(h1 > 1, 4, `${h1} <h1> headings (one is clearer)`);
  bad(imgsNoAlt > 0, Math.min(10, imgsNoAlt * 3), `${imgsNoAlt} image(s) without alt text`);
  bad(!lang, 5, 'No lang attribute on <html>');
  bad(!viewport, 8, 'No responsive viewport meta tag');
  bad(!canonical, 2, 'No canonical link');
  bad(!og, 3, 'No Open Graph tags (link previews will be plain)');
  bad(noindex, 0, 'Page is marked noindex');
  bad(ms > 1800, 6, `Slow response (${ms} ms)`);
  return { path, status, ms, bytes: html.length, score: Math.max(0, score), title, description, h1, imgs: imgs.length, imgsNoAlt, lang, viewport, canonical, og, noindex, issues };
}

export async function auditPaths(origin: string, paths: string[], cookie?: string): Promise<PageAudit[]> {
  const run = async (path: string): Promise<PageAudit> => {
    const t = Date.now();
    try {
      const res = await fetch(origin + path, { headers: { 'user-agent': 'SYS-Admin-Audit/1.0', accept: 'text/html', ...(cookie ? { cookie } : {}) }, redirect: 'follow', signal: AbortSignal.timeout(8000), cache: 'no-store' });
      const html = (await res.text()).slice(0, 600_000);
      return auditHtml(path, html, res.status, Date.now() - t);
    } catch (e) {
      return { ...auditHtml(path, '', 0, Date.now() - t), error: e instanceof Error ? e.message : 'failed' };
    }
  };
  const out: PageAudit[] = [];
  for (let i = 0; i < paths.length; i += 4) out.push(...(await Promise.all(paths.slice(i, i + 4).map(run))));
  return out;
}
