// src/context/IntelligenceContext.tsx
'use client';

import React, { createContext, useContext, useState } from 'react';

type PersonaMode = 'EXPERT' | 'HUMAN';

interface IntelligenceContextType {
  mode: PersonaMode;
  toggleMode: () => void;
  translateText: (expertText: string, humanText: string) => string;
}

const IntelligenceContext = createContext<IntelligenceContextType | undefined>(undefined);

export function IntelligenceProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<PersonaMode>('HUMAN'); // Default to warm & approachable!

  const toggleMode = () => {
    setMode((prev) => (prev === 'HUMAN' ? 'EXPERT' : 'HUMAN'));
  };

  const translateText = (expertText: string, humanText: string) => {
    return mode === 'EXPERT' ? expertText : humanText;
  };

  return (
    <IntelligenceContext.Provider value={{ mode, toggleMode, translateText }}>
      {children}
    </IntelligenceContext.Provider>
  );
}

export function useIntelligence() {
  const context = useContext(IntelligenceContext);
  if (!context) {
    throw new Error('useIntelligence must be used within an IntelligenceProvider');
  }
  return context;
}