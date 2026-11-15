// src/server/cloud.ts — "Cloud inbox" for Pro sites.
//
// A customer's Pro site is static (hosted anywhere). This module lets that site send orders / bookings / enquiries / subscribers
// to YOUR server, so the owner sees them in the site's #admin from any device, and so two visitors can never book the same slot.
//
// SECURITY MODEL
//  • Visitors may only SUBMIT, read which time slots are taken (no personal data), and look up THEIR OWN order (ref + phone).
//  • The owner proves who they are with a token derived from their passcode:  token = sha256(siteKey:cloud:passcode).
//    The server stores only verifier = sha256("v:" + token) — a hash of a hash. The token lives in browser memory only.
//  • Everything a visitor sends is re-validated here; totals are recomputed; sizes are capped; the server assigns ids/times.
//  • Brute-force protection on owner login; per-site and per-address flood limits (in the route).
import 'server-only';
import crypto from 'crypto';
import { createExclusive, listNames, readJson, removeJson, update, writeJson } from './store';
import { CAN_EMAIL_CUSTOMERS, FROM, SITE_URL, reportServerError, resend } from './mail';
import { EMAIL_RE, esc, rateLimit } from './util';

export type Kind = 'order' | 'booking' | 'enquiry' | 'sub';
export interface SiteRecord { id: string; projectId: string; name: string; ownerEmail: string; verifier: string; configVerifier: string; createdAt: string; updatedAt: string; /** operator kill switch (scripts/cloud-admin.mjs): the shop's cloud API answers 403 */ disabled?: boolean }
export type Result = { status: number; body: Record<string, unknown> };

export const MAX_PER_KIND = Math.max(10, Number(process.env.CLOUD_MAX_PER_SITE) || 3000);
const ID_RE = /^[a-z0-9]{6,16}$/;
const HEX64 = /^[0-9a-f]{64}$/;
const sha = (s: string) => crypto.createHash('sha256').update(s, 'utf8').digest('hex');
export const cloudEnabled = () => process.env.CLOUD_INBOX !== 'off';

/* ───────── sites ───────── */
const siteFile = (id: string) => `cloud/sites/${id}`;
export async function getSite(id: unknown): Promise<SiteRecord | null> {
  if (typeof id !== 'string' || !ID_RE.test(id)) return null;
  return readJson<SiteRecord | null>(siteFile(id), null);
}

/**
 * Called when a customer downloads their site. Idempotent. The passcode verifier in the CONFIG only overwrites the stored one when the
 * customer actually changed it in the builder — a passcode changed later inside the live admin survives a re-download.
 */
export async function registerSite(i: { id: string; projectId: string; name: string; ownerEmail: string; verifier: string }): Promise<{ ok: boolean; reason?: string }> {
  if (!ID_RE.test(i.id) || !HEX64.test(i.verifier)) return { ok: false, reason: 'invalid' };
  let conflict = false;
  await update<Partial<SiteRecord>>(siteFile(i.id), {}, (d) => {
    const now = new Date().toISOString();
    if (d.id && d.projectId !== i.projectId) { conflict = true; return; }
    if (!d.id) { Object.assign(d, { id: i.id, projectId: i.projectId, verifier: i.verifier, configVerifier: i.verifier, createdAt: now }); }
    else if (d.configVerifier !== i.verifier) { d.verifier = i.verifier; d.configVerifier = i.verifier; }
    d.name = String(i.name || '').slice(0, 80); d.ownerEmail = EMAIL_RE.test(i.ownerEmail || '') ? i.ownerEmail.slice(0, 120) : ''; d.updatedAt = now;
  });
  return conflict ? { ok: false, reason: 'id_taken' } : { ok: true };
}

