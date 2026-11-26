// src/server/spam.ts — spam-filter settings and a short log of what was held/blocked (Admin → Security → Spam filter).
import 'server-only';
import crypto from 'node:crypto';
import { readJson, update, writeJson } from '@/server/store';
import { DEFAULT_SPAM_CFG, sanitizeSpamCfg, type SpamCfg, type SpamVerdict } from '@/lib/spamFilter';

export interface SpamLogEntry { at: string; action: 'blocked' | 'held' | 'bot'; score: number; reasons: string[]; who: string; snippet: string; form: string }
export async function getSpamCfg(): Promise<SpamCfg> { try { return sanitizeSpamCfg(await readJson<unknown>('spam-cfg', DEFAULT_SPAM_CFG)); } catch { return DEFAULT_SPAM_CFG; } }
export async function saveSpamCfg(x: unknown): Promise<SpamCfg> { const c = sanitizeSpamCfg(x); await writeJson('spam-cfg', c); return c; }
export const getSpamLog = (): Promise<SpamLogEntry[]> => readJson<SpamLogEntry[]>('spam-log', []).catch(() => []);
export async function clearSpamLog() { await writeJson('spam-log', []); }
/** Never throws: logging must not break a visitor's request. IP is stored only as a short hash. */
export async function logSpam(v: SpamVerdict, ip: string, text: string, form: string) {
  try {
    const entry: SpamLogEntry = { at: new Date().toISOString(), action: v.bot ? 'bot' : v.level === 'hold' ? 'held' : 'blocked', score: v.score, reasons: v.reasons.slice(0, 6), who: crypto.createHash('sha256').update('sp:' + ip).digest('hex').slice(0, 8), snippet: text.replace(/\s+/g, ' ').slice(0, 120), form };
    await update<SpamLogEntry[]>('spam-log', [], (l) => { l.unshift(entry); l.length = Math.min(l.length, 100); });
  } catch { /* ignore */ }
}
