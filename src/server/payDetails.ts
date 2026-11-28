// src/server/payDetails.ts: where customers send mobile money. Edited in Admin > Settings; the old Vercel variables still work as a fallback.
// Each network has its OWN registered name (MTN and Airtel accounts are often under different names).
import 'server-only';
import { readJson, update } from './store';

export interface PayDetails { mtnNumber: string; mtnName: string; airtelNumber: string; airtelName: string; note: string }
const KEY = 'pay-details';
const txt = (v: unknown, n: number) => String(v ?? '').replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const num = (v: unknown) => String(v ?? '').replace(/[^\d+ ]/g, '').replace(/\s+/g, ' ').trim().slice(0, 20);

export function normalizePay(raw: unknown): PayDetails {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return { mtnNumber: num(r.mtnNumber), mtnName: txt(r.mtnName, 60), airtelNumber: num(r.airtelNumber), airtelName: txt(r.airtelName, 60), note: txt(r.note, 200) };
}
export function envPay(env: Record<string, string | undefined> = process.env): PayDetails {
  const shared = env.MOMO_ACCOUNT_NAME || '';
  return normalizePay({
    mtnNumber: env.MOMO_MTN_NUMBER, mtnName: env.MOMO_MTN_NAME || shared,
    airtelNumber: env.MOMO_AIRTEL_NUMBER, airtelName: env.MOMO_AIRTEL_NAME || shared,
  });
}
/** Saved details win; anything left blank in the panel falls back to the Vercel variable. */
export async function getPayDetails(): Promise<PayDetails> {
  const saved = normalizePay((await readJson<{ v: unknown }>(KEY, { v: null })).v);
  const env = envPay();
  const pick = <K extends keyof PayDetails>(k: K) => saved[k] || env[k];
  return { mtnNumber: pick('mtnNumber'), mtnName: pick('mtnName'), airtelNumber: pick('airtelNumber'), airtelName: pick('airtelName'), note: saved.note };
}
/** What the panel shows for editing: only what was saved, so blanks are visibly blank. */
export async function getSavedPay(): Promise<PayDetails> { return normalizePay((await readJson<{ v: unknown }>(KEY, { v: null })).v); }
export async function savePay(input: unknown): Promise<PayDetails> {
  const v = normalizePay(input);
  await update<{ v: unknown }>(KEY, { v: null }, (d) => { d.v = v; });
  return v;
}