/* ───────── owner authentication (with brute-force lockout) ───────── */
const fails = new Map<string, { n: number; until: number }>();
const FAIL_MAX = 10, FAIL_LOCK_MS = 10 * 60_000;
export function authBlocked(key: string): boolean { const f = fails.get(key); return !!f && f.n >= FAIL_MAX && f.until > Date.now(); }
function authFail(key: string) {
  const now = Date.now(), f = fails.get(key);
  const cur = f && f.until > now ? f : { n: 0, until: now + FAIL_LOCK_MS };
  cur.n++; fails.set(key, cur);
  if (fails.size > 5000) for (const [k, v] of fails) if (v.until < now) fails.delete(k);
}
// Site-wide budget: even if an attacker rotates addresses, only SITE_FAIL_MAX wrong tokens per hour are possible per shop; after that, only
// addresses that recently signed in successfully (the owner's own phone/laptop) can still reach the owner endpoints. So an attacker can never
// guess weak passcodes forever, and can't lock the real owner out either.
const siteFails = new Map<string, { n: number; until: number }>();
const goodIps = new Map<string, number>();
const SITE_FAIL_MAX = 60, SITE_FAIL_WINDOW_MS = 3_600_000, GOOD_TTL_MS = 7 * 86_400_000;
function siteLocked(id: string, ip: string): boolean {
  const f = siteFails.get(id); if (!f || f.until <= Date.now() || f.n < SITE_FAIL_MAX) return false;
  const g = goodIps.get(`${id}:${ip}`); return !(g && Date.now() - g < GOOD_TTL_MS);
}
/** True when this address may not even try an owner action right now (own lockout, or the shop is under a guessing attack). */
export function ownerBlocked(site: SiteRecord, ip: string): boolean { return authBlocked(`${ip}:${site.id}`) || siteLocked(site.id, ip); }
export function verifyOwner(site: SiteRecord, token: unknown, ip: string): boolean {
  const failKey = `${ip}:${site.id}`; if (ownerBlocked(site, ip)) return false;
  const ok = typeof token === 'string' && HEX64.test(token) && crypto.timingSafeEqual(Buffer.from(sha('v:' + token)), Buffer.from(site.verifier));
  if (ok) { fails.delete(failKey); if (goodIps.size > 5000) goodIps.clear(); goodIps.set(`${site.id}:${ip}`, Date.now()); return true; }
  authFail(failKey);
  const now = Date.now(), f = siteFails.get(site.id);
  const cur = f && f.until > now ? f : { n: 0, until: now + SITE_FAIL_WINDOW_MS }; cur.n++; siteFails.set(site.id, cur);
  if (siteFails.size > 5000) for (const [k, v] of siteFails) if (v.until < now) siteFails.delete(k);
  return false;
}

/* ───────── validation helpers ───────── */
const line = (v: unknown, max: number) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const para = (v: unknown, max: number) => String(v ?? '').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '').replace(/\r/g, '').trim().slice(0, max);
const nnum = (v: unknown, hi: number) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(0, Math.round(n))) : 0; };
const phone = (v: unknown) => { let p = String(v ?? '').replace(/\D/g, ''); if (p.startsWith('00')) p = p.slice(2); else if (p.startsWith('0')) p = '256' + p.slice(1); return p; };
const phoneOk = (p: string) => p.length >= 9 && p.length <= 15;
const A32 = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newRef = (prefix: string) => `${prefix}-${Array.from(crypto.randomBytes(7), (b) => A32[b % 32]).join('')}`;
const bad = (error: string, status = 400): Result => ({ status, body: { error } });
const dataDir = (id: string, kind: string) => `cloud/data/${id}/${kind}`;
const slotDir = (id: string, date: string) => `cloud/data/${id}/slot/${date}`;
const PREFIX: Record<Kind, string> = { order: 'ORD', booking: 'BKG', enquiry: 'ENQ', sub: 'SUB' };
const REF_RE = /^(ORD|BKG|ENQ)-[A-Z0-9]{4,14}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
function dateOk(d: string) {
  if (!DATE_RE.test(d)) return false;
  const t = Date.parse(d + 'T12:00:00Z'); if (!Number.isFinite(t)) return false;
  const days = (t - Date.now()) / 86_400_000; return days > -2 && days < 135;
}
const slotName = (t: string) => t.replace(':', '-');

