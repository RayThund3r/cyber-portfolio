// src/lib/studio/look.ts — fonts, skins (extra styling layers) and colour helpers for generated sites.
// Skins come from three production sites; they sit on top of the shared engine stylesheet.

export interface FontDef { id: string; label: string; family: string; /** Google Fonts "family=" value */ spec: string; kind: 'heading' | 'body' }

export const FONTS: FontDef[] = [
  { id: 'playfair', label: 'Playfair Display (elegant serif)', family: 'Playfair Display', spec: 'Playfair+Display:ital,wght@0,500;0,700;1,500', kind: 'heading' },
  { id: 'cormorant', label: 'Cormorant Garamond (luxury serif)', family: 'Cormorant Garamond', spec: 'Cormorant+Garamond:wght@500;600;700', kind: 'heading' },
  { id: 'dmserif', label: 'DM Serif Display (bold serif)', family: 'DM Serif Display', spec: 'DM+Serif+Display', kind: 'heading' },
  { id: 'lora', label: 'Lora (warm serif)', family: 'Lora', spec: 'Lora:wght@500;700', kind: 'heading' },
  { id: 'spacegrotesk', label: 'Space Grotesk (modern)', family: 'Space Grotesk', spec: 'Space+Grotesk:wght@500;700', kind: 'heading' },
  { id: 'poppins-h', label: 'Poppins (friendly geometric)', family: 'Poppins', spec: 'Poppins:wght@500;600;700', kind: 'heading' },
  { id: 'montserrat', label: 'Montserrat (clean)', family: 'Montserrat', spec: 'Montserrat:wght@500;700', kind: 'heading' },
  { id: 'oswald', label: 'Oswald (strong, condensed)', family: 'Oswald', spec: 'Oswald:wght@500;700', kind: 'heading' },
  { id: 'quicksand', label: 'Quicksand (soft, rounded)', family: 'Quicksand', spec: 'Quicksand:wght@400;500;600', kind: 'body' },
  { id: 'archivo', label: 'Archivo (neutral)', family: 'Archivo', spec: 'Archivo:wght@400;500;600', kind: 'body' },
  { id: 'jost', label: 'Jost (airy geometric)', family: 'Jost', spec: 'Jost:wght@400;500;600', kind: 'body' },
  { id: 'inter', label: 'Inter (very readable)', family: 'Inter', spec: 'Inter:wght@400;500;600', kind: 'body' },
  { id: 'dmsans', label: 'DM Sans (modern)', family: 'DM Sans', spec: 'DM+Sans:wght@400;500;700', kind: 'body' },
  { id: 'nunito', label: 'Nunito (friendly)', family: 'Nunito', spec: 'Nunito:wght@400;600', kind: 'body' },
  { id: 'opensans', label: 'Open Sans (classic)', family: 'Open Sans', spec: 'Open+Sans:wght@400;600', kind: 'body' },
  { id: 'worksans', label: 'Work Sans (crisp)', family: 'Work Sans', spec: 'Work+Sans:wght@400;500;600', kind: 'body' },
];
export const fontById = (id: string, kind: 'heading' | 'body') => FONTS.find((f) => f.id === id) ?? FONTS.find((f) => f.kind === kind)!;

export const SKINS: Record<string, { label: string; help: string; css: string }> = {
  soft: { label: 'Soft & rounded', help: 'Pill buttons, rounded hero, italic headings (beauty, fashion, lifestyle).', css: "body{background:radial-gradient(circle at 10% 0,color-mix(in srgb,var(--ac2) 28%,transparent),transparent 40%),var(--bg)}.btn,.chip,.srch{border-radius:40px}.hd h2,.cap h1{font-style:italic;font-weight:500}.sl{margin:14px;border-radius:36px;height:clamp(500px,82vh,780px)}.cap{padding-bottom:96px}.pc{box-shadow:0 6px 24px rgba(224,86,143,.1)}.ph{border-radius:22px;margin:8px;aspect-ratio:1/1.15}.sv>div{background:linear-gradient(160deg,var(--card),color-mix(in srgb,var(--ac2) 22%,var(--card)))}.logo{font-style:italic;font-size:21px}.eyebrow{letter-spacing:.3em}.mas figure,.ab .pic{border-radius:26px}.ab .pic{border-radius:200px 200px 26px 26px}.sh{border-radius:34px 34px 0 0}" },
  bold: { label: 'Bold & sharp', help: 'Uppercase headings, angled hero, hard-edged cards (print, signage, trades).', css: ".hd h2,.cap h1{text-transform:uppercase;font-weight:700;letter-spacing:-.02em}.cap{text-align:left}.sl{clip-path:polygon(0 0,100% 0,100% 94%,0 100%);height:clamp(520px,90vh,840px)}.btn{border-radius:10px;text-transform:uppercase;font-size:13px;letter-spacing:.06em}.pc,.sv>div{border:2px solid var(--ln)}.pc:hover{border-color:var(--ac);box-shadow:8px 8px 0 var(--ac)}.sv>div:hover{border-color:var(--ac)}.eyebrow::before{content:'';display:inline-block;width:28px;height:3px;background:var(--ac);vertical-align:middle;margin-right:10px}.logo{font-weight:700;letter-spacing:.02em}.hd h2{border-left:6px solid var(--ac);padding-left:16px}.ar{border-radius:14px}" },
  classic: { label: 'Classic & elegant', help: 'Square edges, spaced capitals, thin gold rules (events, hospitality, luxury).', css: ".btn{text-transform:uppercase;letter-spacing:.18em;font-size:12px;border-radius:0}.hd h2,.cap h1{font-weight:500;letter-spacing:.01em}.hd{margin-inline:auto;text-align:center}.hd h2::after{content:'';display:block;width:56px;height:2px;background:linear-gradient(90deg,var(--ac),var(--ac2));margin:16px auto 0}.cap{text-align:center}.cap h1,.cap p{margin-inline:auto}.pc,.sv>div,.tm blockquote{border:1px solid var(--ln)}.chip{border-radius:0;letter-spacing:.08em;text-transform:uppercase;font-size:12px}.logo{letter-spacing:.14em;text-transform:uppercase;font-size:16px}.eyebrow{color:var(--ac2)}.pr{font-family:var(--hf),serif;font-size:20px}" },
  clean: { label: 'Clean (no extras)', help: 'The plain engine look, nothing added.', css: '' },
};

/* ── colour helpers (same maths the in-site customiser uses) ── */
const rgb = (h: string) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
export const rgba = (h: string, a: number) => { const [r, g, b] = rgb(h); return `rgba(${r},${g},${b},${a})`; };
export const lum = (h: string) => { const [r, g, b] = rgb(h); return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; };
export const onColor = (ac: string) => (lum(ac) > 0.6 ? '#111111' : '#ffffff');
