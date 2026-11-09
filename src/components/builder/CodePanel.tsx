// src/components/builder/CodePanel.tsx — the code editor: custom CSS, JavaScript and <head> HTML, plus a read-only view of the generated page.
'use client';

import { useMemo, useState } from 'react';
import { buildSite } from '@/lib/builder/generate';
import type { EditorApi } from './editorApi';

type Lang = 'css' | 'js' | 'html';
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* ── tiny single-pass highlighter (all text is escaped; output is safe for innerHTML) ── */
const RULES: Record<Lang, { re: RegExp; cls: (m: RegExpMatchArray) => string }> = {
  css: {
    re: /(\/\*[\s\S]*?\*\/)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*')|(@[\w-]+)|([\w-]+)(?=\s*:)|(#[0-9a-fA-F]{3,8}\b|\b\d+(?:\.\d+)?(?:px|em|rem|%|vh|vw|s|ms|deg|fr)?\b)/g,
    cls: (m) => (m[1] ? 'text-zinc-500' : m[2] ? 'text-amber-300' : m[3] ? 'text-violet-300' : m[4] ? 'text-sky-300' : 'text-emerald-300'),
  },
  js: {
    re: /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`)|\b(const|let|var|function|return|if|else|for|while|new|class|import|export|from|async|await|true|false|null|undefined|document|window|this|try|catch|throw|typeof)\b|(\b\d+(?:\.\d+)?\b)/g,
    cls: (m) => (m[1] ? 'text-zinc-500' : m[2] ? 'text-amber-300' : m[3] ? 'text-pink-400' : 'text-emerald-300'),
  },
  html: {
    re: /(<!--[\s\S]*?-->)|(<\/?[a-zA-Z][\w-]*)|("[^"]*"|'[^']*')|(\/?>)|(\s[\w:-]+)(?==)/g,
    cls: (m) => (m[1] ? 'text-zinc-500' : m[2] ? 'text-pink-400' : m[3] ? 'text-amber-300' : m[4] ? 'text-pink-400' : 'text-sky-300'),
  },
};
function highlight(code: string, lang: Lang): string {
  if (code.length > 120_000) return esc(code); // keep huge pastes fast
  const { re, cls } = RULES[lang];
  let out = '', last = 0;
  for (const m of code.matchAll(re)) {
    out += esc(code.slice(last, m.index)) + `<span class="${cls(m)}">${esc(m[0])}</span>`;
    last = (m.index ?? 0) + m[0].length;
  }
  return out + esc(code.slice(last));
}

function CodeBox({ value, onChange, lang, readOnly }: { value: string; onChange?: (v: string) => void; lang: Lang; readOnly?: boolean }) {
  const lines = value.split('\n');
  const n = lines.length;
  const width = Math.max(24, ...lines.map((l) => l.length)) + 4;
  const html = useMemo(() => highlight(value, lang) + '\n', [value, lang]);
  const h = n * 20 + 16;
  return (
    // ONE scroll container holds gutter + highlight + textarea, so they can never drift out of sync
    <div className="flex-1 min-h-0 overflow-auto bg-zinc-950 font-mono text-[13px] leading-5 border border-zinc-800 rounded">
      <div className="flex" style={{ minWidth: '100%', width: `calc(${width}ch + 3.5rem)`, height: h }}>
        <pre aria-hidden="true" className="select-none text-right text-zinc-600 px-2 py-2 sticky left-0 bg-zinc-950 m-0 shrink-0 z-10">{Array.from({ length: n }, (_, i) => i + 1).join('\n')}</pre>
        <div className="relative flex-1" style={{ height: h }}>
          <pre aria-hidden="true" className="absolute inset-0 m-0 py-2 pl-1 whitespace-pre pointer-events-none text-zinc-200" dangerouslySetInnerHTML={{ __html: html }} />
          <textarea
            value={value} readOnly={readOnly} spellCheck={false} wrap="off" autoCapitalize="off" autoCorrect="off" aria-label={`${lang} code`}
            onChange={(e) => onChange?.(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Tab' && !readOnly) {
                e.preventDefault();
                const t = e.currentTarget, s = t.selectionStart, en = t.selectionEnd;
                onChange?.(value.slice(0, s) + '  ' + value.slice(en));
                requestAnimationFrame(() => { t.selectionStart = t.selectionEnd = s + 2; });
              }
            }}
            className="absolute inset-0 w-full bg-transparent text-transparent caret-white selection:bg-cyan-500/30 resize-none outline-none py-2 pl-1 whitespace-pre overflow-hidden m-0 border-0"
            style={{ height: h, lineHeight: '20px' }}
          />
        </div>
      </div>
    </div>
  );
}

const SNIPPETS: Record<'css' | 'js' | 'head', { label: string; code: string }[]> = {
  css: [
    { label: 'Gradient headline text', code: '\n/* Gradient headline */\nh1 {\n  background: linear-gradient(90deg, var(--c-primary), var(--c-secondary));\n  -webkit-background-clip: text;\n  background-clip: text;\n  color: transparent;\n}\n' },
    { label: 'Bigger, softer cards', code: '\n.card {\n  border-radius: 1.5rem;\n  box-shadow: 0 10px 30px rgba(0, 0, 0, .08);\n}\n' },
    { label: 'Hide something', code: '\n/* Hide an element: replace .my-class */\n.my-class { display: none !important; }\n' },
    { label: 'Centered narrow layout', code: '\n.container { max-width: 960px; }\n' },
  ],
  js: [
    { label: 'Current year in footer', code: "\n// Replaces 2026 in the copyright line with the current year\ndocument.querySelectorAll('.site-footer .small').forEach(function (el) {\n  el.textContent = el.textContent.replace(/20\\d\\d/, new Date().getFullYear());\n});\n" },
    { label: 'Scroll progress bar', code: "\nvar bar = document.createElement('div');\nbar.style.cssText = 'position:fixed;top:0;left:0;height:3px;background:var(--c-primary);z-index:2000;width:0';\ndocument.body.appendChild(bar);\nwindow.addEventListener('scroll', function () {\n  var h = document.documentElement.scrollHeight - innerHeight;\n  bar.style.width = (h > 0 ? (scrollY / h) * 100 : 0) + '%';\n});\n" },
    { label: 'Greeting by time of day', code: "\nvar hour = new Date().getHours();\nvar hello = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';\nvar eyebrow = document.querySelector('.eyebrow');\nif (eyebrow) eyebrow.textContent = hello + '!';\n" },
  ],
  head: [
    { label: 'Google Analytics (GA4)', code: '\n<!-- Replace G-XXXXXXXXXX with your Measurement ID -->\n<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>\n<script>\n  window.dataLayer = window.dataLayer || [];\n  function gtag(){dataLayer.push(arguments);}\n  gtag("js", new Date()); gtag("config", "G-XXXXXXXXXX");\n</script>\n' },
    { label: 'Hide from search engines', code: '\n<meta name="robots" content="noindex, nofollow">\n' },
    { label: 'Extra Google Font', code: '\n<link rel="preconnect" href="https://fonts.googleapis.com">\n<link href="https://fonts.googleapis.com/css2?family=Pacifico&display=swap" rel="stylesheet">\n' },
  ],
};

const TABS = [
  { k: 'css', label: 'CSS', lang: 'css' as Lang },
  { k: 'js', label: 'JavaScript', lang: 'js' as Lang },
  { k: 'head', label: '<head>', lang: 'html' as Lang },
  { k: 'out', label: 'Generated HTML', lang: 'html' as Lang },
] as const;

export default function CodePanel({ api }: { api: EditorApi }) {
  const [tab, setTab] = useState<'css' | 'js' | 'head' | 'out'>('css');
  const t = TABS.find((x) => x.k === tab)!;
  const generated = useMemo(() => (tab === 'out' ? buildSite(api.cfg, { mode: 'export', assetSrc: (a) => `assets/img-${a}.jpg` }).html : ''), [tab, api.cfg]);
  const value = tab === 'out' ? generated : api.cfg.code[tab];

  return (
    <div className="flex flex-col h-full min-h-0 gap-2">
      <div className="text-[11px] text-amber-200/90 bg-amber-500/10 border border-amber-500/30 rounded p-2">
        Optional, for people who know a little code. It runs only on <strong>your</strong> website, and changes appear in the canvas live. Made a mistake? <kbd className="font-mono">Ctrl+Z</kbd> or empty the box.
      </div>
      <div className="flex gap-1 overflow-x-auto" role="tablist">
        {TABS.map((x) => <button key={x.k} role="tab" aria-selected={tab === x.k} onClick={() => setTab(x.k)} className={`px-2.5 py-1.5 rounded text-xs font-mono cursor-pointer whitespace-nowrap ${tab === x.k ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40' : 'border border-zinc-800 text-zinc-400 hover:text-zinc-200'}`}>{x.label}</button>)}
      </div>
      {tab !== 'out' && (
        <div className="flex items-center gap-2">
          <select aria-label="Insert a snippet" disabled={api.locked} value="" onChange={(e) => { const sn = SNIPPETS[tab][+e.target.value]; if (sn) api.edit(`code.${tab}`, (c) => { c.code[tab] = (c.code[tab] + sn.code).slice(0, 60000); }); }} className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs">
            <option value="">＋ Insert a ready-made snippet…</option>
            {SNIPPETS[tab].map((s, i) => <option key={s.label} value={i}>{s.label}</option>)}
          </select>
          <button disabled={api.locked || !value} className="px-2 py-1.5 rounded border border-zinc-700 text-xs font-mono hover:border-zinc-500 disabled:opacity-30 cursor-pointer" onClick={() => confirm('Clear this code?') && api.edit(`code.${tab}`, (c) => { c.code[tab] = ''; })}>Clear</button>
        </div>
      )}
      <CodeBox value={value} lang={t.lang} readOnly={tab === 'out' || api.locked} onChange={tab === 'out' ? undefined : (v) => api.edit(`code.${tab}`, (c) => { c.code[tab] = v.slice(0, 60000); })} />
      {tab === 'out' && <p className="text-[11px] text-zinc-500">This is the real <code>index.html</code> that goes in your download (read-only). Change the page with the editor or the code tabs.</p>}
      <div className="rounded border border-zinc-800 bg-zinc-900/50 max-h-28 overflow-auto">
        <div className="flex items-center justify-between px-2 py-1 text-[11px] font-mono text-zinc-400 border-b border-zinc-800"><span>Console {api.errors.length ? `· ${api.errors.length} error${api.errors.length > 1 ? 's' : ''}` : '· no errors'}</span>{api.errors.length > 0 && <button className="hover:text-white cursor-pointer" onClick={api.clearErrors}>clear</button>}</div>
        {api.errors.slice(-6).map((e, i) => <div key={i} className="px-2 py-1 text-[11px] font-mono text-red-300 border-b border-zinc-800/60">⚠ {e.m}{e.l ? ` (line ${e.l})` : ''}</div>)}
      </div>
    </div>
  );
}
