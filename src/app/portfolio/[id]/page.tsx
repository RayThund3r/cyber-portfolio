// src/app/portfolio/[id]/page.tsx
'use client';

import { use } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ALL_PROJECTS } from '@/data/portfolioData';
import { notFound } from 'next/navigation';
import { useTheme } from '@/context/ThemeContext';

export default function ProjectDeepDivePage({ params }: { params: Promise<{ id: string }> }) {
  const { theme, themeClasses } = useTheme();
  const resolvedParams = use(params);
  const project = ALL_PROJECTS.find((p) => p.id === resolvedParams.id);

  if (!project) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-cyan-500 selection:text-black">
      {/* Top Navigation */}
      <nav className="sticky top-0 z-50 bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-800/80">
        <div className="flex items-center justify-between px-4 sm:px-8 py-4 max-w-5xl mx-auto">
          <Link href="/portfolio" className={`font-mono text-xs ${themeClasses.accent} hover:opacity-80 transition-colors flex items-center gap-1.5`}>
            <span>←</span> BACK_TO_ARCHIVE
          </Link>
          <div className="font-mono text-xs text-zinc-500">
            SECURE_MODULE // ID: {project.id}
          </div>
        </div>
      </nav>

      {/* Main Content Container */}
      <main className="max-w-4xl mx-auto px-4 sm:px-8 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          {/* Header Metadata */}
          <div className="flex items-center gap-2 mb-4 font-mono text-xs">
            <span className={`px-3 py-1 rounded border ${themeClasses.badge}`}>
              [{project.category}]
            </span>
            <span className="text-zinc-500">•</span>
            <span className="text-zinc-400">{project.clientType || 'Technical Service'}</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-zinc-100 mb-6">
            {project.title}
          </h1>

          <p className={`text-base sm:text-lg text-zinc-300 leading-relaxed font-sans mb-8 border-l-2 ${theme === 'cyan' ? 'border-cyan-500' : theme === 'amber' ? 'border-amber-500' : 'border-emerald-500'} pl-4 bg-zinc-900/30 py-2 rounded-r`}>
            {project.description}
          </p>

          {/* Hero Image Showcase */}
          <div className="h-72 sm:h-96 rounded-xl overflow-hidden border border-zinc-800 mb-10 bg-zinc-900">
            <img src={project.image} alt={project.title} className="w-full h-full object-cover" />
          </div>

          {/* Grid Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono text-xs mb-12">
            <div className="bg-zinc-900/40 p-4 rounded-lg border border-zinc-800">
              <span className="text-zinc-500 block mb-1">KEY PERFORMANCE BENCHMARK</span>
              <span className={`text-sm font-semibold ${themeClasses.accent}`}>{project.metrics}</span>
            </div>
            <div className="bg-zinc-900/40 p-4 rounded-lg border border-zinc-800">
              <span className="text-zinc-500 block mb-1">DEPLOYED TOOLCHAIN</span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {project.tools?.map((tool, idx) => (
                  <span key={idx} className="bg-zinc-950 border border-zinc-800 px-2 py-0.5 rounded text-zinc-300">
                    {tool}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Deep-Dive Guide Section */}
          <section className="space-y-8 mb-14">
            <h2 className="text-xl font-bold font-mono text-zinc-100 border-b border-zinc-900 pb-3 flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${theme === 'cyan' ? 'bg-cyan-400' : theme === 'amber' ? 'bg-amber-400' : 'bg-emerald-400'}`}></span>
              TECHNICAL EXECUTION GUIDE & PROCESS
            </h2>
            
            <div className="space-y-6 text-sm text-zinc-300 leading-relaxed">
              <div className="bg-zinc-900/20 border border-zinc-900 p-6 rounded-xl">
                <h3 className={`font-mono font-semibold ${themeClasses.accent} mb-2`}>01. Initial Diagnostics & Requirements Scope</h3>
                <p>Every operational module starts with rigorous scoping. For this project, parameters were mapped out to ensure high reliability, zero latency overhead, and optimal compatibility across target deployment platforms.</p>
              </div>

              <div className="bg-zinc-900/20 border border-zinc-900 p-6 rounded-xl">
                <h3 className={`font-mono font-semibold ${themeClasses.accent} mb-2`}>02. Implementation & Asset Optimization</h3>
                <p>Utilizing industry-standard tooling, assets were structured, formatted, and fine-tuned. Code architecture and layout spacing were cross-checked to meet rigorous performance standards.</p>
              </div>

              <div className="bg-zinc-900/20 border border-zinc-900 p-6 rounded-xl">
                <h3 className={`font-mono font-semibold ${themeClasses.accent} mb-2`}>03. Final Deployment & Quality Assurance</h3>
                <p>Post-implementation testing guarantees robust performance under stress loads, ensuring seamless user experiences and professional polish.</p>
              </div>
            </div>
          </section>

          {/* Client Testimonial / Feedback Section */}
          <section className="mb-16">
            <h2 className="text-xl font-bold font-mono text-zinc-100 border-b border-zinc-900 pb-3 mb-6 flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${theme === 'cyan' ? 'bg-cyan-400' : theme === 'amber' ? 'bg-amber-400' : 'bg-emerald-400'}`}></span>
              VERIFIED CLIENT FEEDBACK
            </h2>
            
            <blockquote className="bg-zinc-900/40 border border-zinc-800/80 p-6 sm:p-8 rounded-xl relative">
              <span className="absolute top-4 right-6 font-serif text-5xl text-zinc-800">“</span>
              <p className="text-sm sm:text-base text-zinc-200 italic mb-4 relative z-10">
                &ldquo;The precision and speed delivered on this module completely exceeded expectations. The workflow integration was smooth, professional, and built to absolute perfection.&rdquo;
              </p>
              <footer className={`font-mono text-xs ${themeClasses.accent}`}>
                — Verified Project Stakeholder & Partner
              </footer>
            </blockquote>
          </section>

          {/* Action Footer */}
          <div className="border-t border-zinc-900 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <Link 
              href="/portfolio" 
              className={`font-mono text-xs text-zinc-400 hover:${themeClasses.accent} transition-colors`}
            >
              ← RETURN TO ARCHIVE GRID
            </Link>
            <Link 
              href="/contact"
              className={`w-full sm:w-auto text-center px-6 py-3 font-semibold font-mono text-xs rounded transition-all duration-300 ${theme === 'cyan' ? 'bg-cyan-500 text-black hover:bg-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.3)]' : theme === 'amber' ? 'bg-amber-500 text-black hover:bg-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.3)]' : 'bg-emerald-500 text-black hover:bg-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)]'}`}
            >
              INITIATE_SIMILAR_PROJECT →
            </Link>
          </div>
        </motion.div>
      </main>
    </div>
  );
}