// src/components/RepairShowcase.tsx
'use client';

import { useState } from 'react';
import { useTheme } from '@/context/ThemeContext';

interface RepairItem {
  id: string;
  title: string;
  device: string;
  issue: string;
  solution: string;
  beforeImage: string;
  afterImage: string;
  metrics: string;
}

const REPAIR_CASES: RepairItem[] = [
  {
    id: 'REP-01',
    title: 'Severe Liquid Damage & Motherboard Short Circuit',
    device: 'HP Omen 15 Series',
    issue: 'Corrosion on main power rail, unbootable, shorted MOSFETs.',
    solution: 'Ultrasonic bath cleaning, component-level micro-soldering, and trace jumper repair.',
    beforeImage: 'https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?auto=format&fit=crop&w=800&q=80', // placeholder or your repair photo
    afterImage: 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?auto=format&fit=crop&w=800&q=80',
    metrics: 'RESTORED // 100% OPERATIONAL'
  },
  {
    id: 'REP-02',
    title: 'Shattered Display & Flex Cable Assembly',
    device: 'iPhone 11 Personal Device / Client Unit',
    issue: 'Total touch digitizer failure, cracked glass matrix, backlight burnout.',
    solution: 'Precision OLED screen replacement and TrueTone EEPROM programmer data transfer.',
    beforeImage: 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?auto=format&fit=crop&w=800&q=80',
    afterImage: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=800&q=80',
    metrics: 'CALIBRATED // OEM SPECS'
  }
];

export default function RepairShowcase() {
  const { themeClasses } = useTheme();
  const [activeCase, setActiveCase] = useState<RepairItem>(REPAIR_CASES[0]);
  const [sliderPosition, setSliderPosition] = useState(50); // percentage for before/after view

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-8 py-12 border-t border-zinc-900 font-mono">
      <div className="mb-8">
        <span className={`text-[10px] sm:text-xs uppercase tracking-wider ${themeClasses.accent}`}>
          HARDWARE_LAB // RESTORATION ARCHIVE
        </span>
        <h2 className="text-xl sm:text-3xl font-bold tracking-tight mt-1 text-zinc-100">
          Component-Level Repair Transformations
        </h2>
        <p className="text-xs sm:text-sm text-zinc-400 mt-2 font-sans">
          Real diagnostic case files demonstrating hardware recovery, micro-soldering, and performance restoration.
        </p>
      </div>

      {/* Case Selector Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {REPAIR_CASES.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveCase(item)}
            className={`px-4 py-2 rounded text-xs transition-all border ${
              activeCase.id === item.id 
                ? `${themeClasses.badge} font-bold` 
                : 'bg-zinc-900/50 border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            [{item.id}] {item.device}
          </button>
        ))}
      </div>

      {/* Interactive Display Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-6">
        {/* Visual Preview / Simulated Comparison */}
        <div className="lg:col-span-7 relative h-72 sm:h-96 rounded-lg overflow-hidden bg-zinc-950 border border-zinc-800 flex items-center justify-center">
          {/* After Image (Base) */}
          <img 
            src={activeCase.afterImage} 
            alt="Restored Hardware" 
            className="absolute inset-0 w-full h-full object-cover opacity-80"
          />
          <div className="absolute bottom-3 right-3 bg-zinc-950/90 border border-zinc-800 px-3 py-1 rounded text-[10px] text-emerald-400">
            [STATE: RESTORED]
          </div>
          <div className="absolute top-3 left-3 bg-zinc-950/90 border border-zinc-800 px-3 py-1 rounded text-[10px] text-zinc-400">
            {activeCase.metrics}
          </div>
        </div>

        {/* Diagnostic Metadata Panel */}
        <div className="lg:col-span-5 flex flex-col justify-between space-y-4">
          <div>
            <div className="text-[10px] text-zinc-500 mb-1">CASE_ID: {activeCase.id}</div>
            <h3 className="text-lg font-bold text-zinc-100">{activeCase.title}</h3>
            
            <div className="mt-4 space-y-3 text-xs">
              <div className="p-3 bg-zinc-950 border border-zinc-800/80 rounded">
                <span className="text-red-400 font-semibold block mb-1">// DIAGNOSTIC_FAILURE</span>
                <p className="text-zinc-400 font-sans">{activeCase.issue}</p>
              </div>

              <div className="p-3 bg-zinc-950 border border-zinc-800/80 rounded">
                <span className="text-cyan-400 font-semibold block mb-1">// SOLUTION_APPLIED</span>
                <p className="text-zinc-400 font-sans">{activeCase.solution}</p>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-500">
            <span>NODE: NDEJJE, UG</span>
            <span className={themeClasses.accent}>DIAGNOSTIC_VERIFIED</span>
          </div>
        </div>
      </div>
    </section>
  );
}