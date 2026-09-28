// src/components/SystemStatusBar.tsx
'use client';

import { useState, useEffect } from 'react';

export default function SystemStatusBar() {
  const [windowSize, setWindowSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1920,
    height: typeof window !== 'undefined' ? window.innerHeight : 917,
  });
  const [isOnline, setIsOnline] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [platform, setPlatform] = useState('WIN');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const nav = navigator as any;
      if (nav.platform) {
        const rawPlatform = nav.platform.toUpperCase();
        // Shorten platform string for clean mobile display
        if (rawPlatform.includes('WIN')) setPlatform('WIN');
        else if (rawPlatform.includes('MAC')) setPlatform('MAC');
        else if (rawPlatform.includes('IPHONE') || rawPlatform.includes('IOS')) setPlatform('IOS');
        else if (rawPlatform.includes('ANDROID')) setPlatform('AND');
        else setPlatform('SYS');
      }
      setIsOnline(navigator.onLine);
    }

    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('resize', handleResize);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <div className="w-full bg-zinc-950 border-b border-zinc-800/80 font-mono text-[11px] sm:text-xs select-none">
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="max-w-7xl mx-auto px-4 sm:px-6 py-2 flex items-center justify-between gap-2 cursor-pointer hover:bg-zinc-900/50 transition-colors"
      >
        {/* Left Status */}
        <div className="flex items-center gap-2 shrink-0">
          <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
          <span className={isOnline ? 'text-emerald-400 font-semibold' : 'text-red-400 font-semibold'}>
            {isOnline ? 'ONLINE' : 'OFFLINE'}
          </span>
        </div>

        {/* Center Node (Hidden on very small screens, visible on md+) */}
        <div className="text-zinc-400 hidden md:block">
          NODE: <span className="text-zinc-200">NDEJJE, UG</span>
        </div>

        {/* Right Client Info & Toggle Indicator */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0 overflow-hidden">
          <span className="text-amber-400 truncate max-w-[140px] sm:max-w-none">
            [{platform} | {windowSize.width}px]
          </span>
          <span className="text-zinc-500 text-[10px]">
            {isExpanded ? '[▲]' : '[▼]'}
          </span>
        </div>
      </div>

      {/* Expandable Telemetry Drawer */}
      {isExpanded && (
        <div className="bg-zinc-900/90 border-t border-zinc-800 px-4 sm:px-6 py-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-[11px] text-zinc-300 animate-fadeIn">
          <div>
            <span className="text-cyan-400 font-semibold">// CONNECTION_METRICS</span>
            <p className="text-zinc-400 mt-1">Protocol: HTTPS / Secure TLS</p>
            <p className="text-zinc-400">Network State: {isOnline ? 'Active Uplink' : 'Disconnected'}</p>
          </div>
          <div>
            <span className="text-cyan-400 font-semibold">// NODE_LOCATION</span>
            <p className="text-zinc-400 mt-1">Region: Makindye Ssabagabo, Uganda</p>
            <p className="text-zinc-400">Operations: Mobile & PC Hardware / UI Design</p>
          </div>
          <div>
            <span className="text-cyan-400 font-semibold">// VIEWPORT_PARAMETERS</span>
            <p className="text-zinc-400 mt-1">Exact Resolution: {windowSize.width}x{windowSize.height}px</p>
            <p className="text-zinc-400">Device Pixel Ratio: {typeof window !== 'undefined' ? window.devicePixelRatio : 1}x</p>
          </div>
        </div>
      )}
    </div>
  );
}