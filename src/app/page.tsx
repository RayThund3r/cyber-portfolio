// src/app/page.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { FEATURED_PROJECTS, TECH_STACK } from '@/data/portfolioData';
import { useTheme } from '@/context/ThemeContext';

export default function HomePage() {
  const { theme, setTheme, themeClasses } = useTheme();
  
  const [commandInput, setCommandInput] = useState('');
  const [terminalOutput, setTerminalOutput] = useState<string>('SYS_READY. Type "help", "specs", "hack", "joke", or "theme".');
  const [isHacking, setIsHacking] = useState(false);
  
  // Real-time client telemetry state
  const [clientSpecs, setClientSpecs] = useState({
    os: 'DETECTING...',
    resolution: 'DETECTING...',
    cores: 'N/A',
    memory: 'N/A',
    platform: 'N/A'
  });

  useEffect(() => {
    const ua = navigator.userAgent;
    let detectedOS = 'UNKNOWN_OS';
    if (ua.includes('Win')) detectedOS = 'WINDOWS_NT';
    else if (ua.includes('Mac')) detectedOS = 'MACOS';
    else if (ua.includes('Linux')) detectedOS = 'LINUX';
    else if (ua.includes('Android')) detectedOS = 'ANDROID';
    else if (ua.includes('like Mac') || ua.includes('iPhone')) detectedOS = 'iOS';

    setClientSpecs({
      os: detectedOS,
      resolution: `${window.innerWidth}x${window.innerHeight}px`,
      cores: navigator.hardwareConcurrency ? `${navigator.hardwareConcurrency} Cores` : 'RESTRICTED',
      memory: (navigator as any).deviceMemory ? `${(navigator as any).deviceMemory} GB+ RAM` : 'STANDARD',
      platform: navigator.platform || 'WEB_CLIENT'
    });
  }, []);

  const handleCommandSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = commandInput.trim().toLowerCase();
    
    if (cmd === 'help') {
      setTerminalOutput('CMDS: [portfolio] [services] [specs] [os] [ping] [hack] [joke] [theme cyan|amber|emerald] [clear]');
    } else if (cmd === 'portfolio' || cmd === 'projects') {
      window.location.href = '/portfolio';
    } else if (cmd === 'services') {
      window.location.href = '/services';
    } else if (cmd === 'contact') {
      window.location.href = '/contact';
    } else if (cmd === 'specs') {
      setTerminalOutput(`CLIENT_SPECS: OS: [${clientSpecs.os}] | RES: [${clientSpecs.resolution}] | THREADS: [${clientSpecs.cores}]`);
    } else if (cmd === 'os') {
      setTerminalOutput(`PLATFORM: ${clientSpecs.platform} | ESTIMATED RAM: ${clientSpecs.memory}`);
    } else if (cmd === 'ping') {
      setTerminalOutput(`NETWORK_LATENCY: 14ms // NODE: NDEJJE SECURE RELAY // STATUS: OPTIMAL`);
    } else if (cmd === 'joke') {
      const jokes = [
        "Why do programmers prefer dark mode? Because light attracts bugs.",
        "There are 10 types of people in the world: those who understand binary, and those who don't.",
        "Hardware: The part of a computer that you can kick when the software fails.",
        "A SQL query walks into a bar, walks up to two tables and asks: 'Can I join you?'"
      ];
      setTerminalOutput(`JOKE: ${jokes[Math.floor(Math.random() * jokes.length)]}`);
    } else if (cmd === 'hack') {
      setIsHacking(true);
      setTerminalOutput('INITIATING TRACE... BYPASSING MAINFRAME FIREWALL...');
      setTimeout(() => setTerminalOutput('SCANNING CLIENT TELEMETRY... ACCESS GRANTED. YOU ARE IN.'), 1500);
      setTimeout(() => setIsHacking(false), 2500);
    } else if (cmd.startsWith('theme')) {
      const parts = cmd.split(' ');
      if (['cyan', 'amber', 'emerald'].includes(parts[1])) {
        setTheme(parts[1] as any);
        setTerminalOutput(`THEME_SHIFT: System accent updated to ${parts[1].toUpperCase()}.`);
      } else {
        setTerminalOutput('USAGE: theme [cyan | amber | emerald]');
      }
    } else if (cmd === 'clear') {
      setTerminalOutput('SYS_READY.');
    } else {
      setTerminalOutput(`ERR: "${cmd}" NOT RECOGNIZED. TYPE "help" FOR COMMAND LIST.`);
    }
    setCommandInput('');
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-cyan-500 selection:text-black animate-page-in">
      {/* Responsive Top Navigation */}
      <nav className="sticky top-0 z-50 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-800/80 transition-all duration-300">
        <div className="flex items-center justify-between px-4 sm:px-8 py-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-2 group cursor-pointer">
            <div className={`w-2.5 h-2.5 rounded-full animate-pulse ${theme === 'cyan' ? 'bg-cyan-400 shadow-[0_0_10px_#22d3ee]' : theme === 'amber' ? 'bg-amber-400 shadow-[0_0_10px_#fbbf24]' : 'bg-emerald-400 shadow-[0_0_10px_#34d399]'}`}></div>
            <span className={`font-mono text-xs sm:text-sm font-bold tracking-widest ${themeClasses.accent} group-hover:opacity-80 transition-opacity`}>
              SYS_PORTFOLIO.v1
            </span>
          </div>
          
          <div className="flex items-center gap-3 sm:gap-6 font-mono text-xs">
            <Link href="/portfolio" className="text-zinc-400 hover:text-zinc-100 transition-colors hidden xs:inline hover:-translate-y-0.5 transform duration-200">
              [PORTFOLIO]
            </Link>
            <Link href="/services" className="text-zinc-400 hover:text-zinc-100 transition-colors hidden xs:inline hover:-translate-y-0.5 transform duration-200">
              [SERVICES]
            </Link>
            <Link 
              href="/contact" 
              className={`px-3.5 py-2 rounded font-semibold transition-all duration-300 border ${themeClasses.badge} ${themeClasses.bgGlow} hover:scale-105 active:scale-95`}
            >
              INITIATE_CONTACT →
            </Link>
          </div>
        </div>
      </nav>

      {/* Dynamic Live Diagnostic Ticker Bar */}
      <div className="bg-zinc-900/60 border-b border-zinc-800/80 py-2 font-mono text-[11px] text-zinc-400 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 flex items-center justify-between gap-6 whitespace-nowrap overflow-x-auto [&::-webkit-scrollbar]:hidden">
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-2 text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              SYSTEM_STATUS: ONLINE
            </span>
            <span>NODE: NDEJJE, UG</span>
            <span className={themeClasses.accent}>CLIENT: [{clientSpecs.os} | {clientSpecs.resolution}]</span>
          </div>
          <div className={`${themeClasses.accent} font-semibold hidden md:block`}>
            SECURE_ENVIRONMENT // 100% OPERATIONAL
          </div>
        </div>
      </div>

      {/* Hero Command Hub Section */}
      <header className="max-w-7xl mx-auto px-4 sm:px-8 pt-12 sm:pt-20 pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-7 max-w-2xl transform transition-all duration-700 hover:translate-x-1">
            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded bg-zinc-900 border border-zinc-800 font-mono text-[10px] sm:text-xs mb-6 ${themeClasses.accent} animate-cyber-glow`}>
              <span>STATUS: ONLINE // HARDWARE TECH & CREATIVE UI/UX HUB</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-zinc-100 leading-tight">
              Engineering digital systems & hardware precision.
            </h1>
            <p className="mt-6 text-sm sm:text-lg text-zinc-400 leading-relaxed font-sans">
              Specialized technical repair technician and multi-disciplinary designer bridging high-performance UI/UX engineering with advanced mobile and PC diagnostic systems.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-4 font-mono text-xs">
              <Link
                href="/portfolio"
                className={`px-6 py-3.5 font-semibold rounded text-center transition-all duration-300 shadow-lg hover:scale-105 active:scale-95 ${theme === 'cyan' ? 'bg-cyan-500 text-black hover:bg-cyan-400 shadow-cyan-500/20' : theme === 'amber' ? 'bg-amber-500 text-black hover:bg-amber-400 shadow-amber-500/20' : 'bg-emerald-500 text-black hover:bg-emerald-400 shadow-emerald-500/20'}`}
              >
                EXPLORE_ARCHIVE →
              </Link>
              <Link
                href="/services"
                className="px-6 py-3.5 bg-zinc-900 border border-zinc-800 text-zinc-300 rounded text-center hover:border-zinc-700 hover:text-zinc-100 transition-all duration-300 hover:scale-105 active:scale-95"
              >
                VIEW_SERVICES_&_PRICING
              </Link>
            </div>
          </div>

          {/* Interactive Client Diagnostic & Easter Egg Terminal */}
          <div className={`lg:col-span-5 bg-zinc-900/40 border rounded-xl p-4 sm:p-5 font-mono shadow-2xl transition-all duration-500 hover:border-zinc-700 ${isHacking ? 'border-red-500/80 shadow-[0_0_30px_rgba(239,68,68,0.3)]' : themeClasses.border}`}>
            <div className="flex items-center justify-between mb-3 text-[11px] text-zinc-500 border-b border-zinc-800 pb-2">
              <span>INTERACTIVE_TERMINAL // v2.5</span>
              <span className={isHacking ? 'text-red-400 animate-ping' : themeClasses.accent}>
                {isHacking ? 'BREACH_DETECTED' : 'ONLINE'}
              </span>
            </div>
            <div className={`text-xs bg-zinc-950 p-3 rounded border border-zinc-800/80 mb-3 min-h-[60px] flex items-center transition-all duration-300 ${isHacking ? 'text-red-400 font-bold' : themeClasses.accent}`}>
              {terminalOutput}
            </div>
            <form onSubmit={handleCommandSubmit} className="flex gap-2">
              <span className={`${themeClasses.accent} text-xs self-center`}>guest@node:~#</span>
              <input 
                type="text" 
                placeholder="type 'help', 'hack', 'joke', 'specs'..." 
                value={commandInput}
                onChange={(e) => setCommandInput(e.target.value)}
                className="w-full bg-transparent text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none"
              />
              <button type="submit" className={`px-3 py-1 rounded text-xs transition-all duration-200 border hover:scale-105 ${themeClasses.badge}`}>
                RUN
              </button>
            </form>
            <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-zinc-500 border-t border-zinc-900 pt-3">
              <span>Quick:</span>
              <button onClick={() => setTerminalOutput(`SPECS: OS: ${clientSpecs.os} | RES: ${clientSpecs.resolution} | RAM: ${clientSpecs.memory}`)} className={`${themeClasses.accent} hover:underline`}>[specs]</button>
              <button onClick={() => { setTerminalOutput('JOKE: Why did the computer cross the road? Because it was hooked to the wrong mouse!'); }} className={`${themeClasses.accent} hover:underline`}>[joke]</button>
              <button onClick={() => { setTheme(theme === 'cyan' ? 'amber' : theme === 'amber' ? 'emerald' : 'cyan'); }} className={`${themeClasses.accent} hover:underline`}>[toggle theme]</button>
              <button onClick={() => { window.location.href='/contact'; }} className={`${themeClasses.accent} hover:underline`}>[contact]</button>
            </div>
          </div>
        </div>
      </header>

      {/* Technical Expertise Matrix Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-8 py-10 border-t border-zinc-900">
        <div className="mb-6">
          <span className={`text-[10px] sm:text-xs font-mono uppercase tracking-wider ${themeClasses.accent}`}>
            SYSTEM_CAPABILITIES // CORE PROFICIENCIES
          </span>
          <h2 className="text-lg sm:text-2xl font-bold tracking-tight text-zinc-100 mt-1">
            Operational Stack & Tooling
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 font-mono text-xs">
          {TECH_STACK.map((tech, index) => (
            <div 
              key={index} 
              className={`bg-zinc-900/50 border border-zinc-800/80 p-4 rounded-lg flex items-center justify-between transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:${themeClasses.border}`}
            >
              <div>
                <span className="text-zinc-200 font-semibold block">{tech.label}</span>
                <span className="text-[10px] text-zinc-500">TAG: [{tech.category}]</span>
              </div>
              <span className={`px-2 py-1 rounded text-[10px] border ${themeClasses.badge}`}>
                {tech.level}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Featured Projects Preview Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-8 py-12 border-t border-zinc-900">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
          <div>
            <span className={`text-[10px] sm:text-xs font-mono uppercase tracking-wider ${themeClasses.accent}`}>
              CURATED_WORK // SYSTEM PREVIEWS
            </span>
            <h2 className="text-xl sm:text-3xl font-bold tracking-tight mt-1 text-zinc-100">
              Featured Operational Modules
            </h2>
          </div>
          <Link href="/portfolio" className={`text-xs font-mono hover:underline inline-flex items-center gap-1 ${themeClasses.accent}`}>
            VIEW_ALL_PROJECTS ({FEATURED_PROJECTS.length}) →
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {FEATURED_PROJECTS.map((project) => (
            <div 
              key={project.id}
              className={`group bg-zinc-900/40 border border-zinc-800/80 rounded-xl overflow-hidden transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl hover:${themeClasses.border} flex flex-col justify-between`}
            >
              <div>
                <div className="h-48 overflow-hidden relative bg-zinc-950">
                  <img 
                    src={project.image} 
                    alt={project.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 opacity-80 group-hover:opacity-100"
                  />
                  <div className={`absolute top-3 left-3 bg-zinc-950/80 backdrop-blur-sm border border-zinc-800 px-2.5 py-1 rounded text-[10px] font-mono ${themeClasses.accent}`}>
                    [{project.category}]
                  </div>
                </div>
                <div className="p-5">
                  <div className="text-[10px] font-mono text-zinc-500 mb-1">ID: {project.id}</div>
                  <h3 className={`text-lg font-bold text-zinc-100 group-hover:${themeClasses.accent} transition-colors`}>
                    {project.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-zinc-400 mt-2 line-clamp-2">
                    {project.description}
                  </p>
                </div>
              </div>
              
              <div className="p-5 pt-0 flex items-center justify-between border-t border-zinc-800/50 mt-4">
                <span className={`text-[10px] font-mono opacity-80 ${themeClasses.accent}`}>{project.metrics}</span>
                <Link 
                  href="/portfolio" 
                  className={`text-xs font-mono text-zinc-300 group-hover:${themeClasses.accent} transition-colors inline-flex items-center gap-1 group-hover:translate-x-1 duration-200`}
                >
                  DETAILS <span>→</span>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-4 sm:px-8 py-10 mt-16 border-t border-zinc-900 flex flex-col sm:flex-row items-center justify-between text-xs font-mono text-zinc-500 gap-4">
        <div>SYS_PORTFOLIO.v1 // SECURE ENVIRONMENT</div>
        <div className="flex gap-4">
          <Link href="/portfolio" className="hover:text-zinc-100 transition-colors">PORTFOLIO</Link>
          <Link href="/services" className="hover:text-zinc-100 transition-colors">SERVICES</Link>
          <Link href="/contact" className="hover:text-zinc-100 transition-colors">CONTACT</Link>
        </div>
      </footer>
    </div>
  );
}