/* ───────── visitor: submit ───────── */
export async function submit(site: SiteRecord, kind: unknown, raw: unknown): Promise<Result> {
  const d = (raw && typeof raw === 'object' ? raw : {}) as Record<string, any>;
  const id = site.id; const at = Date.now();
  const wantRef = typeof d.ref === 'string' && REF_RE.test(d.ref) ? d.ref : '';

  if (kind === 'order') {
    const name = line(d.name, 80), ph = phone(d.phone);
    if (name.length < 2 || !phoneOk(ph)) return bad('invalid_contact');
    const items = (Array.isArray(d.items) ? d.items : []).slice(0, 40).map((i: any) => ({ id: line(i?.id, 40), n: line(i?.n, 120), p: nnum(i?.p, 1e9), q: Math.max(1, Math.min(99, Math.floor(Number(i?.q)) || 1)) })).filter((i: any) => i.n);
    if (!items.length) return bad('empty_order');
    const sub = items.reduce((a: number, i: any) => a + i.p * i.q, 0), disc = Math.min(sub, nnum(d.disc, 1e9)), fee = nnum(d.fee, 1e7);
    const rec = { ref: wantRef.startsWith('ORD-') ? wantRef : newRef('ORD'), at, name, phone: ph, dl: d.dl === 'delivery' ? 'delivery' : 'pickup', addr: line(d.addr, 200), pay: line(d.pay, 20), note: para(d.note, 300), code: line(d.code, 30), items, sub, disc, fee, total: sub - disc + fee, st: 'Pending' };
    return storeUnique(site, 'order', rec, (x) => x.phone === rec.phone && x.name === rec.name);
  }

  if (kind === 'booking') {
    const name = line(d.name, 80), ph = phone(d.phone), date = String(d.date ?? ''), time = String(d.time ?? '');
    if (name.length < 2 || !phoneOk(ph)) return bad('invalid_contact');
    if (!dateOk(date) || !TIME_RE.test(time)) return bad('invalid_slot');
    const rec = { ref: wantRef.startsWith('BKG-') ? wantRef : newRef('BKG'), at, name, phone: ph, svc: line(d.svc, 80), date, time, note: para(d.note, 300), st: 'Pending', dep: nnum(d.dep, 1e9) };
    const claim = await createExclusive(`${slotDir(id, date)}/${slotName(time)}`, { ref: rec.ref, at });
    if (!claim) { // already taken — unless it is THIS booking being re-sent after a network hiccup
      const mine = await readJson<{ ref?: string } | null>(`${slotDir(id, date)}/${slotName(time)}`, null);
      if (mine?.ref === rec.ref) return { status: 200, body: { ok: true, ref: rec.ref, duplicate: true } };
      return bad('slot_taken', 409);
    }
    try { await writeJson(`${dataDir(id, 'booking')}/${rec.ref}`, rec); } catch (e) { await removeJson(`${slotDir(id, date)}/${slotName(time)}`); throw e; }
    bust(id, 'booking'); after(site, 'booking', rec);
    return { status: 200, body: { ok: true, ref: rec.ref } };
  }

  if (kind === 'enquiry') {
    const name = line(d.name, 80), contact = line(d.contact, 120), msg = para(d.msg, 1500);
    if (name.length < 2 || contact.length < 5 || msg.length < 3) return bad('invalid_enquiry');
    const rec = { ref: wantRef.startsWith('ENQ-') ? wantRef : newRef('ENQ'), at, kind: d.kind === 'Quote' ? 'Quote' : 'Message', name, contact, msg, svc: line(d.svc, 80), st: 'New' };
    return storeUnique(site, 'enquiry', rec, (x) => x.contact === rec.contact && x.msg === rec.msg);
  }

  if (kind === 'sub') {
    const email = line(d.email, 120).toLowerCase();
    if (!EMAIL_RE.test(email)) return bad('invalid_email');
    await createExclusive(`${dataDir(id, 'sub')}/${sha(email).slice(0, 24)}`, { email, at }); bust(id, 'sub');
    return { status: 200, body: { ok: true } };
  }
  return bad('invalid_kind');
}

