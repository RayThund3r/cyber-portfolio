// src/app/page.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { TECH_STACK } from '@/data/portfolioData';
import { useProjects } from '@/context/ProjectsContext';
import ProjectImage from '@/components/ProjectImage';
import { THEMES, Theme, useTheme } from '@/context/ThemeContext';
import { openChat } from '@/lib/chatBus';
import { portfolioUrl } from '@/lib/siteUrls';
import { useScramble, useTilt } from '@/lib/useGsapEffects';


const JOKES = [
  'Why do programmers prefer dark mode? Because light attracts bugs.',
  "There are 10 types of people in the world: those who understand binary, and those who don't.",
  'Hardware: The part of a computer that you can kick when the software fails.',
  "A SQL query walks into a bar, walks up to two tables and asks: 'Can I join you?'",
];

const delay = (ms: number) => ({ '--d': `${ms}ms` } as React.CSSProperties);

/** Order matters: Android/iOS user agents also contain "Linux" / "Mac OS X". */
function detectOS(ua: string): string {
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
  if (/Android/i.test(ua)) return 'ANDROID';
  if (/Win/i.test(ua)) return 'WINDOWS_NT';
  if (/Mac/i.test(ua)) return 'MACOS';
  if (/Linux|X11|CrOS/i.test(ua)) return 'LINUX';
  return 'UNKNOWN_OS';
}

