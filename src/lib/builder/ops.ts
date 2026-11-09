// src/lib/builder/ops.ts — the ONLY way the AI (or the offline assistant) can change a site.
//
// The AI returns a list of small, validated operations. `applyOps` runs them on a copy of the config and then
// re-sanitizes everything, so a hallucinating or prompt-injected model can never produce unsafe or malformed
// output: unknown operations are skipped, unknown fields are dropped, URLs/colours/enums are re-validated.
// Isomorphic: used by the server (real AI) and the browser (offline assistant).
import { CATEGORIES, FONT_PAIRS, PALETTES, SECTION_DEFS, SECTION_ORDER, newSection, type Field, type SectionInstance, type SectionType, type SiteConfig } from './schema';
import { sanitizeConfig, type SanitizeCtx } from './sanitize';

export type Op = { op: string; [k: string]: any };
export interface ApplyResult { config: SiteConfig; applied: string[]; skipped: string[] }
export interface ApplyCtx extends SanitizeCtx {
  /** Custom CSS/JS/HTML is only allowed when the user explicitly enabled “AI may write code” (guards against prompt injection from uploaded files). */
  allowCode?: boolean;
}

const MAX_OPS = 200;
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const obj = (v: unknown): Record<string, any> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, any>) : {});
const pick = (values: unknown, allowed: string[]) => Object.fromEntries(Object.entries(obj(values)).filter(([k]) => allowed.includes(k)));
const label = (s: SectionInstance) => SECTION_DEFS[s.type].label;

function findSection(cfg: SiteConfig, raw: Op): SectionInstance | undefined {
  const byId = typeof raw.id === 'string' ? cfg.sections.find((s) => s.id === raw.id) : undefined;
  if (byId) return byId;
  const type = raw.type as SectionType;
  return type && SECTION_DEFS[type] ? cfg.sections.find((s) => s.type === type && s.visible) ?? cfg.sections.find((s) => s.type === type) : undefined;
}

