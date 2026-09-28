// src/context/ThemeContext.tsx
'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

type Theme = 'cyan' | 'amber' | 'emerald';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  themeClasses: {
    accent: string;
    border: string;
    bgGlow: string;
    badge: string;
  };
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('cyan');

  useEffect(() => {
    // Check if a theme was previously saved by the user
    const savedTheme = localStorage.getItem('sys_portfolio_theme') as Theme;
    if (savedTheme && ['cyan', 'amber', 'emerald'].includes(savedTheme)) {
      setThemeState(savedTheme);
    }
  }, []);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem('sys_portfolio_theme', newTheme);
  };

  const themeClasses = {
    cyan: { accent: 'text-cyan-400', border: 'border-cyan-500/40', bgGlow: 'shadow-[0_0_20px_rgba(6,182,212,0.2)]', badge: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' },
    amber: { accent: 'text-amber-400', border: 'border-amber-500/40', bgGlow: 'shadow-[0_0_20px_rgba(245,158,11,0.2)]', badge: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
    emerald: { accent: 'text-emerald-400', border: 'border-emerald-500/40', bgGlow: 'shadow-[0_0_20px_rgba(16,185,129,0.2)]', badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
  }[theme];

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themeClasses }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
}