async function storeUnique(site: SiteRecord, kind: 'order' | 'enquiry', rec: Record<string, any>, same: (x: any) => boolean): Promise<Result> {
  for (let attempt = 0; attempt < 4; attempt++) {
    if (await createExclusive(`${dataDir(site.id, kind)}/${rec.ref}`, rec)) { bust(site.id, kind); after(site, kind, rec); return { status: 200, body: { ok: true, ref: rec.ref } }; }
    const existing = await readJson<any>(`${dataDir(site.id, kind)}/${rec.ref}`, null);
    if (existing && same(existing)) return { status: 200, body: { ok: true, ref: rec.ref, duplicate: true } }; // a retry of the same submission
    rec.ref = newRef(PREFIX[kind]); // genuine ref collision (astronomically rare): give the server's own ref
  }
  return bad('try_again', 503);
}

let sinceSweep = 0; const swept = new Set<string>();
function after(site: SiteRecord, kind: Kind, rec: Record<string, any>) {
  void notifySiteOwner(site, kind, rec).catch(() => undefined);
  if (++sinceSweep >= 50) { sinceSweep = 0; for (const k of ['order', 'booking', 'enquiry', 'sub'] as Kind[]) void prune(site.id, k).catch(() => undefined); }
}
/** Keep each kind to MAX_PER_KIND records (oldest go first) so one site can never fill the disk. */
export async function prune(id: string, kind: Kind) {
  const names = await listNames(dataDir(id, kind));
  if (names.length <= MAX_PER_KIND) return;
  const recs = (await Promise.all(names.map(async (n) => ({ n, r: await readJson<any>(`${dataDir(id, kind)}/${n}`, null) })))).filter((x) => x.r);
  recs.sort((a, b) => (b.r.at || 0) - (a.r.at || 0));
  for (const x of recs.slice(MAX_PER_KIND)) {
    if (kind === 'booking' && x.r.date && x.r.time) await removeJson(`${slotDir(id, x.r.date)}/${slotName(x.r.time)}`);
    await removeJson(`${dataDir(id, kind)}/${x.n}`);
  }
  bust(id, kind);
}

async function notifySiteOwner(site: SiteRecord, kind: Kind, rec: Record<string, any>) {
  if (!CAN_EMAIL_CUSTOMERS || !site.ownerEmail || kind === 'sub') return;
  if (rateLimit(`cl-mail:${site.id}`, 20, 3_600_000)) return;
  const r = resend(); if (!r) return;
  const title = kind === 'order' ? `New order ${rec.ref} — UGX ${Number(rec.total).toLocaleString('en-US')}` : kind === 'booking' ? `New booking ${rec.ref} — ${rec.date} ${rec.time}` : `New ${String(rec.kind).toLowerCase()} from ${rec.name}`;
  const body = kind === 'order' ? `${rec.items.map((i: any) => `${i.q} × ${esc(i.n)}`).join('<br>')}<br><b>Total UGX ${Number(rec.total).toLocaleString('en-US')}</b><br>${esc(rec.dl === 'delivery' ? 'Deliver to: ' + rec.addr : 'Pickup')}<br>Payment: ${esc(rec.pay)}` : kind === 'booking' ? `${esc(rec.svc)}<br>${esc(rec.date)} ${esc(rec.time)}<br>${esc(rec.note)}` : `${esc(rec.msg)}<br>${esc(rec.contact)}`;
  try { await r.emails.send({ from: FROM, to: site.ownerEmail, subject: title.slice(0, 150), html: `<p><b>${esc(title)}</b></p><p>${esc(rec.name)} · ${esc(rec.phone || rec.contact || '')}</p><p>${body}</p><p><a href="${esc(SITE_URL)}">Open your site's admin (#admin) to manage it</a></p>` }); }
  catch (e) { await reportServerError('cloud:mail', e); }
}