export function applyOps(input: SiteConfig, ops: unknown, ctx: ApplyCtx = {}): ApplyResult {
  const cfg = clone(input);
  const applied: string[] = [];
  const skipped: string[] = [];
  const list = Array.isArray(ops) ? ops.slice(0, MAX_OPS) : [];
  const body = () => cfg.sections.filter((s) => s.type !== 'navbar' && s.type !== 'footer');

  for (const raw of list) {
    const op = String(raw?.op || '');
    try {
      switch (op) {
        case 'setTheme':
          Object.assign(cfg.theme, pick(raw.values, Object.keys(cfg.theme)));
          applied.push('Updated the look & feel');
          break;
        case 'applyPalette': {
          const p = PALETTES.find((x) => x.id === raw.id);
          if (!p) { skipped.push(`unknown palette ${raw.id}`); break; }
          cfg.theme = { ...cfg.theme, mode: p.mode, primary: p.primary, secondary: p.secondary, bg: p.bg, alt: p.alt, text: p.text };
          applied.push(`Applied the ${p.label} colour theme`);
          break;
        }
        case 'setBrand': Object.assign(cfg.brand, pick(raw.values, ['name', 'logo'])); applied.push('Updated the brand'); break;
        case 'setMeta': Object.assign(cfg.meta, pick(raw.values, ['title', 'description', 'lang', 'favicon'])); applied.push('Updated page title & description'); break;
        case 'setCode':
          if (!ctx.allowCode) { skipped.push('custom code is off — turn on “Let AI write code” first'); break; }
          cfg.code = { ...cfg.code, ...pick(raw.values, ['css', 'js', 'head']) } as SiteConfig['code']; applied.push('Updated custom code'); break;

        case 'setSection': {
          const s = findSection(cfg, raw);
          if (!s) { skipped.push('setSection: section not found'); break; }
          if (s.type === 'html' && !ctx.allowCode) { skipped.push('custom HTML is off — turn on “Let AI write code” first'); break; }
          s.data = { ...s.data, ...pick(raw.values, SECTION_DEFS[s.type].fields.map((f) => f.key)) };
          applied.push(`Edited “${label(s)}”`);
          break;
        }
        case 'addSection': {
          const type = raw.type as SectionType;
          const def = SECTION_DEFS[type];
          if (!def || def.fixed) { skipped.push(`addSection: bad type ${raw.type}`); break; }
          if (type === 'html' && !ctx.allowCode) { skipped.push('custom HTML is off — turn on “Let AI write code” first'); break; }
          const s = newSection(type, pick(raw.values, def.fields.map((f) => f.key)));
          let at = cfg.sections.length - 1; // before the footer
          if (typeof raw.afterId === 'string') { const i = cfg.sections.findIndex((x) => x.id === raw.afterId); if (i >= 0) at = i + 1; }
          else if (Number.isInteger(raw.index)) at = Math.min(Math.max(1, raw.index + 1), cfg.sections.length - 1);
          cfg.sections.splice(at, 0, s);
          applied.push(`Added a “${def.label}” section`);
          break;
        }
        case 'removeSection': {
          const s = findSection(cfg, raw);
          if (!s || SECTION_DEFS[s.type].fixed) { skipped.push('removeSection: not allowed / not found'); break; }
          cfg.sections = cfg.sections.filter((x) => x !== s);
          applied.push(`Removed “${label(s)}”`);
          break;
        }
        case 'toggleSection': {
          const s = findSection(cfg, raw);
          if (!s || SECTION_DEFS[s.type].fixed) { skipped.push('toggleSection: not allowed / not found'); break; }
          s.visible = raw.visible !== false;
          applied.push(`${s.visible ? 'Showed' : 'Hid'} “${label(s)}”`);
          break;
        }
        case 'moveSection': {
          const s = findSection(cfg, raw);
          if (!s || SECTION_DEFS[s.type].fixed || !Number.isInteger(raw.toIndex)) { skipped.push('moveSection: bad request'); break; }
          const b = body().filter((x) => x !== s);
          b.splice(Math.min(Math.max(0, raw.toIndex), b.length), 0, s);
          cfg.sections = [cfg.sections[0], ...b, cfg.sections[cfg.sections.length - 1]];
          applied.push(`Moved “${label(s)}”`);
          break;
        }
        case 'setSections': {
          // Rebuild the whole page body (e.g. "build my site from this document"). Navbar & footer stay.
          const incoming = Array.isArray(raw.sections) ? raw.sections.slice(0, 30) : [];
          const next: SectionInstance[] = [];
          for (const it of incoming) {
            const def = SECTION_DEFS[it?.type as SectionType];
            if (!def || def.fixed || (it.type === 'html' && !ctx.allowCode)) continue;
            next.push(newSection(it.type, pick(it.values, def.fields.map((f) => f.key))));
          }
          if (!next.length) { skipped.push('setSections: nothing valid'); break; }
          cfg.sections = [cfg.sections[0], ...next, cfg.sections[cfg.sections.length - 1]];
          applied.push(`Rebuilt the page with ${next.length} sections`);
          break;
        }
        default:
          skipped.push(op ? `unknown operation “${op.slice(0, 30)}”` : 'empty operation');
      }
    } catch {
      skipped.push(`${op}: failed`);
    }
  }
  return { config: sanitizeConfig(cfg, ctx), applied: [...new Set(applied)], skipped };
}

/* ───────── what the AI is told about the schema / current site ───────── */
function fieldDoc(f: Field): string {
  if (f.type === 'select') return `${f.key}(${f.options!.map((o) => o.value).join('|')})`;
  if (f.type === 'list') return `${f.key}[{${f.fields!.map(fieldDoc).join(', ')}}]`;
  return `${f.key}(${f.type}${f.max ? `≤${f.max}` : ''})`;
}
export function schemaDoc(): string {
  const types = SECTION_ORDER.map((t) => `- ${t}: ${SECTION_DEFS[t].fields.filter((f) => f.group !== 'style').map(fieldDoc).join(', ')}; style: bg(default|alt|primary|dark), space(compact|normal|spacious), navLabel(text)`);
  return [
    'SECTION TYPES (fields you may set):', ...types,
    '- navbar (fixed, always first): sticky(bool), style(solid|transparent), ctaText, ctaUrl',
    '- footer (fixed, always last): about, links[{label,url}], facebook, instagram, x, youtube, tiktok, linkedin, copyright',
    `THEME KEYS: mode(light|dark), primary/secondary/bg/alt/text (#rrggbb), fontPair(${FONT_PAIRS.map((f) => f.id).join('|')}), radius(none|sm|md|lg|pill), btnStyle(solid|outline), animations(bool), smooth(bool)`,
    `PALETTE IDS: ${PALETTES.map((p) => p.id).join(', ')}`,
    'BRAND KEYS: name, logo(image)   META KEYS: title, description, lang(en|sw|fr|ar|pt), favicon(emoji)   CODE KEYS: css, js, head',
    'Image/URL fields accept https URLs, "#section", mailto:/tel: or (images only) "asset:xxxxxxxx" ids that exist.',
    `CATEGORIES (info): ${CATEGORIES.map((c) => c.id).join(', ')}`,
  ].join('\n');
}

