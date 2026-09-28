// src/app/services/page.tsx
'use client';

import Link from 'next/link';
import { useTheme } from '@/context/ThemeContext';
import RepairShowcase from '@/components/RepairShowcase';

export default function ServicesPage() {
  const { theme, themeClasses } = useTheme();

  const servicesList = [
    {
      id: "01",
      title: "Mobile & PC Hardware Diagnostics & Repair",
      tag: "HARDWARE_OPS",
      description: "Advanced troubleshooting, component-level repairs, screen/battery replacements, and system optimization for mobile devices and PCs.",
      deliverables: ["Full Diagnostic Report", "Thermal Paste Re-pasting", "OS Clean Installation", "Hardware Stress Testing"],
      timeline: "24 - 48 Hours",
      status: "ONLINE"
    },
    {
      id: "02",
      title: "Brand Identity & Graphic Design",
      tag: "VISUAL_ENGINEERING",
      description: "Custom visual systems, logo upscaling, typography styling, and promotional poster engineering built in Adobe Illustrator & Photoshop.",
      deliverables: ["Vector Logo Packages", "High-Resolution Event Posters", "Brand Guidelines", "Social Media Assets"],
      timeline: "3 - 5 Days",
      status: "ONLINE"
    },
    {
      id: "03",
      title: "UI/UX Prototyping & Web Layouts",
      tag: "INTERFACE_DESIGN",
      description: "Cyber-industrial web interfaces, interactive component states, and responsive layouts designed in Figma with clean Auto Layouts.",
      deliverables: ["Figma Wireframes & Prototypes", "Design System Components", "Next.js / Tailwind Layout Integration", "Interactive Animations"],
      timeline: "Custom Scope",
      status: "ACTIVE"
    },
    {
      id: "04",
      title: "Digital Asset Optimization & Formats",
      tag: "ASSET_TRANSFORM",
      description: "Specialized file format conversions, embroidery pattern digitization (e.g., Wilcom .jef formatting), and raster-to-vector tracing.",
      deliverables: [".jef Embroidery Files", "Clean SVG Conversions", "Batch Image Resizing", "Color Profile Correction"],
      timeline: "24 Hours",
      status: "ONLINE"
    }
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-cyan-500 selection:text-black">
      {/* Top Cyber Navigation Bar */}
      <header className="border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className={`font-mono ${themeClasses.accent} font-bold tracking-wider hover:opacity-80 transition-colors`}>
            // CYBER_PORTFOLIO.sys
          </Link>
          <nav className="hidden md:flex items-center space-x-6 font-mono text-xs text-zinc-400">
            <Link href="/" className={`hover:${themeClasses.accent} transition-colors`}>ROOT</Link>
            <Link href="/portfolio" className={`hover:${themeClasses.accent} transition-colors`}>PORTFOLIO</Link>
            <Link href="/services" className={`${themeClasses.accent} font-semibold`}>SERVICES</Link>
            <Link href="/contact" className={`hover:${themeClasses.accent} transition-colors`}>CONTACT</Link>
          </nav>
          <Link
            href="/contact"
            className={`px-4 py-2 text-xs font-mono bg-zinc-900 border ${themeClasses.border} ${themeClasses.accent} rounded hover:opacity-80 transition-all`}
          >
            INIT_CONTACT
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-6 py-16">
        {/* Header Section */}
        <div className="mb-12 border-b border-zinc-800/80 pb-8">
          <div className={`font-mono text-xs ${themeClasses.accent} mb-2 uppercase tracking-widest`}>
            [SECTION // CAPABILITIES & PROTOCOLS]
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-zinc-100">
            Technical & Creative Services
          </h1>
          <p className="text-zinc-400 mt-3 max-w-2xl text-sm md:text-base leading-relaxed">
            Precision engineering for physical hardware, digital brand architecture, and user interface design. Built for high performance and reliability.
          </p>
        </div>

        {/* Services Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {servicesList.map((service) => (
            <div
              key={service.id}
              className={`bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-8 hover:${themeClasses.border} hover:-translate-y-1 transition-all duration-300 group flex flex-col justify-between`}
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className={`font-mono text-xs px-2.5 py-1 rounded bg-zinc-800/80 ${themeClasses.accent} border border-zinc-700`}>
                    {service.tag}
                  </span>
                  <span className="font-mono text-xs text-emerald-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    {service.status}
                  </span>
                </div>

                <h3 className={`text-2xl font-bold text-zinc-100 group-hover:${themeClasses.accent} transition-colors mb-3`}>
                  {service.title}
                </h3>
                
                <p className="text-sm text-zinc-400 leading-relaxed mb-6">
                  {service.description}
                </p>

                {/* Deliverables List */}
                <div className="mb-6">
                  <div className="font-mono text-xs text-zinc-500 uppercase tracking-wider mb-2">Included Deliverables:</div>
                  <ul className="space-y-2">
                    {service.deliverables.map((item, idx) => (
                      <li key={idx} className="text-xs font-mono text-zinc-300 flex items-center gap-2">
                        <span className={themeClasses.accent}>›</span> {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="pt-6 border-t border-zinc-800/80 flex items-center justify-between">
                <div className="font-mono text-xs text-zinc-400">
                  EST_TIMELINE: <span className="text-zinc-200">{service.timeline}</span>
                </div>
                <Link
                  href="/contact"
                  className={`px-4 py-2 font-mono text-xs font-semibold rounded transition-all ${theme === 'cyan' ? 'bg-cyan-500 text-black hover:bg-cyan-400' : theme === 'amber' ? 'bg-amber-500 text-black hover:bg-amber-400' : 'bg-emerald-500 text-black hover:bg-emerald-400'}`}
                >
                  DEPLOY_REQUEST →
                </Link>
              </div>
            </div>
          ))}
        </div>

        {/* Real Hardware Restoration Showcase Component */}
        <RepairShowcase />

        {/* Bottom Call to Action */}
        <div className={`mt-16 bg-gradient-to-r from-zinc-900/40 via-zinc-900/40 to-zinc-900/40 border ${themeClasses.border} rounded-2xl p-8 md:p-12 text-center relative overflow-hidden`}>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(6,182,212,0.1),transparent_50%)]"></div>
          <h2 className="text-2xl md:text-3xl font-bold text-zinc-100 mb-4 relative z-10">
            Have a Custom Project or Emergency Repair?
          </h2>
          <p className="text-zinc-400 text-sm md:text-base max-w-xl mx-auto mb-8 relative z-10">
            Whether your rig needs a hardware overhaul or your brand needs a fresh visual identity, let's establish a secure connection and discuss the requirements.
          </p>
          <Link
            href="/contact"
            className={`inline-block px-8 py-3 font-mono font-semibold rounded transition-all relative z-10 ${theme === 'cyan' ? 'bg-cyan-500 text-black hover:bg-cyan-400' : theme === 'amber' ? 'bg-amber-500 text-black hover:bg-amber-400' : 'bg-emerald-500 text-black hover:bg-emerald-400'}`}
          >
            INITIALIZE_SECURE_COMMUNICATION
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800/80 py-8 mt-20 text-center font-mono text-xs text-zinc-600">
        <p>// SYSTEM_READY • ALL PROTOCOLS OPERATIONAL</p>
      </footer>
    </div>
  );
}