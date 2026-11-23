// src/utils/chatEngine/handoffText.ts
//
// What leaves the chat when a visitor hands over to the owner (WhatsApp, the send-to-owner card, the contact page).
// Rule: send what is REQUIRED (the worked-out summary, or the visitor's own words about the job), and the raw conversation
// ONLY when the visitor asks for it. Greetings, thanks and one-word replies are never worth sending.
import type { Message } from './types';

const FILLER_WORDS = new Set(['hi', 'hii', 'hello', 'hey', 'yo', 'good', 'morning', 'afternoon', 'evening', 'thanks', 'thank', 'you', 'u', 'ok', 'okay', 'okey', 'cool', 'nice', 'great', 'alright', 'sure', 'yes', 'yeah', 'yep', 'no', 'nope', 'nah', 'bye', 'goodbye', 'lol', 'hmm', 'hmmm', 'k', 'there', 'please', 'then', 'so', 'well', 'oh']);
/** Greetings, thanks and one-word replies ("hi", "ok thanks", "good morning") carry nothing worth forwarding. */
export const isFiller = (t: string) => {
  const w = t.toLowerCase().split(/[\s.,!?;:'"()\-]+/).filter(Boolean);
  return t.trim().length < 3 || w.length === 0 || w.every((x) => FILLER_WORDS.has(x));
};
const clean = (t: string, max: number) => {
  const s = t.replace(/\*\*|__|`/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/\s+/g, ' ').trim();
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
};

/** The visitor's own substantive messages (newest 3, oldest first), without greetings, repeats or the assistant's replies. */
export function visitorPoints(messages: Message[], max = 3): string[] {
  const out: string[] = [];
  for (const m of messages) {
    if (m.sender !== 'user' || !m.text) continue;
    const t = clean(m.text, 220);
    if (isFiller(t) || /^(send (?:this|it) to the owner|continue on whatsapp|book a repair|get a quote)$/i.test(t)) continue;
    if (!out.includes(t)) out.push(t);
  }
  return out.slice(-max);
}

/** A short, readable summary: the assistant's worked-out brief when there is one, else the visitor's own points. */
export function chatSummary(messages: Message[], brief = ''): string {
  const b = brief.trim();
  if (b) return b;
  const pts = visitorPoints(messages);
  return pts.length === 1 ? pts[0] : pts.map((p) => `- ${p}`).join('\n');
}

/** Full recent conversation as plain text, skipping filler. Only used when the visitor chooses to include the history. */
export function chatHistory(messages: Message[], limit = 12, maxChars = 1200): string {
  const lines = messages
    .filter((m) => m.id !== 'welcome' && m.text?.trim() && !(m.sender === 'user' && isFiller(m.text)))
    .slice(-limit)
    .map((m) => `${m.sender === 'user' ? 'Me' : 'Assistant'}: ${clean(m.text, m.sender === 'user' ? 300 : 220)}`);
  let out = lines.join('\n');
  while (out.length > maxChars && lines.length > 2) { lines.shift(); out = lines.join('\n'); }
  return out.slice(-maxChars);
}

/**
 * The WhatsApp message to the owner. Reads like a person wrote it: who, what they need, the useful details,
 * and a clear ask. History is added only when `includeHistory` is true.
 */
export function whatsappMessage(o: { messages: Message[]; brief?: string; includeHistory?: boolean; owner?: string; name?: string }): string {
  const summary = chatSummary(o.messages, o.brief);
  const who = o.name?.trim() ? `Hello ${o.owner || ''}, this is ${o.name.trim()}.`.replace('  ', ' ') : `Hello${o.owner ? ` ${o.owner}` : ''},`;
  const parts: string[] = [`${who} I'm messaging from your website.`];
  if (summary) {
    const multi = summary.includes('\n');
    parts.push(multi ? `Here is what I need:\n${summary}` : `What I need: ${summary}`);
  } else {
    parts.push('I have a question about your services.');
  }
  if (o.includeHistory) {
    const h = chatHistory(o.messages);
    if (h) parts.push(`Our chat so far:\n${h}`);
  }
  parts.push('Could you please get back to me here on WhatsApp? Thank you.');
  return parts.join('\n\n');
}
