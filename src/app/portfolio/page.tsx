// src/app/portfolio/page.tsx
'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ALL_PROJECTS, ProjectItem } from '@/data/portfolioData';
import { useTheme } from '@/context/ThemeContext';

type CategoryFilter = 'ALL' | 'UI/UX' | 'BRANDING' | 'WEBAPP' | 'HARDWARE';

export default function PortfolioPage() {
  const { theme, themeClasses } = useTheme();

  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeModalProject, setActiveModalProject] = useState<ProjectItem | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isAutoplaying, setIsAutoplaying] = useState(false);
  const [imageHasError, setImageHasError] = useState(false);

  // Filter projects safely based on category and search term
  const filteredProjects = useMemo(() => {
    if (!Array.isArray(ALL_PROJECTS)) return [];
    return ALL_PROJECTS.filter((project) => {
      const matchesCategory = selectedCategory === 'ALL' || project.category === selectedCategory;
      const query = searchQuery.trim().toLowerCase();
      const matchesSearch = 
        !query ||
        project.title?.toLowerCase().includes(query) ||
        project.description?.toLowerCase().includes(query) ||
        project.tools?.some(t => t.toLowerCase().includes(query));
      
      return matchesCategory && matchesSearch;
    });
  }, [selectedCategory, searchQuery]);

  const categories: CategoryFilter[] = ['ALL', 'UI/UX', 'BRANDING', 'WEBAPP', 'HARDWARE'];

  const handleOpenModal = (project: ProjectItem) => {
    setActiveImageIndex(0);
    setImageHasError(false);
    setIsAutoplaying(true);
    setActiveModalProject(project);
  };

  // Safe gallery autoplay effect with boundary checks
  useEffect(() => {
    if (!activeModalProject || !isAutoplaying || !activeModalProject.gallery || activeModalProject.gallery.length <= 1) return;

    const interval = setInterval(() => {
      setActiveImageIndex((prevIndex) => {
        const galleryLength = activeModalProject.gallery?.length || 1;
        return (prevIndex + 1) % galleryLength;
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [activeModalProject, isAutoplaying]);

  const handleThumbnailClick = (idx: number) => {
    setIsAutoplaying(false);
    setImageHasError(false);
    setActiveImageIndex(idx);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-cyan-500 selection:text-black overflow-x-hidden animate-page-in">
      {/* Top Navigation */}
      <nav className="sticky top-0 z-50 bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-800/80 transition-all duration-300">
        <div className="flex items-center justify-between px-4 sm:px-8 py-4 max-w-7xl mx-auto">
          <Link href="/" className="flex items-center gap-2 group">
            <div className={`w-2.5 h-2.5 rounded-full animate-ping ${theme === 'cyan' ? 'bg-cyan-400' : theme === 'amber' ? 'bg-amber-400' : 'bg-emerald-400'}`}></div>
            <span className={`font-mono text-xs sm:text-sm font-bold tracking-widest ${themeClasses.accent} group-hover:opacity-80 transition-colors`}>
              SYS_PORTFOLIO.v1 / ARCHIVE
            </span>
          </Link>
          
          <div className="flex items-center gap-3 sm:gap-6 font-mono text-xs">
            <Link href="/" className={`text-zinc-400 hover:${themeClasses.accent} transition-all duration-200 hidden xs:inline hover:-translate-y-0.5`}>
              [HOME]
            </Link>
            <Link href="/services" className={`text-zinc-400 hover:${themeClasses.accent} transition-all duration-200 hidden xs:inline hover:-translate-y-0.5`}>
              [SERVICES]
            </Link>
            <Link 
              href="/contact" 
              className={`px-3.5 py-2 rounded font-semibold transition-all duration-300 border ${themeClasses.badge} ${themeClasses.bgGlow} hover:scale-105`}
            >
              INITIATE_CONTACT →
            </Link>
          </div>
        </div>
      </nav>

      {/* Header Section */}
      <header className="max-w-7xl mx-auto px-4 sm:px-8 pt-12 sm:pt-16 pb-8">
        <div className="max-w-3xl">
          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded bg-zinc-900/90 border border-zinc-800 font-mono text-[10px] sm:text-xs mb-4 ${themeClasses.accent} animate-cyber-glow`}>
            <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${theme === 'cyan' ? 'bg-cyan-400' : theme === 'amber' ? 'bg-amber-400' : 'bg-emerald-400'}`}></span>
            <span>DATABASE: 06 OPERATIONAL MODULES LOADED</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-zinc-100 bg-gradient-to-r from-zinc-100 via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
            Complete Design & Technical Archive
          </h1>
          <p className="mt-4 text-sm sm:text-base text-zinc-400 leading-relaxed font-sans">
            Explore a comprehensive collection of UI/UX layouts, cyber-industrial brand identities, software development setups, and hardware diagnostics systems.
          </p>
        </div>

        {/* Controls Bar */}
        <div className="mt-10 flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between border-t border-zinc-900 pt-8">
          <div className="flex flex-wrap gap-2 font-mono text-xs">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-2 rounded border transition-all duration-300 active:scale-95 ${
                  selectedCategory === cat
                    ? `${theme === 'cyan' ? 'bg-cyan-500 border-cyan-400 text-black shadow-[0_0_20px_rgba(6,182,212,0.4)]' : theme === 'amber' ? 'bg-amber-500 border-amber-400 text-black shadow-[0_0_20px_rgba(245,158,11,0.4)]' : 'bg-emerald-500 border-emerald-400 text-black shadow-[0_0_20px_rgba(16,185,129,0.4)]'} font-semibold scale-105`
                    : 'bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-zinc-200 hover:bg-zinc-900 hover:-translate-y-0.5'
                }`}
              >
                [{cat}]
              </button>
            ))}
          </div>

          <div className="relative min-w-[240px]">
            <input
              type="text"
              placeholder="SEARCH_MODULES..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full bg-zinc-900/80 border border-zinc-800 rounded px-3.5 py-2 text-xs font-mono text-zinc-100 placeholder-zinc-600 focus:outline-none ${theme === 'cyan' ? 'focus:border-cyan-500 focus:ring-cyan-500/20' : theme === 'amber' ? 'focus:border-amber-500 focus:ring-amber-500/20' : 'focus:border-emerald-500 focus:ring-emerald-500/20'} focus:ring-2 transition-all duration-300`}
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className={`absolute right-3 top-2.5 text-xs font-mono text-zinc-500 hover:${themeClasses.accent} transition-colors`}
              >
                [CLEAR]
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Projects Grid with Fluid Layout Animations */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 pb-20">
        {filteredProjects.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20 bg-zinc-900/20 border border-zinc-900 rounded-xl font-mono"
          >
            <p className="text-zinc-400 text-sm">NO MATCHING OPERATIONAL MODULES FOUND.</p>
            <button 
              onClick={() => { setSelectedCategory('ALL'); setSearchQuery(''); }}
              className={`mt-4 px-4 py-2 border rounded text-xs transition-all duration-300 hover:scale-105 ${themeClasses.badge}`}
            >
              RESET_FILTERS
            </button>
          </motion.div>
        ) : (
          <motion.div layout className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence mode="popLayout">
              {filteredProjects.map((project) => (
                <motion.div 
                  key={project.id}
                  layout
                  layoutId={`project-card-${project.id}`}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.3, type: "spring", stiffness: 300, damping: 25 }}
                  onClick={() => handleOpenModal(project)}
                  whileHover={{ y: -6, transition: { duration: 0.2 } }}
                  className={`group bg-zinc-900/40 border border-zinc-800/80 rounded-xl overflow-hidden hover:${themeClasses.border} hover:shadow-2xl flex flex-col justify-between cursor-pointer transition-colors duration-300`}
                >
                  <div>
                    <div className="h-52 overflow-hidden relative bg-zinc-950">
                      <motion.img 
                        layoutId={`project-image-${project.id}`}
                        src={project.image} 
                        alt={project.title}
                        onError={(e) => {
                          // Fallback placeholder if image load fails
                          (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=800&auto=format&fit=crop';
                        }}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 opacity-75 group-hover:opacity-100"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent opacity-60"></div>
                      
                      <div className={`absolute top-3 left-3 bg-zinc-950/90 backdrop-blur-md border border-zinc-800 px-2.5 py-1 rounded text-[10px] font-mono ${themeClasses.accent}`}>
                        [{project.category}]
                      </div>
                    </div>
                    <div className="p-5">
                      <div className="text-[10px] font-mono text-zinc-500 mb-1 flex items-center justify-between">
                        <span>ID: {project.id}</span>
                        <span className={`w-1.5 h-1.5 rounded-full bg-zinc-700 group-hover:${theme === 'cyan' ? 'bg-cyan-400' : theme === 'amber' ? 'bg-amber-400' : 'bg-emerald-400'} transition-colors`}></span>
                      </div>
                      <motion.h3 
                        layoutId={`project-title-${project.id}`}
                        className={`text-lg font-bold text-zinc-100 group-hover:${themeClasses.accent} transition-colors duration-300`}
                      >
                        {project.title}
                      </motion.h3>
                      <p className="text-xs sm:text-sm text-zinc-400 mt-2 line-clamp-2 leading-relaxed">
                        {project.description}
                      </p>

                      {project.tools && project.tools.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-1.5">
                          {project.tools.map((tool, index) => (
                            <span key={index} className="px-2 py-0.5 bg-zinc-950 border border-zinc-800/80 text-[10px] font-mono text-zinc-400 rounded">
                              {tool}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="p-5 pt-0 flex items-center justify-between border-t border-zinc-800/50 mt-4">
                    <span className={`text-[10px] font-mono ${themeClasses.accent} opacity-80`}>{project.metrics}</span>
                    <span className={`text-xs font-mono text-zinc-300 group-hover:${themeClasses.accent} transition-all duration-300 inline-flex items-center gap-1 group-hover:translate-x-1`}>
                      INSPECT <span>→</span>
                    </span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </main>

      {/* Maximized Modal with Viewport-Centered Hover & Background Scrolling */}
      <AnimatePresence>
        {activeModalProject && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-hidden pointer-events-none">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveModalProject(null)}
              className="absolute inset-0 bg-black/85 backdrop-blur-md pointer-events-auto"
            />

            {/* Modal Card */}
            <motion.div
              layoutId={`project-card-${activeModalProject.id}`}
              transition={{ type: "spring", stiffness: 320, damping: 30 }}
              className={`relative pointer-events-auto bg-zinc-950 border ${theme === 'cyan' ? 'border-cyan-500/60 shadow-[0_0_50px_rgba(6,182,212,0.3)]' : theme === 'amber' ? 'border-amber-500/60 shadow-[0_0_50px_rgba(245,158,11,0.3)]' : 'border-emerald-500/60 shadow-[0_0_50px_rgba(16,185,129,0.3)]'} rounded-xl max-w-2xl w-full h-[88vh] flex flex-col overflow-hidden z-10`}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-zinc-800 bg-zinc-900/90 flex-shrink-0">
                <span className={`font-mono text-[11px] sm:text-xs ${themeClasses.accent} flex items-center gap-2 truncate pr-2`}>
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 animate-ping ${theme === 'cyan' ? 'bg-cyan-400' : theme === 'amber' ? 'bg-amber-400' : 'bg-emerald-400'}`}></span>
                  MODULE_INSPECTION // ID: {activeModalProject.id}
                </span>
                <button 
                  onClick={() => setActiveModalProject(null)}
                  className="font-mono text-xs text-zinc-400 hover:text-zinc-100 px-2.5 py-1 bg-zinc-800/60 hover:bg-zinc-700 rounded transition-colors cursor-pointer flex-shrink-0"
                >
                  [CLOSE ✕]
                </button>
              </div>

              {/* Modal Scrollable Body */}
              <div className="flex-1 min-h-0 p-4 sm:p-6 overflow-y-auto space-y-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                <div className="h-52 sm:h-64 rounded-lg overflow-hidden border border-zinc-800 relative bg-zinc-900 flex-shrink-0">
                  <AnimatePresence mode="wait">
                    <motion.img 
                      key={activeImageIndex}
                      layoutId={`project-image-${activeModalProject.id}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      src={
                        imageHasError 
                          ? 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=800&auto=format&fit=crop'
                          : (activeModalProject.gallery?.[activeImageIndex] || activeModalProject.image)
                      } 
                      alt={activeModalProject.title}
                      onError={() => setImageHasError(true)}
                      className="w-full h-full object-cover" 
                    />
                  </AnimatePresence>
                  
                  <div className={`absolute top-2 left-2 flex items-center gap-1.5 bg-zinc-950/80 backdrop-blur-md px-2.5 py-1 rounded text-[10px] font-mono ${themeClasses.accent} border border-zinc-800`}>
                    {isAutoplaying ? (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                        <span>AUTOPLAY ACTIVE</span>
                      </>
                    ) : (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                        <span>MANUAL OVERRIDE</span>
                      </>
                    )}
                  </div>

                  <div className={`absolute top-2 right-2 bg-zinc-950/80 backdrop-blur-md px-2 py-1 rounded text-[10px] font-mono ${themeClasses.accent} border border-zinc-800`}>
                    IMG [0{activeImageIndex + 1} / 0{activeModalProject.gallery?.length || 1}]
                  </div>
                </div>

                {/* Thumbnails */}
                {activeModalProject.gallery && activeModalProject.gallery.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-mono text-zinc-500">SUB_MODULE GALLERY (SELECT TO OVERRIDE)</span>
                      {isAutoplaying && (
                        <button 
                          onClick={() => setIsAutoplaying(false)}
                          className={`text-[10px] font-mono ${themeClasses.accent} hover:underline`}
                        >
                          [PAUSE]
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-5 gap-2">
                      {activeModalProject.gallery.map((imgUrl, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleThumbnailClick(idx)}
                          className={`h-12 sm:h-14 rounded overflow-hidden border transition-all ${
                            activeImageIndex === idx 
                              ? `${theme === 'cyan' ? 'border-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.4)]' : theme === 'amber' ? 'border-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.4)]' : 'border-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.4)]'} scale-105` 
                              : 'border-zinc-800 opacity-60 hover:opacity-100 hover:border-zinc-700'
                          }`}
                        >
                          <img src={imgUrl} alt={`Thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2 font-mono text-xs">
                  <span className={`px-2.5 py-1 rounded border ${themeClasses.badge}`}>
                    [{activeModalProject.category}]
                  </span>
                  {activeModalProject.clientType && (
                    <span className="text-zinc-400">• {activeModalProject.clientType}</span>
                  )}
                </div>

                <motion.h2 layoutId={`project-title-${activeModalProject.id}`} className="text-xl sm:text-2xl font-bold text-zinc-100">
                  {activeModalProject.title}
                </motion.h2>
                
                <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed font-sans">
                  {activeModalProject.description}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-xs border-t border-zinc-900 pt-4">
                  <div className="bg-zinc-900/40 p-3 rounded border border-zinc-800/80">
                    <span className="text-zinc-500 block mb-1">PERFORMANCE METRIC</span>
                    <span className={`${themeClasses.accent} font-semibold`}>{activeModalProject.metrics}</span>
                  </div>
                  <div className="bg-zinc-900/40 p-3 rounded border border-zinc-800/80">
                    <span className="text-zinc-500 block mb-1">TOOLCHAIN USED</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {activeModalProject.tools?.map((t, i) => (
                        <span key={i} className="text-zinc-300 bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-800 text-[10px]">{t}</span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Modal Footer Actions */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 font-mono text-xs pt-4 border-t border-zinc-900">
                  <button
                    onClick={() => setActiveModalProject(null)}
                    className="w-full sm:w-auto px-4 py-2.5 bg-zinc-900 border border-zinc-800 text-zinc-300 rounded hover:border-zinc-700 transition-all duration-200 cursor-pointer"
                  >
                    MINIMIZE_TO_GRID
                  </button>
                  
                  <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
                    <Link
                      href={`/portfolio/${activeModalProject.id}`}
                      className={`w-full sm:w-auto text-center px-4 py-2.5 bg-zinc-800 border rounded transition-all duration-200 hover:scale-105 ${themeClasses.badge}`}
                    >
                      [DEEP-DIVE ARCHIVE →]
                    </Link>
                    <Link
                      href="/contact"
                      className={`w-full sm:w-auto text-center px-5 py-2.5 font-semibold rounded transition-all duration-300 hover:scale-105 ${theme === 'cyan' ? 'bg-cyan-500 text-black hover:bg-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.3)]' : theme === 'amber' ? 'bg-amber-500 text-black hover:bg-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.3)]' : 'bg-emerald-500 text-black hover:bg-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]'}`}
                    >
                      REQUEST_WORK →
                    </Link>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-4 sm:px-8 py-10 border-t border-zinc-900 flex flex-col sm:flex-row items-center justify-between text-xs font-mono text-zinc-500 gap-4">
        <div>SYS_PORTFOLIO.v1 // SECURE ENVIRONMENT</div>
        <div className="flex gap-4">
          <Link href="/" className={`hover:${themeClasses.accent} transition-colors`}>HOME</Link>
          <Link href="/services" className={`hover:${themeClasses.accent} transition-colors`}>SERVICES</Link>
          <Link href="/contact" className={`hover:${themeClasses.accent} transition-colors`}>CONTACT</Link>
        </div>
      </footer>
    </div>
  );
}