/** Compact view of the current site for the model (long strings clipped, lists shortened). */
export function compactConfig(cfg: SiteConfig): unknown {
  const clip = (v: any, depth = 0): any => {
    if (typeof v === 'string') return v.length > 220 ? v.slice(0, 220) + `…(${v.length} chars)` : v;
    if (Array.isArray(v)) return v.slice(0, 12).map((x) => clip(x, depth + 1)).concat(v.length > 12 ? [`…+${v.length - 12} more`] : []);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, clip(x, depth + 1)]));
    return v;
  };
  return clip({ meta: cfg.meta, brand: cfg.brand, theme: cfg.theme, sections: cfg.sections.map((s) => ({ id: s.id, type: s.type, visible: s.visible, data: s.data })), code: { css: `${cfg.code.css.length} chars`, js: `${cfg.code.js.length} chars`, head: `${cfg.code.head.length} chars` } });
}

/* ───────── offline assistant (no API key needed) ───────── */
const NAME_TO_TYPE: [RegExp, SectionType][] = [
  [/\b(faq|questions)\b/, 'faq'], [/\b(pricing|prices|plans|price list)\b/, 'pricing'], [/\b(gallery|photos|pictures)\b/, 'gallery'],
  [/\b(team|staff|people)\b/, 'team'], [/\b(testimonials?|reviews?)\b/, 'testimonials'], [/\b(stats|numbers|statistics)\b/, 'stats'],
  [/\b(contact|get in touch)\b/, 'contact'], [/\b(about|story)\b/, 'about'], [/\b(services|features|offerings)\b/, 'features'],
  [/\b(banner|cta|call to action)\b/, 'cta'], [/\b(hero|header)\b/, 'hero'], [/\b(custom html|html)\b/, 'html'], [/\b(text block|text section)\b/, 'text'],
];
const COLOURS: Record<string, { id?: string; values?: Record<string, any> }> = {
  blue: { id: 'ocean' }, ocean: { id: 'ocean' }, orange: { id: 'sunset' }, sunset: { id: 'sunset' }, green: { id: 'forest' }, forest: { id: 'forest' },
  purple: { id: 'royal' }, violet: { id: 'royal' }, royal: { id: 'royal' }, brown: { id: 'coffee' }, coffee: { id: 'coffee' }, black: { id: 'mono' }, mono: { id: 'mono' }, minimal: { id: 'mono' },
  dark: { id: 'midnight' }, midnight: { id: 'midnight' }, neon: { id: 'neon' },
  red: { values: { primary: '#dc2626', secondary: '#f97316' } }, pink: { values: { primary: '#ec4899', secondary: '#a855f7' } },
  yellow: { values: { primary: '#eab308', secondary: '#f59e0b' } }, teal: { values: { primary: '#0d9488', secondary: '#0ea5e9' } },
};