/* ───────── visitor: which slots are taken / my own order ───────── */
export async function slotsTaken(site: SiteRecord, date: unknown): Promise<Result> {
  if (typeof date !== 'string' || !DATE_RE.test(date)) return bad('invalid_date');
  const names = await listNames(slotDir(site.id, date));
  return { status: 200, body: { date, taken: names.map((n) => n.replace('-', ':')).filter((t) => TIME_RE.test(t)) } };
}
export async function trackOrder(site: SiteRecord, ref: unknown, ph: unknown): Promise<Result> {
  const r = typeof ref === 'string' ? ref.toUpperCase().trim() : '';
  if (!/^ORD-[A-Z0-9]{4,14}$/.test(r)) return bad('not_found', 404);
  const o = await readJson<any>(`${dataDir(site.id, 'order')}/${r}`, null);
  if (!o || phone(ph) !== o.phone) return bad('not_found', 404); // same answer for "no such order" and "wrong phone"
  return { status: 200, body: { ok: true, st: o.st, total: o.total, at: o.at, items: o.items.map((i: any) => ({ n: i.n, q: i.q })) } };
}

/* ───────── owner ───────── */
const STATUSES: Record<Exclude<Kind, 'sub'>, string[]> = { order: ['Pending', 'Paid', 'Ready', 'Delivered', 'Cancelled'], booking: ['Pending', 'Confirmed', 'Done', 'Cancelled'], enquiry: ['New', 'Done'] };
const sortNewest = (a: any, b: any) => (b.at || 0) - (a.at || 0);
// A short-lived cache per shop + record type. Concurrent callers SHARE one rebuild (otherwise 20 simultaneous owner refreshes would each re-read
// every file), and any write through this module clears the cache and invalidates a rebuild already in flight, so a request made after a write
// can never be served data from before it.
/** CLOUD_RETENTION_DAYS (0 / unset = keep until the shop deletes them or the per-type cap is reached). Read at call time so it can be changed without a rebuild. */
const retentionCutoff = () => { const d = Number(process.env.CLOUD_RETENTION_DAYS); return Number.isFinite(d) && d > 0 ? Date.now() - d * 86_400_000 : 0; };
const num0 = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
async function expire(id: string, kind: Kind, old: any[]) {
  for (const r of old) {
    const name = kind === 'sub' ? sha(String(r.email)).slice(0, 24) : r.ref;
    if (kind === 'booking' && r.date && r.time) { const cur = await readJson<{ ref?: string } | null>(`${slotDir(id, r.date)}/${slotName(r.time)}`, null); if (cur?.ref === r.ref) await removeJson(`${slotDir(id, r.date)}/${slotName(r.time)}`); }
    if (name) await removeJson(`${dataDir(id, kind)}/${name}`);
  }
  bust(id, kind);
}
const listCache = new Map<string, { at: number; list: any[] }>();
const inflight = new Map<string, Promise<any[]>>();
const gens = new Map<string, number>();
const LIST_TTL_MS = 2000;
const bust = (id: string, kind: Kind) => { const k = `${id}/${kind}`; listCache.delete(k); inflight.delete(k); gens.set(k, (gens.get(k) || 0) + 1); };
async function readAll(id: string, kind: Kind): Promise<any[]> {
  const key = `${id}/${kind}`, hit = listCache.get(key);
  if (hit && Date.now() - hit.at < LIST_TTL_MS) return hit.list.slice();
  let p = inflight.get(key);
  if (!p) {
    const gen = gens.get(key) || 0;
    const mine: Promise<any[]> = (async () => {
      const names = await listNames(dataDir(id, kind)); const out: any[] = [];
      for (let i = 0; i < names.length; i += 100) for (const r of await Promise.all(names.slice(i, i + 100).map((n) => readJson<any>(`${dataDir(id, kind)}/${n}`, null)))) if (r) out.push(r);
      const cutoff = retentionCutoff(); const old = cutoff ? out.filter((r) => num0(r.at) < cutoff) : [];
      if (old.length) void expire(id, kind, old).catch(() => undefined);
      const list = (old.length ? out.filter((r) => num0(r.at) >= cutoff) : out).sort(sortNewest).slice(0, MAX_PER_KIND);
      if ((gens.get(key) || 0) === gen) { if (listCache.size > 400) listCache.clear(); listCache.set(key, { at: Date.now(), list }); } // not cached if a write happened while we were reading
      return list;
    })().finally(() => { if (inflight.get(key) === mine) inflight.delete(key); });
    inflight.set(key, mine); p = mine;
  }
  return (await p).slice();
}
export async function ownerList(id: string): Promise<Result> {
  const [orders, bookings, enquiries, subs] = await Promise.all([readAll(id, 'order'), readAll(id, 'booking'), readAll(id, 'enquiry'), readAll(id, 'sub')]);
  return { status: 200, body: { ok: true, orders, bookings, enquiries, subs: subs.map((s) => s.email) } };
}
const locks = new Map<string, Promise<unknown>>();
function lockRef<T>(k: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(k) || Promise.resolve(); const run = prev.catch(() => undefined).then(fn); const tail = run.catch(() => undefined);
  locks.set(k, tail); void tail.then(() => { if (locks.get(k) === tail) locks.delete(k); }); return run;
}
export async function ownerUpdate(id: string, kind: unknown, ref: unknown, status: unknown): Promise<Result> {
  if (kind !== 'order' && kind !== 'booking' && kind !== 'enquiry') return bad('invalid_kind');
  if (typeof ref !== 'string' || !REF_RE.test(ref) || typeof status !== 'string' || !STATUSES[kind].includes(status)) return bad('invalid');
  return lockRef(`${id}/${ref}`, async () => {
    const f = `${dataDir(id, kind)}/${ref}`; const r = await readJson<any>(f, null); if (!r) return bad('not_found', 404);
    r.st = status; await writeJson(f, r); bust(id, kind);
    if (kind === 'booking') { // a cancelled booking frees its slot; un-cancelling must re-claim it
      if (status === 'Cancelled') await removeJson(`${slotDir(id, r.date)}/${slotName(r.time)}`);
      else if (!(await createExclusive(`${slotDir(id, r.date)}/${slotName(r.time)}`, { ref: r.ref, at: r.at }))) {
        const cur = await readJson<{ ref?: string } | null>(`${slotDir(id, r.date)}/${slotName(r.time)}`, null);
        if (cur?.ref !== r.ref) { r.st = 'Cancelled'; await writeJson(f, r); bust(id, kind); return bad('slot_taken', 409); }
      }
    }
    return { status: 200, body: { ok: true, record: r } };
  });
}
export async function ownerDelete(id: string, kind: unknown, ref: unknown): Promise<Result> {
  if (kind !== 'order' && kind !== 'booking' && kind !== 'enquiry') return bad('invalid_kind');
  if (typeof ref !== 'string' || !REF_RE.test(ref)) return bad('invalid');
  return lockRef(`${id}/${ref}`, async () => {
    const f = `${dataDir(id, kind)}/${ref}`; const r = await readJson<any>(f, null); if (!r) return bad('not_found', 404);
    if (kind === 'booking') { const cur = await readJson<{ ref?: string } | null>(`${slotDir(id, r.date)}/${slotName(r.time)}`, null); if (cur?.ref === r.ref) await removeJson(`${slotDir(id, r.date)}/${slotName(r.time)}`); }
    await removeJson(f); bust(id, kind); return { status: 200, body: { ok: true } };
  });
}
export async function ownerRotate(site: SiteRecord, newVerifier: unknown): Promise<Result> {
  if (typeof newVerifier !== 'string' || !HEX64.test(newVerifier)) return bad('invalid');
  await update<Partial<SiteRecord>>(siteFile(site.id), {}, (d) => { d.verifier = newVerifier; d.updatedAt = new Date().toISOString(); });
  return { status: 200, body: { ok: true } };
}
