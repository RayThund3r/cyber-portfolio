// src/server/repairsDemo.ts — sample before / after jobs shown on the site until the owner adds real ones in Admin → Build → Repairs.
// Drawn here (no files, no storage); they disappear as soon as the first real job is saved.
import type { RepairItem } from './repairs';

const F = "font-family='Helvetica,Arial,sans-serif'";
const svg = (body: string) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 600' width='800' height='600'><rect width='800' height='600' fill='#0f1115'/>${body}<text x='776' y='578' text-anchor='end' ${F} font-size='15' letter-spacing='2' fill='#fff' opacity='.5'>SAMPLE</text></svg>`;
const phone = (cracked: boolean) => `<rect x='270' y='50' width='260' height='500' rx='40' fill='#1b1f27' stroke='#3b4252' stroke-width='4'/><rect x='288' y='84' width='224' height='432' rx='20' fill='${cracked ? '#0b0d12' : '#0e7490'}'/>${cracked
  ? "<path d='M400 120 L360 250 L430 320 L380 470 M360 250 L290 230 M430 320 L505 300 M400 120 L470 200 L505 300' stroke='#9ca3af' stroke-width='3' fill='none'/><path d='M330 180 L480 420' stroke='#6b7280' stroke-width='2'/>"
  : `<circle cx='400' cy='260' r='70' fill='#22d3ee' opacity='.9'/><rect x='320' y='380' width='160' height='16' rx='8' fill='#fff' opacity='.85'/><rect x='345' y='410' width='110' height='12' rx='6' fill='#fff' opacity='.5'/>`}`;
const laptop = (dusty: boolean) => `<rect x='140' y='110' width='520' height='330' rx='20' fill='#1b1f27' stroke='#3b4252' stroke-width='4'/><rect x='162' y='132' width='476' height='286' rx='8' fill='${dusty ? '#1f2937' : '#0e7490'}'/><path d='M80 470 H720 L690 510 H110Z' fill='#2b303b'/>${dusty
  ? "<text x='400' y='290' text-anchor='middle' " + F + " font-size='34' fill='#9ca3af'>Overheating</text><text x='400' y='335' text-anchor='middle' " + F + " font-size='22' fill='#6b7280'>fan stuck, very slow</text><g fill='#6b7280' opacity='.55'><circle cx='200' cy='490' r='5'/><circle cx='320' cy='480' r='4'/><circle cx='460' cy='492' r='6'/><circle cx='580' cy='483' r='4'/></g>"
  : "<text x='400' y='290' text-anchor='middle' " + F + " font-size='34' fill='#ecfeff'>Cool and fast</text><text x='400' y='335' text-anchor='middle' " + F + " font-size='22' fill='#a5f3fc'>cleaned, fresh Windows</text>"}`;
const logo = (polished: boolean) => polished
  ? `<rect width='800' height='600' fill='#0b2e2b'/><circle cx='400' cy='260' r='130' fill='none' stroke='#2dd4bf' stroke-width='18'/><path d='M310 270 Q355 215 400 270 T490 270' fill='none' stroke='#f5f5f4' stroke-width='18' stroke-linecap='round'/><text x='400' y='480' text-anchor='middle' ${F} font-size='64' font-weight='800' letter-spacing='8' fill='#f5f5f4'>HARBOR</text>`
  : `<rect width='800' height='600' fill='#e5e7eb'/><ellipse cx='400' cy='250' rx='140' ry='110' fill='#93c5fd' stroke='#1e3a8a' stroke-width='4'/><text x='400' y='270' text-anchor='middle' font-family='Times,serif' font-size='40' fill='#1e3a8a'>Harbor coffee</text><text x='400' y='450' text-anchor='middle' font-family='Times,serif' font-size='28' fill='#374151' font-style='italic'>best coffee in town!!</text>`;

const D: { item: RepairItem; before: string; after: string }[] = [
  { item: { id: 'demo-phone', title: 'Cracked phone screen replaced', note: 'Same-day fix, original-quality screen', kind: 'repair', shown: true, w: 800, h: 600, v: 1 }, before: svg(phone(true)), after: svg(phone(false)) },
  { item: { id: 'demo-laptop', title: 'Overheating laptop serviced', note: 'Fan cleaned, fresh thermal paste, Windows reinstalled', kind: 'repair', shown: true, w: 800, h: 600, v: 1 }, before: svg(laptop(true)), after: svg(laptop(false)) },
  { item: { id: 'demo-logo', title: 'Logo redesign', note: 'From a rough draft to a mark that works on a sign', kind: 'design', shown: true, w: 800, h: 600, v: 1 }, before: svg(logo(false)), after: svg(logo(true)) },
];
export const demoRepairs = (): RepairItem[] => D.map((d) => d.item);
export const demoRepairSvg = (id: string, side: 'before' | 'after'): string | null => { const d = D.find((x) => x.item.id === id); return d ? d[side] : null; };