export function localAssistant(prompt: string, cfg: SiteConfig): { message: string; ops: Op[] } {
  const text = prompt.trim();
  const q = text.toLowerCase();
  const ops: Op[] = [];
  const say: string[] = [];
  const hero = cfg.sections.find((s) => s.type === 'hero');
  const quoted = (m: RegExpMatchArray | null) => (m ? m[1].trim().replace(/^["“']|["”']$/g, '') : '');

  const name = quoted(q.match(/(?:rename (?:it|the site|my site)(?: to)?|call (?:it|the site|my (?:site|business|shop))|(?:business|company|site|shop) name (?:is|to)|my (?:business|company|shop|site) is(?: called)?)\s+["“]?([^"”.,\n]{2,40})/i) && text.match(/(?:rename (?:it|the site|my site)(?: to)?|call (?:it|the site|my (?:site|business|shop))|(?:business|company|site|shop) name (?:is|to)|my (?:business|company|shop|site) is(?: called)?)\s+["“]?([^"”.,\n]{2,40})/i));
  if (name) { ops.push({ op: 'setBrand', values: { name } }); say.push(`named the site “${name}”`); }

  const head = text.match(/(?:change|set|make|update)\s+(?:the\s+)?(?:headline|main title|hero title|title)\s+(?:to|as)\s+["“]?(.{3,120}?)["”]?\s*$/i);
  if (head && hero) { ops.push({ op: 'setSection', id: hero.id, values: { title: head[1] } }); say.push('updated the headline'); }
  const sub = text.match(/(?:change|set|make|update)\s+(?:the\s+)?(?:sub-?headline|subtitle|tagline|slogan)\s+(?:to|as)\s+["“]?(.{3,300}?)["”]?\s*$/i);
  if (sub && hero) { ops.push({ op: 'setSection', id: hero.id, values: { subtitle: sub[1] } }); say.push('updated the sub-headline'); }

  if (/\b(dark|midnight)\b.*\b(mode|theme|look)?|\bdark mode\b/.test(q) && !/\blight\b/.test(q)) { ops.push({ op: 'applyPalette', id: 'midnight' }); say.push('switched to a dark theme'); }
  else if (/\blight (mode|theme)\b/.test(q)) { ops.push({ op: 'applyPalette', id: 'ocean' }); say.push('switched to a light theme'); }
  else {
    const c = q.match(/\b(blue|ocean|orange|sunset|green|forest|purple|violet|royal|brown|coffee|black|mono|minimal|neon|red|pink|yellow|teal)\b/);
    if (c && /\b(colou?r|theme|make it|palette|look|style)\b/.test(q)) {
      const m = COLOURS[c[1]];
      ops.push(m.id ? { op: 'applyPalette', id: m.id } : { op: 'setTheme', values: m.values });
      say.push(`used a ${c[1]} colour theme`);
    }
  }
  const font = q.match(/\b(modern|elegant|tech|friendly|bold|classic|system)\b\s*(?:font|fonts|typography)|(?:font|fonts|typography)\s*(?:to|:)?\s*(modern|elegant|tech|friendly|bold|classic|system)\b/);
  if (font) { const id = font[1] || font[2]; if (FONT_PAIRS.some((f) => f.id === id)) { ops.push({ op: 'setTheme', values: { fontPair: id } }); say.push(`switched to the ${id} fonts`); } }
  if (/\b(square|sharp)\b.*\bcorners?\b/.test(q)) { ops.push({ op: 'setTheme', values: { radius: 'none' } }); say.push('made corners square'); }
  else if (/\b(round(ed)?|soft)\b.*\bcorners?\b|\bpill\b/.test(q)) { ops.push({ op: 'setTheme', values: { radius: /pill/.test(q) ? 'pill' : 'lg' } }); say.push('rounded the corners'); }
  if (/\b(turn off|disable|no|remove|stop)\b.*\banimations?\b/.test(q)) { ops.push({ op: 'setTheme', values: { animations: false } }); say.push('turned animations off'); }
  else if (/\b(turn on|enable|add)\b.*\banimations?\b/.test(q)) { ops.push({ op: 'setTheme', values: { animations: true } }); say.push('turned animations on'); }

  const secType = (s: string) => NAME_TO_TYPE.find(([re]) => re.test(s))?.[1];
  const add = q.match(/\b(?:add|insert|create|include)\b\s+(?:a|an|the|some)?\s*([a-z /]+?)\s*(?:section|block|area)?\s*$/);
  if (add && secType(add[1])) { ops.push({ op: 'addSection', type: secType(add[1]) }); say.push(`added a ${secType(add[1])} section`); }
  const rem = q.match(/\b(?:remove|delete|get rid of)\b\s+(?:the\s+)?([a-z /]+?)\s*(?:section|block|area)?\s*$/);
  if (rem && secType(rem[1]) && !add) { ops.push({ op: 'removeSection', type: secType(rem[1]) }); say.push(`removed the ${secType(rem[1])} section`); }
  const hide = q.match(/\b(hide|show)\b\s+(?:the\s+)?([a-z /]+?)\s*(?:section|block|area)?\s*$/);
  if (hide && secType(hide[2])) { ops.push({ op: 'toggleSection', type: secType(hide[2]), visible: hide[1] === 'show' }); say.push(`${hide[1] === 'show' ? 'showed' : 'hid'} the ${secType(hide[2])} section`); }

  if (!ops.length) {
    return {
      message: 'I can do simple changes without an AI connection — for example: “make it green”, “dark mode”, “add a FAQ section”, “remove the gallery”, “hide the team section”, “change the headline to Fresh bread daily”, “call my business Mama Pima Bakery”, “elegant fonts”, “square corners”. For writing whole pages, translating, or reading uploaded documents, the owner needs to connect an AI key (see AI_* settings).',
      ops: [],
    };
  }
  return { message: `Done — I ${say.join(', ')}.`, ops };
}
