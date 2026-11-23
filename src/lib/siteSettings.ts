// src/lib/siteSettings.ts
//
// Everything about the public site that the owner can change from Admin → SETTINGS without touching code: business details,
// opening hours, social links, an maintenance mode, search-engine text and a few on/off switches.
// Isomorphic (types, defaults and the validator); the server stores it, the layout passes it to every page.
import { safeLink } from './safeText';

export interface SiteSettings {
  business: { name: string; tagline: string; phone: string; whatsapp: string; email: string; address: string; hours: string };
  social: { instagram: string; facebook: string; tiktok: string; youtube: string; x: string };
  maintenance: { enabled: boolean; message: string };
  seo: { title: string; description: string };
  features: { chat: boolean; builder: boolean; smartPricing: boolean; dragDrop: boolean };
}

export const DEFAULT_SETTINGS: SiteSettings = {
  business: { name: '', tagline: '', phone: '', whatsapp: '', email: '', address: '', hours: '' },
  social: { instagram: '', facebook: '', tiktok: '', youtube: '', x: '' },
  maintenance: { enabled: false, message: 'We are making some improvements and will be back shortly. Thank you for your patience.' },
  seo: { title: '', description: '' },
  features: { chat: true, builder: true, smartPricing: false, dragDrop: false },
};

const t = (v: unknown, max: number) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const digits = (v: unknown, max: number) => String(v ?? '').replace(/[^\d+\-()\s]/g, '').trim().slice(0, max);

/** Rebuilds settings from anything (a form, a stored file): unknown keys dropped, links must be https:// or /path, text length-limited. */
export function normalizeSettings(input: unknown): SiteSettings {
  const s = (input && typeof input === 'object' ? input : {}) as any;
  const d = DEFAULT_SETTINGS;
  // a handle like mybrand, or a full https:// link. Anything else with a scheme (javascript:, http:, data:…) is dropped, not "cleaned".
  const handle = (v: unknown) => { const x = t(v, 200); if (/^https:\/\//i.test(x)) return safeLink(x, 200); if (/:/.test(x)) return ''; return x.replace(/^@/, '').replace(/[^A-Za-z0-9._\-/]/g, '').slice(0, 60); };
  return {
    business: {
      name: t(s.business?.name, 60), tagline: t(s.business?.tagline, 120), phone: digits(s.business?.phone, 30), whatsapp: String(s.business?.whatsapp ?? '').replace(/\D/g, '').slice(0, 15),
      email: /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(String(s.business?.email ?? '').trim()) ? String(s.business.email).trim().slice(0, 100) : '', address: t(s.business?.address, 160), hours: t(s.business?.hours, 120),
    },
    social: { instagram: handle(s.social?.instagram), facebook: handle(s.social?.facebook), tiktok: handle(s.social?.tiktok), youtube: handle(s.social?.youtube), x: handle(s.social?.x) },
    maintenance: { enabled: !!s.maintenance?.enabled, message: t(s.maintenance?.message, 400) || d.maintenance.message },
    seo: { title: t(s.seo?.title, 70), description: t(s.seo?.description, 170) },
    features: { chat: s.features?.chat !== false, builder: s.features?.builder !== false, smartPricing: s.features?.smartPricing === true, dragDrop: s.features?.dragDrop === true },
  };
}
