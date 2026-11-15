// src/components/builder/icons.tsx — small inline stroke icons (1.75 stroke, currentColor) for the builder UI.
// Decorative by default (aria-hidden); put the meaning in the button's aria-label / visible text.
import type { ReactNode } from 'react';

type P = { className?: string; size?: number };

function Svg({ children, className = '', size = 18 }: P & { children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 ${className}`} aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

export const IconLayers = (p: P) => <Svg {...p}><path d="M12 3 3 8l9 5 9-5-9-5Z" /><path d="m3 13 9 5 9-5" /><path d="m3 17.5 9 5 9-5" opacity=".0" /></Svg>;
export const IconPlus = (p: P) => <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>;
export const IconImage = (p: P) => <Svg {...p}><rect x="3" y="4" width="18" height="16" rx="2.5" /><circle cx="9" cy="10" r="1.6" /><path d="m21 16-5-5-8 8" /></Svg>;
export const IconPalette = (p: P) => <Svg {...p}><path d="M12 3a9 9 0 1 0 0 18c1.2 0 1.8-.8 1.8-1.7 0-1.3-1.1-1.6-1.1-2.7 0-.9.7-1.6 1.6-1.6H17a4 4 0 0 0 4-4C21 7 17 3 12 3Z" /><circle cx="7.5" cy="11" r="1" /><circle cx="10" cy="7" r="1" /><circle cx="15" cy="7.5" r="1" /></Svg>;
export const IconSparkle = (p: P) => <Svg {...p}><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z" /><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z" /></Svg>;
export const IconCode = (p: P) => <Svg {...p}><path d="m8 7-5 5 5 5M16 7l5 5-5 5M14 4l-4 16" /></Svg>;
export const IconSettings = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></Svg>;
export const IconDesktop = (p: P) => <Svg {...p}><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></Svg>;
export const IconTablet = (p: P) => <Svg {...p}><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M11 18h2" /></Svg>;
export const IconPhone = (p: P) => <Svg {...p}><rect x="7" y="2.5" width="10" height="19" rx="2.5" /><path d="M11 18.5h2" /></Svg>;
export const IconPencil = (p: P) => <Svg {...p}><path d="M4 20l4-1 11-11a2.1 2.1 0 0 0-3-3L5 16l-1 4Z" /><path d="m14.5 6.5 3 3" /></Svg>;
export const IconEye = (p: P) => <Svg {...p}><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></Svg>;
export const IconEyeOff = (p: P) => <Svg {...p}><path d="M3 3l18 18" /><path d="M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.3 4.2M6.6 6.6A17 17 0 0 0 2 12s3.6 7 10 7a9.7 9.7 0 0 0 4.4-1" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></Svg>;
export const IconUndo = (p: P) => <Svg {...p}><path d="M9 14 4 9l5-5" /><path d="M4 9h10a6 6 0 0 1 0 12h-3" /></Svg>;
export const IconRedo = (p: P) => <Svg {...p}><path d="m15 14 5-5-5-5" /><path d="M20 9H10a6 6 0 0 0 0 12h3" /></Svg>;
export const IconExternal = (p: P) => <Svg {...p}><path d="M14 4h6v6M20 4 10 14" /><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></Svg>;
export const IconDownload = (p: P) => <Svg {...p}><path d="M12 3v12M7 10l5 5 5-5" /><path d="M4 20h16" /></Svg>;
export const IconUpload = (p: P) => <Svg {...p}><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 20h16" /></Svg>;
export const IconClose = (p: P) => <Svg {...p}><path d="M6 6l12 12M18 6 6 18" /></Svg>;
export const IconBack = (p: P) => <Svg {...p}><path d="M15 5l-7 7 7 7" /></Svg>;
export const IconArrowUp = (p: P) => <Svg {...p}><path d="M12 19V5M6 11l6-6 6 6" /></Svg>;
export const IconArrowDown = (p: P) => <Svg {...p}><path d="M12 5v14M6 13l6 6 6-6" /></Svg>;
export const IconChevronDown = (p: P) => <Svg {...p}><path d="m6 9 6 6 6-6" /></Svg>;
export const IconCopy = (p: P) => <Svg {...p}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h9" /></Svg>;
export const IconTrash = (p: P) => <Svg {...p}><path d="M4 7h16M10 11v6M14 11v6" /><path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></Svg>;
export const IconGrip = (p: P) => <Svg {...p}><circle cx="9" cy="6" r=".8" /><circle cx="15" cy="6" r=".8" /><circle cx="9" cy="12" r=".8" /><circle cx="15" cy="12" r=".8" /><circle cx="9" cy="18" r=".8" /><circle cx="15" cy="18" r=".8" /></Svg>;
export const IconLock = (p: P) => <Svg {...p}><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></Svg>;
export const IconCheck = (p: P) => <Svg {...p}><path d="m5 12.5 4.5 4.5L19 7.5" /></Svg>;
export const IconCheckCircle = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="m8 12.5 3 3 5-6" /></Svg>;
export const IconClock = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Svg>;
export const IconWarn = (p: P) => <Svg {...p}><path d="M12 3 2 20h20L12 3Z" /><path d="M12 10v4M12 17.2v.1" /></Svg>;
export const IconBulb = (p: P) => <Svg {...p}><path d="M9 18h6M10 21h4" /><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3Z" /></Svg>;
export const IconSearch = (p: P) => <Svg {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Svg>;
export const IconCart = (p: P) => <Svg {...p}><circle cx="9" cy="20" r="1.4" /><circle cx="18" cy="20" r="1.4" /><path d="M2 3h3l2.7 12.4a1 1 0 0 0 1 .8h8.7a1 1 0 0 0 1-.8L20 8H6" /></Svg>;
export const IconKeyboard = (p: P) => <Svg {...p}><rect x="2.5" y="6" width="19" height="12" rx="2" /><path d="M6 10h.1M10 10h.1M14 10h.1M18 10h.1M7 14h10" /></Svg>;
export const IconPlay = (p: P) => <Svg {...p}><path d="M7 4.5v15l12-7.5-12-7.5Z" /></Svg>;
export const IconRefresh = (p: P) => <Svg {...p}><path d="M20 11a8 8 0 0 0-14.5-3.5L4 9" /><path d="M4 4v5h5" /><path d="M4 13a8 8 0 0 0 14.5 3.5L20 15" /><path d="M20 20v-5h-5" /></Svg>;
export const IconWhatsApp = (p: P) => <Svg {...p}><path d="M3 21l1.6-4.6A8.5 8.5 0 1 1 8 19.6L3 21Z" /><path d="M9 9.5c.3 2 2.5 4.2 4.5 4.5l1.2-1.2-1.7-1-.8.6c-.7-.3-1.3-.9-1.6-1.6l.6-.8-1-1.7L9 9.5Z" /></Svg>;
export const IconHome = (p: P) => <Svg {...p}><path d="M4 11 12 4l8 7" /><path d="M6 10v10h12V10" /></Svg>;
export const IconFolder = (p: P) => <Svg {...p}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" /></Svg>;
export const IconPhoneCall = (p: P) => <Svg {...p}><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" /></Svg>;

/** Category illustrations (the schema keeps emoji for text uses; the UI uses these). */
const CAT: Record<string, (p: P) => JSX.Element> = {
  shop: IconCart,
  booking: (p) => <Svg {...p}><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M8 3v4M16 3v4M3.5 10h17" /></Svg>,
  business: (p) => <Svg {...p}><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M3 13h18" /></Svg>,
  portfolio: IconPalette,
  food: (p) => <Svg {...p}><path d="M7 3v8a2 2 0 0 0 2 2v8M5 3v5M9 3v5M17 21V3c-2 1-3.5 4-3.5 8H17" /></Svg>,
  beauty: (p) => <Svg {...p}><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" /></Svg>,
  startup: (p) => <Svg {...p}><path d="M5 19c0-3 1-5 3-7l5-5a8 8 0 0 1 6-3 8 8 0 0 1-3 6l-5 5c-2 2-4 3-6 4Z" /><circle cx="15" cy="9" r="1.3" /><path d="M5 15l-2 2M9 19l-2 2" /></Svg>,
  events: (p) => <Svg {...p}><path d="M3 21 8 8l8 8-13 5Z" /><path d="M14 4v2M19 9h2M17 6l1.5-1.5M10 4.5V4" /></Svg>,
  realestate: IconHome,
  blank: (p) => <Svg {...p}><rect x="4" y="4" width="16" height="16" rx="2" strokeDasharray="3 3" /></Svg>,
};
export function CategoryIcon({ id, ...p }: P & { id: string }) {
  const C = CAT[id] ?? IconSparkle;
  return <C {...p} />;
}

/* ───────── more chrome icons ───────── */
export const IconTag = (p: P) => <Svg {...p}><path d="M3 12V4h8l10 10-8 8L3 12Z" /><circle cx="7.5" cy="8.5" r="1.2" /></Svg>;
export const IconWallet = (p: P) => <Svg {...p}><path d="M4 7a2 2 0 0 1 2-2h12v4" /><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M16 13.5h2.5" /></Svg>;
export const IconChevronRight = (p: P) => <Svg {...p}><path d="m9 6 6 6-6 6" /></Svg>;
export const IconMinus = (p: P) => <Svg {...p}><path d="M5 12h14" /></Svg>;
export const IconInfo = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8v.1" /></Svg>;
export const IconZip = (p: P) => <Svg {...p}><path d="M6 3h8l4 4v14H6V3Z" /><path d="M14 3v4h4M10 7h2M10 10h2M10 13h2" /><rect x="9.5" y="15" width="3" height="3" rx=".8" /></Svg>;
export const IconWifiOff = (p: P) => <Svg {...p}><path d="M3 3l18 18" /><path d="M5 12.5a10 10 0 0 1 4-2.3M12 5a15 15 0 0 1 10 4M8.5 16a5 5 0 0 1 5-1.2" /><path d="M12 20h.1" /></Svg>;
export const IconShield = (p: P) => <Svg {...p}><path d="M12 3 4 6v6c0 4.5 3.3 8 8 9 4.7-1 8-4.5 8-9V6l-8-3Z" /><path d="m9 12 2 2 4-4" /></Svg>;
export const IconUnlock = (p: P) => <Svg {...p}><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 7.5-2" /></Svg>;
export const IconBlock = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="m5.6 5.6 12.8 12.8" /></Svg>;
export const IconMessage = (p: P) => <Svg {...p}><path d="M4 5h16v11H9l-5 4V5Z" /></Svg>;
export const IconPaperclip = (p: P) => <Svg {...p}><path d="m20 11-8.5 8.500a5 5 0 0 1-7-7L13 4a3.5 3.5 0 0 1 5 5l-8.5 8.500a2 2 0 0 1-3-3L14 7" /></Svg>;
export const IconSend = (p: P) => <Svg {...p}><path d="M21 3 10 14M21 3l-7 18-4-7-7-4 18-7Z" /></Svg>;
export const IconCaretDown = (p: P) => <Svg {...p} size={p.size ?? 14}><path d="m6 9 6 6 6-6" fill="currentColor" /></Svg>;
export const IconCaretRight = (p: P) => <Svg {...p} size={p.size ?? 14}><path d="m9 6 6 6-6 6" fill="currentColor" /></Svg>;
export const IconDuplicate = IconCopy;
export const IconMoney = (p: P) => <Svg {...p}><rect x="2.5" y="6" width="19" height="12" rx="2" /><circle cx="12" cy="12" r="2.6" /><path d="M6 12h.1M18 12h.1" /></Svg>;
export const IconStep = (p: P & { n: number }) => <span className={`inline-flex items-center justify-center rounded-full font-mono text-[11px] font-bold ${p.className ?? ''}`} style={{ width: p.size ?? 22, height: p.size ?? 22 }}>{p.n}</span>;

/** One neutral stroke icon per block type (the schema's emoji stay for generated site content). */
const SEC: Record<string, (p: P) => JSX.Element> = {
  navbar: (p) => <Svg {...p}><rect x="3" y="5" width="18" height="5" rx="1.5" /><path d="M6 7.500h3M14 7.500h4M3 15h18M3 19h12" /></Svg>,
  hero: (p) => <Svg {...p}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 10h7M7 14h4" /><rect x="7" y="16" width="0.1" height="0.1" /></Svg>,
  about: (p) => <Svg {...p}><circle cx="12" cy="8" r="3.5" /><path d="M5 20c0-4 3-6 7-6s7 2 7 6" /></Svg>,
  features: (p) => <Svg {...p}><rect x="3" y="3" width="8" height="8" rx="1.5" /><rect x="13" y="3" width="8" height="8" rx="1.5" /><rect x="3" y="13" width="8" height="8" rx="1.5" /><rect x="13" y="13" width="8" height="8" rx="1.5" /></Svg>,
  stats: (p) => <Svg {...p}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></Svg>,
  gallery: IconImage,
  testimonials: IconMessage,
  pricing: IconTag,
  team: (p) => <Svg {...p}><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.2" /><path d="M3 19c0-3.5 2.7-5 6-5s6 1.5 6 5M15.5 14.200c3 0 5.5 1.2 5.5 4.3" /></Svg>,
  faq: (p) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M9.5 9.500a2.5 2.5 0 1 1 3.5 2.300c-.7.4-1 .9-1 1.700M12 17v.1" /></Svg>,
  cta: (p) => <Svg {...p}><rect x="3" y="7" width="18" height="10" rx="5" /><path d="M9 12h6M13 10l2 2-2 2" /></Svg>,
  text: (p) => <Svg {...p}><path d="M5 6h14M5 11h14M5 16h9" /></Svg>,
  html: IconCode,
  contact: (p) => <Svg {...p}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></Svg>,
  footer: (p) => <Svg {...p}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 15h18M7 18h4" /></Svg>,
};
export function SectionIcon({ type, ...p }: P & { type: string }) {
  const C = SEC[type] ?? IconLayers;
  return <C {...p} />;
}
