// src/components/ui/Icon.tsx
//
// Small inline SVG icon set (no dependency, inherits currentColor) used in place of emojis across the site.
// The chat widget keeps its own emoji on purpose.
import type { SVGProps } from 'react';

const PATHS = {
  chat: <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" />,
  home: <path d="M3 11.5 12 4l9 7.5M5.5 10v10h13V10M10 20v-6h4v6" />,
  wrench: <path d="M14.7 6.3a4 4 0 0 0 5 5l-9.4 9.4a2.1 2.1 0 0 1-3-3l9.4-9.4a4 4 0 0 0-2-2Z" />,
  search: <path d="m21 21-4.3-4.3M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z" />,
  shield: <path d="M12 3 4.5 6v5.5c0 4.6 3.1 8 7.5 9.5 4.4-1.5 7.5-4.9 7.5-9.5V6L12 3Zm-3 9 2.2 2.2L15.5 10" />,
  clock: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13.5V12l3 2" />,
  cpu: <path d="M8 8h8v8H8zM4 9h2M4 15h2M18 9h2M18 15h2M9 4v2M15 4v2M9 18v2M15 18v2" />,
  battery: <path d="M3 8.5h15v7H3zM18 11h3v2h-3M6 11v2" />,
  phone: <path d="M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm3 15h2" />,
  bolt: <path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12L13 2Z" />,
  droplet: <path d="M12 3s6 6.2 6 10.5a6 6 0 0 1-12 0C6 9.2 12 3 12 3Z" />,
  disk: <path d="M4 7c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3Zm0 0v10c0 1.7 3.6 3 8 3s8-1.3 8-3V7M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
  spark: <path d="M12 3v4m0 10v4M3 12h4m10 0h4m-14.5-6.5 2.8 2.8m6.4 6.4 2.8 2.8m0-12-2.8 2.8m-6.4 6.4-2.8 2.8" />,
  star: <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3Z" />,
  heart: <path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20Z" />,
  key: <path d="M14.5 9.5a4.5 4.5 0 1 1-1.3-3.2M13.2 9.5H21m-3 0v3m-4-3v2" />,
  globe: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm-9-9h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9S9.5 5.5 12 3Z" />,
  lock: <path d="M6.5 10.5h11v9h-11zM8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />,
  bell: <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15L6 16.5ZM10 20.5h4" />,
  cube: <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Zm0 9 8-4.5M12 12 4 7.5M12 12v9" />,
  flag: <path d="M6 21V4m0 1h11l-2.5 4L17 13H6" />,
  grid: <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />,
  brain: <path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 4.5A3 3 0 0 0 9 20a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3Zm6 0a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 4.5A3 3 0 0 1 15 20a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3Z" />,
  undo: <path d="M9 7 4 12l5 5M4 12h11a5 5 0 0 1 0 10h-3" />,
  lightbulb: <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.700.6 1 1.2 1 2.1h5c0-.900.3-1.5 1-2.1A6 6 0 0 0 12 3Z" />,
  refresh: <path d="M20 11a8 8 0 0 0-14.5-3.5M4 4v4h4M4 13a8 8 0 0 0 14.5 3.5M20 20v-4h-4" />,
  play: <path d="M7 4.5v15l12-7.5-12-7.5Z" />,
  trophy: <path d="M8 4h8v5a4 4 0 0 1-8 0V4Zm-3 1H8m8 0h3M5 5c0 3 1 4 3 4m11-4c0 3-1 4-3 4M12 13v4m-3.5 3h7M10 17h4" />,
  puzzle: <path d="M10 4h4v3a2 2 0 1 0 0 4h3v4h-3a2 2 0 1 0-4 0H7v-4a2 2 0 1 0 0-4V4h3Z" />,
} as const;

export type IconName = keyof typeof PATHS;

export default function Icon({ name, size = 18, className = '', ...rest }: { name: IconName; size?: number } & Omit<SVGProps<SVGSVGElement>, 'name'>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={`inline-block shrink-0 ${className}`}
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}
