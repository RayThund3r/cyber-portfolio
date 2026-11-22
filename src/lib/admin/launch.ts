// src/lib/admin/launch.ts — "Launch Pad": what is still between this site and being fully live.
// Pure function of environment + a few flags, so it is easy to test. Never returns secret values, only whether they are set.
export interface Mission { id: string; title: string; why: string; weight: number; done: boolean; optional: boolean; env: string[]; link?: { label: string; href: string }; steps: string[] }
export interface LaunchFlags { storeConfigured: boolean; aiAvailable: boolean; totp: boolean; passwordLen: number; secretLen: number }

const has = (env: Record<string, string | undefined>, k: string) => !!(env[k] && env[k]!.trim());

export function missions(env: Record<string, string | undefined>, f: LaunchFlags): Mission[] {
  const siteUrl = (env.NEXT_PUBLIC_SITE_URL || '').trim();
  return [
    { id: 'store', title: 'Permanent storage', weight: 25, optional: false, done: f.storeConfigured, env: ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'],
      why: 'Without it, builder sites, orders, the inbox and settings are wiped whenever the server restarts.',
      link: { label: 'Open Upstash', href: 'https://console.upstash.com' },
      steps: ['Sign up free at upstash.com and create a Redis database (region closest to you).', 'On the database page copy the REST URL and REST token.', 'In Vercel → Settings → Environment Variables add UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.', 'Redeploy.'] },
    { id: 'login', title: 'Strong admin login', weight: 15, optional: false, done: f.passwordLen >= 12 && f.secretLen >= 32, env: ['ADMIN_PASSWORD', 'ADMIN_SESSION_SECRET'],
      why: 'A long password plus a separate random cookie-signing secret keeps your panel yours.',
      steps: ['Set ADMIN_PASSWORD to 12+ characters.', 'Set ADMIN_SESSION_SECRET to 32+ random characters (mash the keyboard, or use a password manager).', 'Redeploy, then sign in again.'] },
    { id: '2fa', title: 'Two-factor sign-in', weight: 8, optional: true, done: f.totp, env: ['ADMIN_TOTP_SECRET'],
      why: 'Even if your password leaks, nobody gets in without your phone.',
      link: { label: 'Open Security', href: '/admin/security' },
      steps: ['Open Admin → Security and generate a 2FA secret.', 'Scan it with Google Authenticator or Authy.', 'Add the secret as ADMIN_TOTP_SECRET in Vercel and redeploy.'] },
    { id: 'ai', title: 'Free cloud AI', weight: 20, optional: false, done: f.aiAvailable, env: [],
      why: 'Lets the assistant answer like a real LLM for free, without hosting a model yourself. Without it the assistant uses its built-in rules and the visitor\'s on-device model.',
      link: { label: 'AI Providers', href: '/admin/ai-providers' },
      steps: ['Create a free key at console.groq.com (or aistudio.google.com for Gemini).', 'Open Admin → AI Providers, paste the key into that provider and switch it on.', 'Press "Test" to confirm it answers.'] },
    { id: 'mail', title: 'Email delivery', weight: 15, optional: false, done: has(env, 'RESEND_API_KEY'), env: ['RESEND_API_KEY', 'CONTACT_TO'],
      why: 'Contact-form messages, quote requests and chat hand-offs reach your inbox.',
      link: { label: 'Open Resend', href: 'https://resend.com/api-keys' },
      steps: ['Sign up free at resend.com and create an API key.', 'Add it as RESEND_API_KEY in Vercel.', 'Optionally add CONTACT_TO (defaults to raytbolt@gmail.com).', 'Redeploy and send yourself a test from the contact page.'] },
    { id: 'pay', title: 'Mobile-money details', weight: 10, optional: true, done: has(env, 'MOMO_MTN_NUMBER') || has(env, 'MOMO_AIRTEL_NUMBER'), env: ['MOMO_MTN_NUMBER', 'MOMO_AIRTEL_NUMBER', 'MOMO_ACCOUNT_NAME'],
      why: 'Shown to customers when they order a template, so they know where to pay.',
      steps: ['Add MOMO_MTN_NUMBER and/or MOMO_AIRTEL_NUMBER.', 'Add MOMO_ACCOUNT_NAME (the name customers will see when they send money).', 'Redeploy.'] },
    { id: 'url', title: 'Public web address', weight: 5, optional: false, done: /^https:\/\//.test(siteUrl) && !/localhost/.test(siteUrl), env: ['NEXT_PUBLIC_SITE_URL'],
      why: 'Used for the sitemap, link previews and share cards.',
      steps: ['Add NEXT_PUBLIC_SITE_URL = your https address, with no trailing slash.', 'Redeploy.'] },
    { id: 'bots', title: 'Spam shield', weight: 2, optional: true, done: has(env, 'TURNSTILE_SECRET_KEY') && has(env, 'NEXT_PUBLIC_TURNSTILE_SITE_KEY'), env: ['NEXT_PUBLIC_TURNSTILE_SITE_KEY', 'TURNSTILE_SECRET_KEY'],
      why: 'Cloudflare Turnstile (free) blocks bots on your contact form. Rate limits already protect you without it.',
      link: { label: 'Cloudflare Turnstile', href: 'https://dash.cloudflare.com/?to=/:account/turnstile' },
      steps: ['Create a Turnstile widget in Cloudflare (free).', 'Add the site key and secret key in Vercel.', 'Redeploy.'] },
  ];
}

export function readiness(ms: Mission[]): { score: number; done: number; total: number; next: Mission | null; level: string } {
  const total = ms.reduce((a, m) => a + m.weight, 0) || 1;
  const got = ms.filter((m) => m.done).reduce((a, m) => a + m.weight, 0);
  const score = Math.round((got / total) * 100);
  const next = ms.filter((m) => !m.done).sort((a, b) => Number(a.optional) - Number(b.optional) || b.weight - a.weight)[0] || null;
  const level = score >= 100 ? 'FULLY ARMED' : score >= 75 ? 'LAUNCH READY' : score >= 40 ? 'WARMING UP' : 'GROUNDED';
  return { score, done: ms.filter((m) => m.done).length, total: ms.length, next, level };
}
