// src/components/layout/ThemeDots.tsx
'use client';

import { THEMES, Theme, useTheme } from '@/context/ThemeContext';

const SWATCH: Record<Theme, string> = {
  cyan: '#22d3ee',
  amber: '#fbbf24',
  emerald: '#34d399',
};

export default function ThemeDots({ className = '' }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  return (
    <div role="group" aria-label="Colour theme" className={`items-center gap-1.5 ${className}`}>
      {THEMES.map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => setTheme(t)}
          aria-label={`${t} theme`}
          aria-pressed={theme === t}
          data-haptic
          title={`${t} theme`}
          className={`h-5 w-5 rounded-full border-2 transition-transform duration-200 hover:scale-110 active:scale-95 ${
            theme === t ? 'border-zinc-100 scale-110' : 'border-zinc-700'
          }`}
          style={{ backgroundColor: SWATCH[t] }}
        />
      ))}
    </div>
  );
}