export default function HomePage() {
  const router = useRouter();
  const { setTheme, cycleTheme, setColorMode, toggleColorMode } = useTheme();
  // Featured projects come from the CMS (/admin) and fall back to the built-in list.
  const { featured: FEATURED_PROJECTS } = useProjects();
  const pageRef = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);
  const history = useRef<string[]>([]);
  const historyIdx = useRef(-1);

  const [commandInput, setCommandInput] = useState('');
  const [terminalOutput, setTerminalOutput] = useState<string>('SYS_READY. Type "help", "specs", "hack", "joke", or "theme".');
  const [isHacking, setIsHacking] = useState(false);

  // Real-time client telemetry state
  const [clientSpecs, setClientSpecs] = useState({
    os: 'DETECTING...',
    resolution: 'DETECTING...',
    cores: 'N/A',
    memory: 'N/A',
    platform: 'N/A',
  });

  useEffect(() => {
    setClientSpecs({
      os: detectOS(navigator.userAgent),
      resolution: `${window.innerWidth}x${window.innerHeight}px`,
      cores: navigator.hardwareConcurrency ? `${navigator.hardwareConcurrency} Cores` : 'RESTRICTED',
      memory: (navigator as any).deviceMemory ? `${(navigator as any).deviceMemory} GB+ RAM` : 'STANDARD',
      platform: navigator.platform || 'WEB_CLIENT',
    });
    const pending = timers.current;
    return () => pending.forEach((t) => window.clearTimeout(t));
  }, []);

  // GSAP: scroll reveals + card tilt (no-ops with reduced motion / if GSAP can't load)
  useTilt(pageRef);
  useScramble(pageRef);

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  const runCommand = (raw: string) => {
    const cmd = raw.trim().toLowerCase();
    if (!cmd) return;
    history.current = [cmd, ...history.current].slice(0, 20);
    historyIdx.current = -1;

    if (cmd === 'help') {
      setTerminalOutput('CMDS: [home] [portfolio] [services] [contact] [ask] [specs] [os] [ping] [hack] [joke] [theme cyan|amber|emerald] [light] [dark] [clear]');
    } else if (cmd === 'portfolio' || cmd === 'projects') {
      router.push('/portfolio');
    } else if (cmd === 'services') {
      router.push('/services');
    } else if (cmd === 'contact') {
      router.push('/contact');
    } else if (cmd === 'home') {
      setTerminalOutput('You are already home. 🏠');
    } else if (cmd === 'ask' || cmd === 'chat') {
      setTerminalOutput('OPENING_CHAT_CHANNEL...');
      openChat();
    } else if (cmd === 'specs') {
      setTerminalOutput(`CLIENT_SPECS: OS: [${clientSpecs.os}] | RES: [${clientSpecs.resolution}] | THREADS: [${clientSpecs.cores}]`);
    } else if (cmd === 'os') {
      setTerminalOutput(`PLATFORM: ${clientSpecs.platform} | ESTIMATED RAM: ${clientSpecs.memory}`);
    } else if (cmd === 'ping') {
      setTerminalOutput('NETWORK_LATENCY: 14ms // NODE: NDEJJE SECURE RELAY // STATUS: OPTIMAL');
    } else if (cmd === 'joke') {
      setTerminalOutput(`JOKE: ${JOKES[Math.floor(Math.random() * JOKES.length)]}`);
    } else if (cmd === 'hack') {
      setIsHacking(true);
      setTerminalOutput('INITIATING TRACE... BYPASSING MAINFRAME FIREWALL...');
      later(() => setTerminalOutput('SCANNING CLIENT TELEMETRY... ACCESS GRANTED. YOU ARE IN.'), 1500);
      later(() => setIsHacking(false), 2500);
    } else if (cmd === 'light' || cmd === 'dark' || cmd === 'mode' || cmd === 'light mode' || cmd === 'dark mode') {
      if (cmd === 'mode') {
        toggleColorMode();
        setTerminalOutput('DISPLAY_MODE: Toggled light/dark.');
      } else {
        setColorMode(cmd.startsWith('light') ? 'light' : 'dark');
        setTerminalOutput(`DISPLAY_MODE: ${cmd.startsWith('light') ? 'LIGHT' : 'DARK'}.`);
      }
    } else if (cmd.startsWith('theme')) {
      const arg = cmd.split(/\s+/)[1];
      if (!arg) {
        cycleTheme();
        setTerminalOutput('THEME_SHIFT: Accent cycled.');
      } else if ((THEMES as string[]).includes(arg)) {
        setTheme(arg as Theme);
        setTerminalOutput(`THEME_SHIFT: System accent updated to ${arg.toUpperCase()}.`);
      } else {
        setTerminalOutput('USAGE: theme [cyan | amber | emerald]');
      }
    } else if (cmd === 'clear') {
      setTerminalOutput('SYS_READY.');
    } else {
      setTerminalOutput(`ERR: "${cmd.slice(0, 40)}" NOT RECOGNIZED. TYPE "help" FOR COMMAND LIST.`);
    }
  };

  const handleCommandSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runCommand(commandInput);
    setCommandInput('');
  };

  // ↑ / ↓ walk through previous commands, like a real terminal.
  const onTerminalKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp' && history.current.length) {
      e.preventDefault();
      historyIdx.current = Math.min(historyIdx.current + 1, history.current.length - 1);
      setCommandInput(history.current[historyIdx.current]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      historyIdx.current = Math.max(historyIdx.current - 1, -1);
      setCommandInput(historyIdx.current === -1 ? '' : history.current[historyIdx.current]);
    }
  };

  return (
    <div ref={pageRef} className="flex-1 bg-zinc-950 font-sans text-zinc-100">
      {/* Live diagnostic ticker */}
      <div className="overflow-hidden border-b border-zinc-800/80 bg-zinc-900/60 py-2 font-mono text-[11px] text-zinc-400">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 overflow-x-auto whitespace-nowrap px-4 sm:px-8 [&::-webkit-scrollbar]:hidden">
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-2 text-emerald-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              SYSTEM_STATUS: ONLINE
            </span>
            <span>NODE: NDEJJE, UG</span>
            <span className="text-accent">
              CLIENT: [{clientSpecs.os} | {clientSpecs.resolution}]
            </span>
          </div>
          <div className="hidden font-semibold text-accent md:block">SECURE_ENVIRONMENT // 100% OPERATIONAL</div>
        </div>
      </div>

      {/* Hero */}
      <header className="relative mx-auto max-w-7xl px-4 pb-12 pt-12 sm:px-8 sm:pt-20">
        <div className="pointer-events-none absolute inset-0 -z-0 bg-grid mask-fade-b opacity-60" aria-hidden="true" />
        <div className="relative grid grid-cols-1 items-center gap-10 lg:grid-cols-12">
          <div className="max-w-2xl lg:col-span-7">
            <div
              className="rise mb-6 inline-flex animate-cyber-glow items-center gap-2 rounded border border-zinc-800 bg-zinc-900 px-3 py-1 font-mono text-[10px] text-accent sm:text-xs"
              style={delay(0)}
            >
              <span data-scramble>STATUS: ONLINE // HARDWARE TECH &amp; CREATIVE UI/UX HUB</span>
            </div>
            <h1 className="rise text-3xl font-extrabold leading-tight tracking-tight text-zinc-100 sm:text-5xl" style={delay(90)}>
              Engineering digital systems &amp; hardware precision.
            </h1>
            <p className="rise mt-6 font-sans text-sm leading-relaxed text-zinc-400 sm:text-lg" style={delay(180)}>
              Specialized technical repair technician and multi-disciplinary designer bridging high-performance UI/UX engineering with advanced mobile and PC diagnostic systems.
            </p>

            <div className="rise mt-8 flex flex-col gap-4 font-mono text-xs sm:flex-row" style={delay(270)}>
              <Link
                href="/portfolio"
                data-magnetic
                className="touch-target inline-flex items-center justify-center rounded bg-accent-strong px-6 py-3.5 text-center font-semibold text-black shadow-lg transition-[scale,background-color,border-color,color] duration-300 hover:scale-105 hover:bg-accent active:scale-95 glow-accent"
              >
                EXPLORE_ARCHIVE →
              </Link>
              <Link
                href="/services"
                data-magnetic
                className="touch-target inline-flex items-center justify-center rounded border border-zinc-800 bg-zinc-900 px-6 py-3.5 text-center text-zinc-300 transition-[scale,background-color,border-color,color] duration-300 hover:scale-105 hover:border-zinc-700 hover:text-zinc-100 active:scale-95"
              >
                VIEW_SERVICES_&amp;_PRICING
              </Link>
            </div>
            <button
              type="button"
              onClick={() => openChat({ prefill: 'Take me to ' })}
              className="rise mt-5 font-mono text-[11px] text-zinc-500 transition-colors hover:text-accent max-sm:py-2"
              style={delay(340)}
            >
              💬 Or just tell the assistant where to go →
            </button>
          </div>

          {/* Interactive terminal */}
          <div
            id="terminal"
            className={`rise scroll-mt-20 rounded-xl border bg-zinc-900/40 p-4 font-mono shadow-2xl transition-all duration-500 hover:border-zinc-700 sm:p-5 lg:col-span-5 ${
              isHacking ? 'border-red-500/80 shadow-[0_0_30px_rgba(239,68,68,0.3)]' : 'border-accent/40'
            }`}
            style={delay(200)}
          >
            <div className="mb-3 flex items-center justify-between border-b border-zinc-800 pb-2 text-[11px] text-zinc-500">
              <span>INTERACTIVE_TERMINAL // v2.5</span>
              <span className={isHacking ? 'animate-ping text-red-400' : 'text-accent'}>{isHacking ? 'BREACH_DETECTED' : 'ONLINE'}</span>
            </div>
            <div
              role="status"
              aria-live="polite"
              className={`mb-3 flex min-h-[60px] items-center break-words rounded border border-zinc-800/80 bg-zinc-950 p-3 text-xs transition-all duration-300 ${
                isHacking ? 'font-bold text-red-400' : 'text-accent'
              }`}
            >
              {terminalOutput}
            </div>
            <form onSubmit={handleCommandSubmit} className="flex items-center gap-2">
              <label htmlFor="terminal-input" className="shrink-0 text-xs text-accent">
                guest@node:~#
              </label>
              <input
                id="terminal-input"
                type="text"
                placeholder="type 'help', 'hack', 'joke', 'specs'..."
                value={commandInput}
                maxLength={60}
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                onChange={(e) => setCommandInput(e.target.value)}
                onKeyDown={onTerminalKey}
                className="min-h-10 w-full min-w-0 bg-transparent text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none"
              />
              <button
                type="submit"
                className="min-h-10 shrink-0 rounded border border-accent/30 bg-accent/10 px-3 py-1 text-xs text-accent transition-all duration-200 hover:scale-105"
              >
                RUN
              </button>
            </form>
            <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 border-t border-zinc-900 pt-3 text-[10px] text-zinc-500">
              <span className="py-1 max-sm:py-2">Quick:</span>
              <button type="button" onClick={() => runCommand('specs')} className="py-1 text-accent hover:underline max-sm:py-2">
                [specs]
              </button>
              <button type="button" onClick={() => runCommand('joke')} className="py-1 text-accent hover:underline max-sm:py-2">
                [joke]
              </button>
              <button type="button" onClick={() => runCommand('theme')} className="py-1 text-accent hover:underline max-sm:py-2">
                [toggle theme]
              </button>
              <button type="button" onClick={() => router.push('/contact')} className="py-1 text-accent hover:underline max-sm:py-2">
                [contact]
              </button>
              <button type="button" onClick={() => runCommand('ask')} className="py-1 text-accent hover:underline max-sm:py-2">
                [ask ai]
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Technical expertise matrix */}
      <section id="stack" className="mx-auto max-w-7xl scroll-mt-20 border-t border-zinc-900 px-4 py-10 sm:px-8">
        <div className="mb-6" data-reveal>
          <span className="font-mono text-[10px] uppercase tracking-wider text-accent sm:text-xs">SYSTEM_CAPABILITIES // CORE PROFICIENCIES</span>
          <h2 className="mt-1 text-lg font-bold tracking-tight text-zinc-100 sm:text-2xl">Operational Stack &amp; Tooling</h2>
        </div>

        <div className="grid grid-cols-1 gap-4 font-mono text-xs sm:grid-cols-2 lg:grid-cols-3">
          {TECH_STACK.map((tech) => (
            <div
              key={tech.label}
              data-reveal
              className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800/80 bg-zinc-900/50 p-4 transition-all duration-300 hover:-translate-y-1 hover:border-accent/40 hover:shadow-lg"
            >
              <div className="min-w-0">
                <span className="block font-semibold text-zinc-200">{tech.label}</span>
                <span className="text-[10px] text-zinc-500">TAG: [{tech.category}]</span>
              </div>
              <span className="shrink-0 rounded border border-accent/30 bg-accent/10 px-2 py-1 text-[10px] text-accent">{tech.level}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Featured projects */}
      <section id="projects" className="mx-auto max-w-7xl scroll-mt-20 border-t border-zinc-900 px-4 py-12 sm:px-8">
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end" data-reveal>
          <div>
            <span className="font-mono text-[10px] uppercase tracking-wider text-accent sm:text-xs">CURATED_WORK // SYSTEM PREVIEWS</span>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-zinc-100 sm:text-3xl">Featured Operational Modules</h2>
          </div>
          <Link href="/portfolio" className="inline-flex items-center gap-1 py-1 font-mono text-xs text-accent hover:underline max-sm:py-2">
            VIEW_ALL_PROJECTS ({FEATURED_PROJECTS.length}) →
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {FEATURED_PROJECTS.map((project) => (
            <div
              key={project.id}
              data-reveal
              data-tilt
              className="group flex flex-col justify-between overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-900/40 transition-[border-color,box-shadow] duration-500 hover:border-accent/40 hover:shadow-2xl"
            >
              <div>
                <div className="relative h-48 overflow-hidden bg-zinc-950">
                  <ProjectImage
                    src={project.image}
                    alt={project.title}
                    sizes="(min-width: 768px) 33vw, 100vw"
                    className="object-cover opacity-80 transition-transform duration-700 group-hover:scale-110 group-hover:opacity-100"
                  />
                  <div className="absolute left-3 top-3 rounded border border-zinc-800 bg-zinc-950/80 px-2.5 py-1 font-mono text-[10px] text-accent backdrop-blur-sm">
                    [{project.category}]
                  </div>
                </div>
                <div className="p-5">
                  <div className="mb-1 font-mono text-[10px] text-zinc-500">ID: {project.id}</div>
                  <h3 className="text-lg font-bold text-zinc-100 transition-colors group-hover:text-accent">{project.title}</h3>
                  <p className="mt-2 line-clamp-2 text-xs text-zinc-400 sm:text-sm">{project.description}</p>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3 border-t border-zinc-800/50 p-5 pt-4">
                <span className="font-mono text-[10px] text-accent opacity-80">{project.metrics ?? project.category}</span>
                <Link
                  href={portfolioUrl({ open: project.id })}
                  className="inline-flex items-center gap-1 py-1 font-mono text-xs text-zinc-300 transition-all duration-200 group-hover:translate-x-1 group-hover:text-accent"
                >
                  DETAILS <span aria-hidden="true">→</span>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
