// src/app/admin/security/page.tsx — sessions, sign-in history, two-factor setup and a password generator.
'use client';
import { useMemo, useState } from 'react';
import { api, relTime, useApi } from '@/lib/admin/client';
import { genPassword, passwordStrength } from '@/lib/admin/derive';
import { AButton, Badge, Card, CopyBtn, ErrorBox, Field, inputCls, Notice, PageHead, Priv, Skel, useToast } from '@/components/admin/ui';
import { useAdmin } from '@/components/admin/AdminShell';
import { qrPath } from '@/lib/qr';

interface Sec { expiresAt: number; allowList: boolean; audit: Array<{ t: number; kind: string; ok: boolean; who: string; country?: string; city?: string; ua?: string; note?: string }>; totpEnabled: boolean; passwordLength: number; separateSecret: boolean; creds?: { passwordSaved: boolean; totpEnabled: boolean; totpSaved: boolean; recoveryLeft?: number; persistent: boolean } }
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
  const [cur, setCur] = useState(''); const [curCode, setCurCode] = useState(''); const [next, setNext] = useState(''); const [next2, setNext2] = useState(''); const [show, setShow] = useState(false); const [busy, setBusy] = useState(false);
  const proof = { current: cur, currentCode: curCode };
  const needCode = !!data?.totpEnabled;
  const ready = cur.length > 0 && (!needCode || curCode.replace(/\s/g, '').length === 6);
  const nextStrength = useMemo(() => passwordStrength(next), [next]);
  const changePw = async () => {
    if (next !== next2) { toast('The two new passwords do not match.', 'err'); return; }
    setBusy(true); const r = await act({ action: 'password-change', ...proof, next }, 'Password changed. Other devices were signed out.'); setBusy(false);
    if (r) { setCur(''); setCurCode(''); setNext(''); setNext2(''); }
  };
  const saveTotpNow = async () => { setBusy(true); const r = await act({ action: 'totp-enable', ...proof, secret: totp?.secret, code }, 'Two-factor is on. Other devices were signed out.'); setBusy(false); if (r) { setRec((r.recoveryCodes as string[]) || null); setTotp(null); setCode(''); setCur(''); setCurCode(''); } };
  const newRec = async () => { setBusy(true); const r = await act({ action: 'recovery-new', ...proof }, 'New recovery codes created. The old ones no longer work.'); setBusy(false); if (r) { setRec((r.recoveryCodes as string[]) || null); setCur(''); setCurCode(''); } };
  const disableTotp = async () => { if (!window.confirm('Turn two-factor sign-in off?')) return; setBusy(true); const r = await act({ action: 'totp-disable', ...proof }, 'Two-factor is off.'); setBusy(false); if (r) { setCur(''); setCurCode(''); } };

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
          <Card title="Change your login" icon="key" right={<Badge tone={data.creds?.passwordSaved ? 'ok' : 'default'}>{data.creds?.passwordSaved ? 'saved in panel' : 'from Vercel'}</Badge>}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Current password"><input type={show ? 'text' : 'password'} autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} className={inputCls} /></Field>
              {needCode && <Field label="Current authenticator code"><input inputMode="numeric" value={curCode} onChange={(e) => setCurCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" className={`${inputCls} tracking-[0.3em]`} /></Field>}
              <Field label="New password (10+ characters)"><input type={show ? 'text' : 'password'} autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} className={inputCls} /></Field>
              <Field label="Repeat new password"><input type={show ? 'text' : 'password'} autoComplete="new-password" value={next2} onChange={(e) => setNext2(e.target.value)} className={inputCls} /></Field>
            </div>
            {next && <div className="mt-3 flex items-center gap-2"><div className="h-1.5 flex-1 overflow-hidden rounded bg-zinc-800"><div className={`h-full ${nextStrength.tone === 'ok' ? 'bg-emerald-400' : nextStrength.tone === 'warn' ? 'bg-amber-400' : 'bg-rose-400'}`} style={{ width: `${Math.min(100, nextStrength.bits)}%` }} /></div><Badge tone={nextStrength.tone}>{nextStrength.label}</Badge></div>}
            <div className="mt-3 flex flex-wrap items-center gap-2"><AButton variant="solid" icon="check" onClick={changePw} disabled={busy || !ready || next.length < 10 || next !== next2}>{busy ? 'Saving…' : 'Save new password'}</AButton><AButton small onClick={() => setShow((v) => !v)}>{show ? 'Hide' : 'Show'} passwords</AButton></div>
            {data.creds && !data.creds.persistent && <div className="mt-3"><Notice tone="warn" title="Needs permanent storage">Saving from the panel needs Upstash Redis connected (see Launch Pad). Until then, change ADMIN_PASSWORD in Vercel.</Notice></div>}
            <p className="mt-3 text-[11px] leading-relaxed text-zinc-500">Saved securely (hashed, never stored as plain text) and used from the next sign-in. Your other devices are signed out; this one stays in. <b className="text-zinc-400">Locked out?</b> Edit <code className="text-zinc-300">ADMIN_PASSWORD</code> (or <code className="text-zinc-300">ADMIN_TOTP_SECRET</code>) in Vercel and redeploy: a changed variable always overrides what was saved here, so you can never be shut out for good.</p>
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
                <p className="text-[11px] leading-relaxed text-zinc-500">Created in your browser and never sent anywhere. Like it? Type it into “Change your login” above.</p></div>
            </Card>
          </div>
          <Card title="Two-factor sign-in (authenticator app)" icon="shield" right={<Badge tone={data.totpEnabled ? 'ok' : 'warn'}>{data.totpEnabled ? 'enabled' : 'off'}</Badge>}>
            {rec && (
              <div className="mb-4"><Notice tone="warn" title="Save your recovery codes now">
                <p className="mb-2">Each code works once if you lose your phone: type it in the code box at sign-in. They are shown only this one time.</p>
                <div className="grid grid-cols-2 gap-1.5 font-mono text-sm text-zinc-100 sm:grid-cols-4">{rec.map((c) => <code key={c} className="select-all rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-center">{c}</code>)}</div>
                <div className="mt-3 flex flex-wrap gap-2"><CopyBtn text={rec.join('\n')} label="Copy all" /><AButton small icon="download" onClick={() => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([`Admin recovery codes (each works once)\n\n${rec.join('\n')}\n`], { type: 'text/plain' })); a.download = 'admin-recovery-codes.txt'; a.click(); }}>Download .txt</AButton><AButton small variant="solid" icon="check" onClick={() => setRec(null)}>I saved them</AButton></div>
              </Notice></div>
            )}
            {!totp ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3"><p className="max-w-xl text-sm text-zinc-400">{data.totpEnabled ? 'A code from your authenticator app is required at sign-in. Rotate the secret if you set it up badly or got a new phone.' : 'Adds a 6-digit code (Microsoft Authenticator, Google Authenticator, Authy, 1Password…) on top of your password, so a leaked password alone cannot get in.'}</p><div className="flex flex-wrap gap-2">{data.totpEnabled && <AButton danger icon="lock" onClick={disableTotp} disabled={busy || !ready}>Turn off</AButton>}{data.totpEnabled && data.creds?.totpSaved && <AButton icon="refresh" onClick={newRec} disabled={busy || !ready}>New recovery codes</AButton>}<AButton variant="solid" icon="key" onClick={newTotp}>{data.totpEnabled ? 'Rotate secret' : 'Set up'}</AButton></div></div>
                {data.totpEnabled && <p className="mt-2 text-[11px] text-zinc-500">{data.creds?.totpSaved ? `${data.creds.recoveryLeft ?? 0} recovery code(s) left. ` : ''}Turning off, rotating or making recovery codes needs “Current password” (and code) filled in under “Change your login” above.</p>}
              </>
            ) : (
              <ol className="space-y-5 text-sm text-zinc-300">
                <li><b className="text-accent">1.</b> Open <b>Microsoft Authenticator</b> → tap <b>+</b> → <b>Other account (Google, Facebook, etc.)</b> → scan this code. <span className="text-zinc-500">(Google Authenticator: + → Scan a QR code. Authy and 1Password work the same way.)</span>
                  <div className="mt-3 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                    {qr ? <svg viewBox={`0 0 ${qr.n} ${qr.n}`} role="img" aria-label="Authenticator setup QR code" className="h-44 w-44 shrink-0 rounded-lg bg-white" shapeRendering="crispEdges"><path d={qr.d} fill="#000" /></svg> : <p className="text-xs text-amber-300">Could not draw the code; use the setup key.</p>}
                    <div className="min-w-0 text-xs text-zinc-400"><p>Can’t scan? Choose “enter code manually” and type:</p><code className="mt-1.5 block select-all break-all rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm tracking-wider text-accent">{totp.secret.match(/.{1,4}/g)?.join(' ')}</code><div className="mt-1.5 flex flex-wrap items-center gap-2"><CopyBtn text={totp.secret} label="Copy key" /><a href={totp.uri} className="font-mono text-[11px] text-zinc-400 underline decoration-dotted hover:text-accent">open in app (phone only)</a></div><p className="mt-1.5 text-zinc-500">Name: SYS_PORTFOLIO · Type: time-based · 6 digits.</p></div>
                  </div></li>
                <li><b className="text-accent">2.</b> Type the 6-digit code the app shows now, to prove it works:<div className="mt-2 flex flex-wrap items-center gap-2"><div className="w-36"><Field label="Code"><input value={code} onChange={(e) => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setValid(null); }} inputMode="numeric" placeholder="000000" className={`${inputCls} tracking-[0.3em]`} /></Field></div><AButton icon="check" onClick={test} disabled={code.length !== 6}>Test</AButton>{valid === true && <Badge tone="ok">correct</Badge>}{valid === false && <Badge tone="bad">wrong code: wait for a new one</Badge>}</div></li>
                <li><b className="text-accent">3.</b> Confirm with your current password{needCode ? ' and current code' : ''} to turn it on:<div className="mt-2 flex flex-wrap items-end gap-2"><div className="w-48"><Field label="Current password"><input type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} className={inputCls} /></Field></div>{needCode && <div className="w-36"><Field label="Current code"><input inputMode="numeric" value={curCode} onChange={(e) => setCurCode(e.target.value.replace(/\D/g, '').slice(0, 6))} className={`${inputCls} tracking-[0.3em]`} /></Field></div>}<AButton variant="solid" icon="check" onClick={saveTotpNow} disabled={busy || !ready || code.length !== 6}>{busy ? 'Saving…' : 'Turn on'}</AButton><AButton small onClick={() => setTotp(null)}>Cancel</AButton></div></li>
                <li><Notice tone="warn" title="Nothing changes until step 3">Use a different code from the one you tested if it expires. After turning on, you get recovery codes: keep them somewhere safe. If your phone’s clock is off, codes fail: set the phone’s time to automatic.</Notice></li>
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
