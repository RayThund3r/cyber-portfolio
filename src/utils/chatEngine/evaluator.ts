// src/utils/chatEngine/evaluator.ts
//
// Safety & quality gates.
//
// The original filter blocked any message containing hack / crack / virus / bypass /
// stolen / threat / illegal... That caught real abuse but also blocked a repair shop's own
// customers ("cracked screen", "virus removal", "my phone was stolen"). This version keeps
// every one of those concerns but reads the CONTEXT:
//
//   hard block      building malware, DDoS, phishing kits, breaking into other people's accounts
//   piracy          cracked / pirated software           -> polite no + legit alternatives
//   IMEI tampering  changing / cleaning IMEIs            -> no
//   stolen devices  victim -> practical help; buying/unlocking/reselling -> no
//   lock bypass     FRP / iCloud / PIN / pattern         -> owner-only, handled in person
//   threats         violence toward people               -> calm de-escalation
//   crisis / prompt-injection                            -> handled separately
//
// Everything else ("cracked screen", "remove a virus", "what is phishing",
// "my account was hacked") passes through to the normal answers.

import { normalize, tokens, tokenMatch } from './text';

type Kind = 'harmful' | 'injection' | 'crisis' | 'piracy' | 'imei' | 'stolen' | 'lock' | 'threat';

