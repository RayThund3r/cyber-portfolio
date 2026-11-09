// src/app/admin/security/page.tsx — sessions, sign-in history, two-factor setup and a password generator.
'use client';
import { useMemo, useState } from 'react';
import { api, relTime, useApi } from '@/lib/admin/client';
import { genPassword, passwordStrength } from '@/lib/admin/derive';
import { AButton, Badge, Card, CopyBtn, ErrorBox, Field, inputCls, Notice, PageHead, Priv, Skel, useToast } from '@/components/admin/ui';
import { useAdmin } from '@/components/admin/AdminShell';

interface Sec { expiresAt: number; allowList: boolean; audit: Array<{ t: number; kind: string; ok: boolean; who: string; country?: string; city?: string; ua?: string; note?: string }>; totpEnabled: boolean; passwordLength: number; separateSecret: boolean }
const device = (ua: string) => `${/Edg\//.test(ua) ? 'Edge' : /Firefox/.test(ua) ? 'Firefox' : /Chrome/.test(ua) ? 'Chrome' : /Safari/.test(ua) ? 'Safari' : 'Browser'} on ${/Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Mac/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'unknown OS'}`;

export default function SecurityPage() {
  const toast = useToast();
  const { signOut } = useAdmin();
  const { data, error, reload } = useApi<Sec>('/api/admin/security');
  const [pw, setPw] = useState(() => genPassword());
  const [totp, setTotp] = useState<{ secret: string; uri: string } | null>(null);
  const [code, setCode] = useState('');
  const [valid, setValid] = useState<boolean | null>(null);
  const strength = useMemo(() => passwordStrength(pw), [pw]);

  const act = async (body: Record<string, unknown>, ok: string) => { try { const r = await api<Record<string, unknown>>('/api/admin/security', { method: 'POST', body }); if (ok) toast(ok); reload(); return r; } catch (e) { toast(e instanceof Error ? e.message : 'Failed', 'err'); return null; } };
  const newTotp = async () => { const r = await act({ action: 'totp-new' }, ''); if (r) { setTotp({ secret: String(r.secret), uri: String(r.uri) }); setValid(null); setCode(''); } };
  const test = async () => { const r = await act({ action: 'totp-test', secret: totp?.secret, code }, ''); if (r) setValid(r.valid === true); };

  const score = data ? [data.passwordLength >= 12, data.totpEnabled, data.separateSecret].filter(Boolean).length : 0;
  return (
    <>
      <PageHead title="Security" sub="Who is signed in, who tried to get in, and how to lock the door harder." icon="shield" />
      {error && <ErrorBox text={error} retry={reload} />}
      {!data && !error && <Skel h="h-64" />}
      {data && (
        <div className="space-y-4">
          <Card title="Hardening score" icon="shield" right={<Badge tone={score === 3 ? 'ok' : score >= 1 ? 'warn' : 'bad'}>{score}/3</Badge>}>
            <ul className="grid gap-2 sm:grid-cols-3">{[['Long password (12+ characters)', data.passwordLength >= 12], ['Two-factor codes on', data.totpEnabled], ['Separate signing secret (ADMIN_SESSION_SECRET)', data.separateSecret]].map(([t, ok]) => <li key={String(t)} className={`rounded-lg border p-3 text-xs ${ok ? 'border-emerald-500/30 text-emerald-200' : 'border-amber-500/30 text-amber-200'}`}>{ok ? 'Done · ' : 'To do · '}{t}</li>)}</ul>
          </Card>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="This session" icon="key" right={<AButton small danger icon="lock" onClick={async () => { if (window.confirm('Sign out every device, including this one?')) { await act({ action: 'signout-all' }, ''); void signOut(); } }}>Sign out everywhere</AButton>}>
              <ul className="space-y-2 text-sm text-zinc-300">
                <li className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/40 p-2.5 text-xs"><span>Signed in on this device</span><Badge tone="accent">ends in about {Math.max(1, Math.round((data.expiresAt - Date.now()) / 3600000))} h</Badge></li>
                <li className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/40 p-2.5 text-xs"><span>Only listed IP addresses may sign in</span><Badge tone={data.allowList ? 'ok' : 'warn'}>{data.allowList ? 'on' : 'off'}</Badge></li>
              </ul>
              <p className="mt-2 text-[11px] text-zinc-500">The owner login keeps one shared sign-in per device. "Sign out everywhere" ends every device at once, which is the right move if a phone or laptop is lost.</p>
            </Card>
            <Card title="Password generator" icon="lock">
              <div className="space-y-3"><div className="flex gap-2"><input readOnly value={pw} aria-label="Generated password" className={`${inputCls} select-all`} /><AButton icon="refresh" onClick={() => setPw(genPassword())} title="New password" /></div>
                <div className="flex items-center gap-2"><div className="h-1.5 flex-1 overflow-hidden rounded bg-zinc-800"><div className={`h-full ${strength.tone === 'ok' ? 'bg-emerald-400' : strength.tone === 'warn' ? 'bg-amber-400' : 'bg-rose-400'}`} style={{ width: `${Math.min(100, strength.bits)}%` }} /></div><Badge tone={strength.tone}>{strength.label} · ~{strength.bits} bits</Badge></div>
                <div className="flex gap-2"><CopyBtn text={pw} label="Copy" /></div>
                <p className="text-[11px] leading-relaxed text-zinc-500">Created in your browser and never sent anywhere. To use it, set it as <code className="text-zinc-300">ADMIN_PASSWORD</code> in Vercel and redeploy: that also signs out every session.</p></div>
            </Card>
          </div>
          <Card title="Two-factor sign-in (authenticator app)" icon="shield" right={<Badge tone={data.totpEnabled ? 'ok' : 'warn'}>{data.totpEnabled ? 'enabled' : 'off'}</Badge>}>
            {!totp ? (
              <div className="flex flex-wrap items-center justify-between gap-3"><p className="max-w-xl text-sm text-zinc-400">{data.totpEnabled ? 'A code from your authenticator app is required at sign-in. You can generate a new secret to rotate it.' : 'Adds a 6-digit code (Google Authenticator, Authy, 1Password, Aegis…) on top of your password, so a leaked password alone cannot get in.'}</p><AButton variant="solid" icon="key" onClick={newTotp}>{data.totpEnabled ? 'Rotate secret' : 'Set up'}</AButton></div>
            ) : (
              <ol className="space-y-4 text-sm text-zinc-300">
                <li><b className="text-accent">1.</b> In your authenticator app choose “enter a setup key” (or open the link on your phone) and add:<div className="mt-2 flex flex-wrap items-center gap-2"><code className="select-all break-all rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm tracking-wider text-accent">{totp.secret.match(/.{1,4}/g)?.join(' ')}</code><CopyBtn text={totp.secret} /><a href={totp.uri} className="font-mono text-[11px] text-zinc-400 underline decoration-dotted hover:text-accent">open in app</a></div></li>
                <li><b className="text-accent">2.</b> Type the 6-digit code it shows to prove it works:<div className="mt-2 flex flex-wrap items-center gap-2"><div className="w-36"><Field label="Code"><input value={code} onChange={(e) => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setValid(null); }} inputMode="numeric" placeholder="000000" className={`${inputCls} tracking-[0.3em]`} /></Field></div><AButton icon="check" onClick={test} disabled={code.length !== 6}>Test</AButton>{valid === true && <Badge tone="ok">correct</Badge>}{valid === false && <Badge tone="bad">wrong code</Badge>}</div></li>
                <li><b className="text-accent">3.</b> Add this environment variable in Vercel (Settings → Environment Variables) and redeploy:<pre className="mt-2 overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950 p-3 font-mono text-xs text-emerald-200">ADMIN_TOTP_SECRET={totp.secret}</pre><div className="mt-1.5"><CopyBtn text={`ADMIN_TOTP_SECRET=${totp.secret}`} label="Copy line" /></div></li>
                <li><Notice tone="warn" title="Keep a way back in">Do step 3 only after step 2 shows “correct”. If you lose the authenticator app, delete the variable in Vercel and redeploy to get back in with the password alone.</Notice></li>
              </ol>
            )}
          </Card>
          <Card title="Sign-in history" icon="clock" right={<AButton small danger onClick={() => act({ action: 'clear-audit' }, 'History cleared')}>Clear</AButton>} pad={false}>
            {data.audit.length === 0 ? <p className="p-6 text-center text-sm text-zinc-500">No sign-ins recorded yet.</p> : <ul className="max-h-80 divide-y divide-zinc-800/70 overflow-y-auto">{data.audit.map((a, i) => <li key={a.t + ':' + i} className="flex flex-wrap items-center gap-2 px-4 py-2 text-xs"><Badge tone={a.ok ? 'ok' : 'bad'}>{a.kind}{a.ok ? '' : ' failed'}</Badge><span className="text-zinc-400">{[a.city, a.country].filter(Boolean).join(', ') || 'unknown place'}</span>{a.ua && <span className="min-w-0 flex-1 truncate text-zinc-600"><Priv>{device(a.ua)}</Priv></span>}{a.note && <span className="text-amber-300">{a.note}</span>}<span className="ml-auto font-mono text-[10px] text-zinc-600">{relTime(a.t)}</span></li>)}</ul>}
          </Card>
        </div>
      )}
    </>
  );
}
