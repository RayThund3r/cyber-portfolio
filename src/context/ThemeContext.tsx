// src/context/ThemeContext.tsx
'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { safeLocal } from '@/lib/safeStorage';

export type Theme = 'cyan' | 'amber' | 'emerald';
export const THEMES: Theme[] = ['cyan', 'amber', 'emerald'];
const STORAGE_KEY = 'sys_portfolio_theme';

/** Light / dark appearance, independent of the cyan/amber/emerald accent above. */
export type ColorMode = 'dark' | 'light';
const MODE_KEY = 'sys_portfolio_mode';
/** Browser-chrome colour (phone address bar) for each mode; matches --background. */
const META_COLOR: Record<ColorMode, string> = { dark: '#09090b', light: '#f4f4f5' };

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  /** Move to the next theme (cyan -> amber -> emerald -> cyan). */
  cycleTheme: () => void;
  /** Alias of cycleTheme, kept so other code can call whichever name it expects. */
  toggleTheme: () => void;
  /** Light or dark appearance. Dark is the default. */
  colorMode: ColorMode;
  setColorMode: (mode: ColorMode) => void;
  toggleColorMode: () => void;
  /**
   * Kept for backward compatibility. These now point at theme-token classes
   * (text-accent, border-accent/40 ...) that follow the active theme automatically.
   * Note: Tailwind only generates classes it can see written out in source, so write
   * `hover:text-accent` literally in components instead of `hover:${themeClasses.accent}`.
   */
  themeClasses: {
    accent: string;
    border: string;
    bgGlow: string;
    badge: string;
    /** Literal class strings (not built with template strings) so Tailwind can see them. */
    hoverAccent: string;
    groupHoverAccent: string;
    hoverBorder: string;
  };
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function applyTheme(theme: Theme) {
  try {
    document.documentElement.dataset.theme = theme;
  } catch {
    /* ignore */
  }
}

function applyColorMode(mode: ColorMode, animate = false) {
  try {
    const root = document.documentElement;
    if (animate) {
      // Brief class that cross-fades colours (see globals.css); removed again after the fade.
      root.classList.add('theme-transition');
      window.setTimeout(() => root.classList.remove('theme-transition'), 350);
    }
    root.dataset.mode = mode;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', META_COLOR[mode]);
  } catch {
    /* ignore */
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [theme, setThemeState] = useState<Theme>('cyan');
  const [colorMode, setColorModeState] = useState<ColorMode>('dark');

  useEffect(() => {
    // The inline script in layout.tsx already applied the saved theme before first paint;
    // this just brings React state in line with it.
    const saved = safeLocal.get(STORAGE_KEY) as Theme | null;
    if (saved && THEMES.includes(saved)) {
      setThemeState(saved);
      applyTheme(saved);
    }
  }, []);

  // Same idea for light/dark: the inline script in layout.tsx already set data-mode before paint.
  useEffect(() => {
    const saved = safeLocal.get(MODE_KEY);
    if (saved === 'light' || saved === 'dark') {
      setColorModeState(saved);
      applyColorMode(saved);
    }
  }, []);

  // Next re-renders its <meta name="theme-color"> on navigation; keep it matching the mode.
  useEffect(() => {
    applyColorMode(colorMode);
  }, [pathname, colorMode]);

  const setColorMode = useCallback((next: ColorMode) => {
    if (next !== 'light' && next !== 'dark') return;
    setColorModeState(next);
    applyColorMode(next, true);
    safeLocal.set(MODE_KEY, next);
  }, []);

  const toggleColorMode = useCallback(() => {
    setColorMode(colorMode === 'dark' ? 'light' : 'dark');
  }, [colorMode, setColorMode]);

  const setTheme = useCallback((next: Theme) => {
    if (!THEMES.includes(next)) return;
    setThemeState(next);
    applyTheme(next);
    safeLocal.set(STORAGE_KEY, next);
  }, []);

  const cycleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next = THEMES[(THEMES.indexOf(prev) + 1) % THEMES.length];
      applyTheme(next);
      safeLocal.set(STORAGE_KEY, next);
      return next;
    });
  }, []);

  const value = useMemo<ThemeContextType>(
    () => ({
      theme,
      setTheme,
      cycleTheme,
      toggleTheme: cycleTheme,
      colorMode,
      setColorMode,
      toggleColorMode,
      themeClasses: {
        accent: 'text-accent',
        border: 'border-accent/40',
        bgGlow: 'glow-accent',
        badge: 'bg-accent/10 text-accent border-accent/30',
        hoverAccent: 'hover:text-accent',
        groupHoverAccent: 'group-hover:text-accent',
        hoverBorder: 'hover:border-accent/40',
      },
    }),
    [theme, setTheme, cycleTheme, colorMode, setColorMode, toggleColorMode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
}
