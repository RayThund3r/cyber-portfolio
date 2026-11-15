// src/utils/chatEngine/followUp.ts
//
// Short follow-ups lean on the previous question:
//   "how much for a phone screen repair" -> "and for a laptop?"      => "how much for a laptop screen repair"
//   "tell me more about websites"        =>                           "tell me about websites"
// Pure and conservative: it only rewrites when the follow-up swaps a device or a service, and never invents a topic.
import type { SessionMemory } from './types';

const DEVICES = ['iphone', 'ipad', 'macbook', 'android', 'samsung', 'phone', 'laptop', 'tablet', 'desktop', 'computer', 'pc', 'console', 'playstation', 'xbox', 'tv', 'printer', 'watch'];
const SERVICES = ['website', 'web site', 'logo', 'branding', 'poster', 'flyer', 'business card', 'online shop', 'online store', 'app', 'landing page', 'portfolio site'];
const ELLIPSIS = /^(?:and |so |ok and |okay and )?(?:what about|how about|what of|and what about|and for|and with|and if it'?s|what if it'?s|what if its|how about for)\s+(?:for |with |on |if it'?s |if its |if i have |if it is )?(?:a |an |the |my |your )?(.{2,30}?)[?.!\s]*$/i;
const BARE_AND = /^(?:and |also )(?:for |with |on )?(?:a |an |the |my )?(.{2,30}?)[?.!\s]*$/i;
const MORE_ABOUT = /^(?:please )?(?:tell me|say|talk|explain|elaborate)(?: me)? more (?:about|on) (.{2,60}?)[?.!\s]*$/i;

const has = (s: string, w: string) => new RegExp(`\\b${w}s?\\b`, 'i').test(s);
const pick = (s: string, list: string[]) => list.find((w) => has(s, w));

export function lastUserTurn(memory: SessionMemory): string {
  const h = memory.conversationHistory || [];
  for (let i = h.length - 1; i >= 0; i--) if (h[i].role === 'user' && h[i].text.trim().length > 8) return h[i].text.trim();
  return '';
}

export function resolveFollowUp(raw: string, memory: SessionMemory): { text: string; changed: boolean } {
  const s = raw.trim();
  const more = MORE_ABOUT.exec(s);
  if (more) return { text: `tell me about ${more[1]}`, changed: true };

  const m = ELLIPSIS.exec(s) || BARE_AND.exec(s);
  if (!m) return { text: raw, changed: false };
  const prev = lastUserTurn(memory);
  if (!prev || ELLIPSIS.test(prev) || BARE_AND.test(prev)) return { text: raw, changed: false };
  const term = m[1].trim().toLowerCase();

  const nd = pick(term, DEVICES);
  if (nd) {
    const od = pick(prev, DEVICES);
    if (od) return { text: prev.replace(new RegExp(`\\b${od}s?\\b`, 'i'), nd), changed: true };
    if (/\b(?:how much|price|cost|fix|repair|broken|cracked|slow|charge|battery|screen|replace)\b/i.test(prev)) return { text: `${prev.replace(/[?.!\s]+$/, '')} for a ${nd}`, changed: true };
  }
  const ns = pick(term, SERVICES);
  if (ns) {
    const os = pick(prev, SERVICES);
    if (os) return { text: prev.replace(new RegExp(`\\b${os}s?\\b`, 'i'), ns), changed: true };
    if (/\b(?:how much|price|cost|how long|timeline|turnaround|quote)\b/i.test(prev)) return { text: `${prev.replace(/[?.!\s]+$/, '')} for a ${ns}`, changed: true };
  }
  return { text: raw, changed: false };
}