const BLOCKED_INTENTS: RegExp[] = [
  /\bhack(ing)? (into|someone|somebody|my ex|his|her|their|a (phone|account|wifi|wi-fi|website|server))\b/,
  /\bhack (the |my |his |her |their |someone'?s )?(wifi|wi-fi|facebook|whatsapp|instagram|tiktok|gmail|snapchat|account|password|phone)\b/,
  /\bhow (to|do i|can i|do you) hack\b/,
  /\bddos\b/,
  /\bphishing (page|site|link|kit|email|website)\b/,
  /\b(write|make|create|build|code|generate|develop) (me )?(a |an )?(malware|virus|ransomware|keylogger|trojan|botnet|spyware|rat|worm)\b/,
  /\b(steal|get into|break into|access|read|spy on|track) (a |the |his |her |their |someone'?s |somebody'?s |my (ex|wife|husband|girlfriend|boyfriend|partner)'?s? )(passwords?|accounts?|wifi password|messages|whatsapp|phone|location)\b/,
  /\bexploit (a |the )?(vulnerability|server|site|website)\b/,
  /\bspy on (my )?(wife|husband|girlfriend|boyfriend|partner|ex)\b/,
];

/** Building weapons / explosives / drugs. ("bath bomb", "photo bomb" are fine.) */
const WEAPONS: RegExp[] = [
  /\b(make|making|build|building|construct|assemble|create|manufacture|synthesi[sz]e|cook|produce)\b[^.]{0,40}\b(?<!bath )(?<!photo )(bomb|explosives?|molotov|grenade|napalm|nerve agent|ghost gun|silencer|thermite|detonator|meth|methamphetamine)\b/,
  /\bhow (?:to|do i|can i) (?:make|build|get) (?:a |an )?(?:pipe bomb|bomb|explosive|molotov)\b/,
];

const INJECTION: RegExp[] = [
  /ignore (all |the |your )?(previous|prior|above|earlier) (instructions|rules|prompt)/,
  /(reveal|show|print|repeat|tell me) (me )?(your )?(system|hidden|initial) (prompt|instructions)/,
  /\bjailbreak\b|\bdan mode\b/,
];

const CRISIS: RegExp[] = [
  /\b(kill myself|end my life|suicide|suicidal|want to die|self harm|self-harm|hurt myself)\b/,
];

const THREAT: RegExp[] = [
  /\bi(?:'?ll| will|'?m going to| am going to|'?m gonna| am gonna) (?:kill|hurt|stab|shoot|beat|burn)\b[^.]*\b(?:him|her|them|you|someone|somebody|everyone|my (?:boss|wife|husband|ex|neighbou?r|friend|brother|sister|teacher))\b/,
  /\bi want to (?:kill|hurt) (?:him|her|them|someone|somebody)\b/,
];

const IMEI_TAMPER = /\b(change|changing|clean|cleaning|rewrite|repair|flash|spoof|fake|null|remove|reset)\b[^.]*\bimei\b/;

const PIRACY_WORD = /\b(crack(?:ed|s)?|keygen|key ?gen|pirat(?:e|ed)|torrent(?:ed)?|nulled|warez|activator|kms ?(?:pico|auto)?)\b/;
const SOFTWARE_WORD = /\b(photoshop|illustrator|windows|office|microsoft|adobe|software|softwares|game|games|premiere|after effects|coreldraw|autocad|license|licence|activation|serial|idm|winrar|antivirus|vpn|app|apps|program|programs)\b/;
const PHYSICAL_DAMAGE_WORD = /\b(screen|display|glass|casing|back|corner|hinge|body|frame|lcd|digitizer|camera lens)\b/;

const STOLEN_ABUSE =
  /\b(buy|bought|buying|sell|selling|resell|unlock|flash|clear|clean|remove|blacklist(?:ed)?|whitelist|bypass)\b[^.]*\b(stolen|snatched)\b|\b(stolen|snatched)\b[^.]*\b(unlock|flash|bypass|resell|sell|selling|blacklist(?:ed)?|clean|whitelist)\b/;
const STOLEN_VICTIM =
  /\b(my|our|i)\b[^.]*\b(stolen|stole|snatched|robbed|pickpocketed|mugged)\b|\b(stolen|stole|snatched|robbed|pickpocketed|mugged)\b[^.]*\b(my|our)\b/;

const LOCK_ACTION = /\b(bypass|remove|unlock|reset|get past|get around|crack|forgot(?:ten)?|locked out of|break)\b/;
const LOCK_TERMS = new RegExp(
  '\\b(?:frp|icloud(?: lock)?|activation lock|google (?:account|lock)|(?:screen|pattern|fingerprint|face) ?lock|(?:phone|screen|unlock|lock screen) pattern|(?:phone|sim|screen|lock screen) (?:pin|passcode|password)|(?:windows|laptop|pc|computer|bios) password|mdm|network lock|sim lock|passcode)\\b'
);

function pick(mode: string, human: string, expert: string): string {
  return mode === 'EXPERT' ? expert : human;
}

export interface EvaluationResult {
  isSafe: boolean;
  isRelevant: boolean;
  redirectReply?: string;
}

export function evaluateInputSafety(
  input: string,
  mode: string
): { isSafe: boolean; safeReply?: string; kind?: Kind } {
  if (!input) return { isSafe: true };
  const clean = normalize(input);

  if (CRISIS.some((r) => r.test(clean))) {
    return {
      isSafe: false,
      kind: 'crisis',
      safeReply: pick(
        mode,
        "I'm really sorry you're feeling this way, and I'm glad you said something. I'm just a website assistant, so I can't give you the support you deserve — please reach out to someone you trust right now, or call the emergency numbers 112 or 999 in Uganda (or your local emergency number if you're elsewhere). You don't have to carry this alone. 💛",
        'SYS_CARE // I am a website assistant and cannot help with this properly, but your safety matters. Please call 112 / 999 (Uganda) or your local emergency number, or contact someone you trust right now.'
      ),
    };
  }

  if (INJECTION.some((r) => r.test(clean))) {
    return {
      isSafe: false,
      kind: 'injection',
      safeReply: pick(
        mode,
        "I can't share or change my internal setup — but I'm happy to help with repairs, design, web projects or general questions!",
        'SYS_POLICY // Internal configuration is not disclosed. Ask a task-related question.'
      ),
    };
  }

  if (WEAPONS.some((r) => r.test(clean))) {
    return {
      isSafe: false,
      kind: 'harmful',
      safeReply: pick(
        mode,
        "I can't help with making weapons, explosives or drugs. I'm happy to help with repairs, design, web projects or general questions though — what do you need?",
        'SYS_POLICY // Request violates policy (weapons / explosives). Terminated.'
      ),
    };
  }

  if (BLOCKED_INTENTS.some((r) => r.test(clean))) {
    return {
      isSafe: false,
      kind: 'harmful',
      safeReply: pick(
        mode,
        "I can't help with hacking or getting into someone else's accounts or devices. I can help with legit stuff though — repairs, recovering **your own** locked-out account, design, and web projects. What do you need?",
        'SYS_SECURITY_ALERT // Request violates policy (unauthorised access / malicious tooling). Terminated. Authorised repair, design and engineering services only.'
      ),
    };
  }

  if (THREAT.some((r) => r.test(clean))) {
    return {
      isSafe: false,
      kind: 'threat',
      safeReply: pick(
        mode,
        "That sounds like you're really angry right now, and I can't help with hurting anyone. Step away for a few minutes and breathe. If someone is in immediate danger, please contact your local emergency services.",
        'SYS_POLICY // Violent intent detected. Request terminated. If anyone is in immediate danger, contact emergency services.'
      ),
    };
  }

  if (IMEI_TAMPER.test(clean)) {
    return {
      isSafe: false,
      kind: 'imei',
      safeReply: pick(
        mode,
        "I can't help with changing, cleaning or rewriting IMEI numbers — it's illegal in many places and it's how stolen phones get passed on. If you're having a network or SIM problem with your own phone, tell me what's happening and I'll help you troubleshoot.",
        'SYS_POLICY // IMEI modification is not supported. Provide network/SIM symptoms for legitimate diagnostics.'
      ),
    };
  }

  if (PIRACY_WORD.test(clean) && SOFTWARE_WORD.test(clean) && !PHYSICAL_DAMAGE_WORD.test(clean)) {
    return {
      isSafe: false,
      kind: 'piracy',
      safeReply: pick(
        mode,
        "I can't help with cracked or pirated software — it's the #1 way PCs and phones pick up malware, and the licence side isn't worth the risk. 🙅 There are good free options: **GIMP / Krita** (photo editing and painting), **Inkscape** (vector design), **LibreOffice** (office documents), **Blender** (3D) and the free plan of **Figma** for UI work. I can help you set one up or pick the right tool.",
        'SYS_POLICY // Cracked/pirated software not supported (malware vector). Alternatives: GIMP, Krita, Inkscape, LibreOffice, Blender, Figma (free plan).'
      ),
    };
  }

  if (STOLEN_ABUSE.test(clean)) {
    return {
      isSafe: false,
      kind: 'stolen',
      safeReply: pick(
        mode,
        "I can't help with unlocking, flashing, buying or selling a device that's reported stolen. If it's **your** phone that was taken, report it to the police and ask your network provider to block the SIM and the phone (they'll need the IMEI).",
        'SYS_POLICY // Handling of stolen devices not supported. Owner: report to police and have the carrier blacklist the IMEI.'
      ),
    };
  }

  if (STOLEN_VICTIM.test(clean)) {
    return {
      isSafe: false,
      kind: 'stolen',
      safeReply: pick(
        mode,
        "I'm sorry that happened. 😔 Here's what helps most, in this order:\n1. **Lock and track it** remotely with Find My Device (Android) or Find My iPhone (Apple) from another device\n2. **Call your network provider** to block the SIM and blacklist the phone's IMEI (the IMEI is on the box, receipt, or by dialling *#06# on a similar phone you own)\n3. **Report it to the police** and keep the case number\n4. **Change passwords** for your email, social media and mobile-money accounts\n\nThe sooner you do 1 and 2, the better.",
        'SYS_INCIDENT // Theft response: 1) remote lock/erase via Find My Device/iPhone. 2) Carrier: block SIM + blacklist IMEI. 3) File police report. 4) Rotate credentials (email, social, mobile money).'
      ),
    };
  }

  if (LOCK_ACTION.test(clean) && LOCK_TERMS.test(clean)) {
    return {
      isSafe: false,
      kind: 'lock',
      safeReply: pick(
        mode,
        "If it's **your own device**, I can help — reach out through the contact section and expect to be asked for proof that it's yours (receipt, box or ID). 🔐 I can't walk you through bypassing locks in this chat, and I won't help unlock a device that isn't yours. Want me to take you to the contact section?",
        'SYS_POLICY // Lock removal is owner-only and handled in person with proof of ownership. Not supported via chat.'
      ),
    };
  }

  return { isSafe: true };
}

/* ------------------------------------------------------------------ */
/* Retrieved web text                                                  */
/* ------------------------------------------------------------------ */

// Only genuinely unsafe topics. We deliberately do NOT reject articles just for containing
// words like "virus", "hack" or "crack" — "Computer virus" is a perfectly good answer for a
// repair shop's chat.
const UNSAFE_RESULT_TOPICS =
  /\b(pornograph\w*|sexually explicit|child sexual|hardcore|erotic|bomb[- ]making|how to (?:make|build) (?:a |an )?(?:bomb|explosive|weapon)|improvised explosive)\b/i;

/** Is a retrieved web snippet worth showing for this query? */
export function evaluateSearchResultQuality(
  rawSearchText: string | null,
  query: string,
  mode: string,
  title?: string
): EvaluationResult {
  const fallback = pick(
    mode,
    "I'm not sure about that one. Could you rephrase it?",
    `SYS_EVAL // Low confidence for "${query}".`
  );

  if (!rawSearchText || rawSearchText.length < 30) {
    return { isSafe: true, isRelevant: false, redirectReply: fallback };
  }

  if (UNSAFE_RESULT_TOPICS.test(rawSearchText) || UNSAFE_RESULT_TOPICS.test(title || '')) {
    return {
      isSafe: false,
      isRelevant: false,
      redirectReply: pick(
        mode,
        "I found some results, but they didn't meet safety standards. I'm happy to help you with technical device troubleshooting or creative branding instead!",
        'SYS_CONTENT_FILTER // Retrieved telemetry failed safety evaluation.'
      ),
    };
  }

  // The article title (or its first sentence) must share a meaningful word with the question.
  const qTokens = tokens(query);
  const hay = tokens((title || '') + ' ' + rawSearchText.slice(0, 200));
  const overlap = qTokens.filter((q) => hay.some((h) => tokenMatch(q, h)));
  if (qTokens.length > 0 && overlap.length === 0) {
    return { isSafe: true, isRelevant: false, redirectReply: fallback };
  }

  if (/\bmay refer to\b/.test(rawSearchText.slice(0, 160))) {
    return { isSafe: true, isRelevant: false, redirectReply: fallback };
  }

  return { isSafe: true, isRelevant: true };
}
