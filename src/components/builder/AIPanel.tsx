// src/components/builder/AIPanel.tsx — dedicated AI assistant: chat, file uploads (images, PDF, Word, PowerPoint, text), undo.
'use client';

import { useEffect, useRef, useState } from 'react';
import { applyOps, localAssistant } from '@/lib/builder/ops';
import { post, fileToPacked } from './lib';
import type { EditorApi } from './editorApi';

interface Msg { id: number; role: 'user' | 'assistant'; text: string; chips?: string[]; applied?: string[]; notes?: string[]; undoable?: boolean; offline?: boolean }
interface Pending { name: string; mime: string; data: string; assetId?: string; thumb?: string }

const MAX_FILES = 6;
const MAX_BYTES = 10 * 1024 * 1024;
const EXT_MIME: Record<string, string> = {
  pdf: 'application/pdf', txt: 'text/plain', md: 'text/markdown', csv: 'text/csv', json: 'application/json',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};
const IDEAS = [
  'Write all the text for my business. It is a bakery in Ndejje that sells bread and cakes.',
  'Make the whole site look more premium and modern',
  'Translate the whole site into Kiswahili',
  'Add a pricing section with 3 plans in UGX',
  'Rewrite my headlines to be shorter and punchier',
  'Build the whole website from the document I attached',
];

export default function AIPanel({ api }: { api: EditorApi }) {
  const [msgs, setMsgs] = useState<Msg[]>([{ id: 0, role: 'assistant', text: 'Hi! I’m your website assistant. Tell me what you need in your own words — I can write all your text, redesign sections, translate, or build the whole site from a document, menu, price list or photos you upload (images, PDF, Word, PowerPoint, text).' }]);
  const [input, setInput] = useState('');
  const [files, setFiles] = useState<Pending[]>([]);
  const [busy, setBusy] = useState('');
  const [allowCode, setAllowCode] = useState(false);
  const [drag, setDrag] = useState(false);
  const [left, setLeft] = useState<number | null>(null);
  const ac = useRef<AbortController | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const idc = useRef(1);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, busy]);

  const push = (m: Omit<Msg, 'id'>) => setMsgs((x) => [...x, { ...m, id: idc.current++ }]);

  const addFiles = async (list: FileList | File[]) => {
    const arr = Array.from(list);
    if (files.length + arr.length > MAX_FILES) { push({ role: 'assistant', text: `You can attach up to ${MAX_FILES} files at a time.` }); return; }
    setBusy('Reading your files…');
    const out: Pending[] = [];
    for (const f of arr) {
      try {
        const ext = f.name.split('.').pop()?.toLowerCase() || '';
        const mime = f.type || EXT_MIME[ext] || '';
        if (f.size > MAX_BYTES) throw new Error('over 10 MB');
        if (mime.startsWith('image/')) {
          if (!api.isProject) throw new Error('pictures can only be added inside a customer project');
          const up = await api.upload(f); // compressed + saved to the media library so the AI can place it on the site
          out.push({ name: f.name, mime: up.mime, data: up.data, assetId: up.id, thumb: up.dataUrl });
        } else if (EXT_MIME[ext] || mime === 'application/pdf' || mime.startsWith('text/')) {
          const p = await fileToPacked(f);
          out.push({ name: f.name, mime: EXT_MIME[ext] || mime, data: p.data });
        } else throw new Error('unsupported type');
      } catch (e: any) { push({ role: 'assistant', text: `I couldn’t use “${f.name}” (${e.message}).` }); }
    }
    setFiles((x) => [...x, ...out]);
    setBusy('');
  };

  const applyConfig = (next: any) => api.edit('ai', (c) => { Object.assign(c, JSON.parse(JSON.stringify(next))); });

  const send = async (raw?: string) => {
    const text = (raw ?? input).trim();
    if ((!text && !files.length) || busy) return;
    const mine = files;
    const history = msgs.filter((m) => m.id !== 0).slice(-6).map((m) => ({ role: m.role, text: m.text }));
    push({ role: 'user', text: text || '(see attached files)', chips: mine.map((f) => f.name) });
    setInput(''); setFiles([]); setBusy('Thinking…');
    const ctl = new AbortController(); ac.current = ctl;
    const slow = setTimeout(() => setBusy('Working on a big job — this can take up to a minute…'), 6000);
    try {
      const d = await post('/api/builder/ai', { id: api.projectId, key: api.projectKey, prompt: text || 'Use the attached files to improve my website.', history, attachments: mine.map(({ name, mime, data, assetId }) => ({ name, mime, data, assetId })), config: api.cfg, allowCode }, ctl.signal);
      const changed = d.applied?.length > 0;
      if (changed) applyConfig(d.config);
      setLeft(typeof d.remaining === 'number' ? d.remaining : null);
      push({ role: 'assistant', text: d.message, applied: d.applied, notes: [...(d.notes || []), ...(d.skipped?.length ? [`Skipped ${d.skipped.length} change(s) that were not allowed or not valid.`] : [])], undoable: changed });
    } catch (e: any) {
      if (e.name === 'AbortError') push({ role: 'assistant', text: 'Stopped.' });
      else if (e.data?.code === 'no_ai') {
        // No AI key on the server → the built-in assistant still handles simple commands
        const r = localAssistant(text, api.cfg);
        const res = applyOps(api.cfg, r.ops, { allowCode: true });
        if (r.ops.length && res.applied.length) applyConfig(res.config);
        push({ role: 'assistant', text: r.message + (mine.length ? '\n\n(I can’t read uploaded files until the owner connects an AI key.)' : ''), applied: res.applied, undoable: res.applied.length > 0, offline: true });
      } else push({ role: 'assistant', text: e.message || 'Something went wrong. Please try again.' });
    } finally { clearTimeout(slow); setBusy(''); ac.current = null; }
  };

  const undoMsg = (id: number) => { api.undo(); setMsgs((x) => x.map((m) => (m.id === id ? { ...m, undoable: false, text: m.text + '\n\n↶ Undone.' } : m))); };
  const disabled = api.locked || !api.isProject;

  return (
    <div className="relative flex flex-col h-full min-h-0" onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); if (!disabled && e.dataTransfer.files.length) addFiles(e.dataTransfer.files); }}>
      {!api.isProject && <p className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded p-2 mb-2">The AI assistant works inside customer projects.</p>}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1" role="log" aria-live="polite">
        {msgs.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[92%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${m.role === 'user' ? 'bg-cyan-500 text-black' : 'bg-zinc-800 text-zinc-100'}`}>
              {m.text}
              {m.chips && m.chips.length > 0 && <div className="flex flex-wrap gap-1 mt-1.5">{m.chips.map((c) => <span key={c} className="px-1.5 py-0.5 rounded bg-black/20 text-[10px] font-mono">📎 {c}</span>)}</div>}
              {m.applied && m.applied.length > 0 && <ul className="mt-2 text-[11px] text-emerald-300 list-disc pl-4">{m.applied.map((a) => <li key={a}>{a}</li>)}</ul>}
              {m.notes?.map((n) => <div key={n} className="mt-1 text-[11px] text-amber-300">⚠ {n}</div>)}
              {m.offline && <div className="mt-1 text-[10px] font-mono text-zinc-400">built-in assistant (AI not connected)</div>}
              {m.undoable && <button onClick={() => undoMsg(m.id)} className="mt-2 px-2 py-1 rounded border border-zinc-600 text-[11px] font-mono hover:border-zinc-300 cursor-pointer">↶ Undo this</button>}
            </div>
          </div>
        ))}
        {busy && <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono"><span className="inline-block w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />{busy}{ac.current && <button className="underline cursor-pointer" onClick={() => ac.current?.abort()}>stop</button>}</div>}
        {msgs.length === 1 && !busy && <div className="space-y-1.5 pt-1">{IDEAS.map((i) => <button key={i} disabled={disabled} onClick={() => send(i)} className="block w-full text-left px-3 py-2 rounded-lg border border-zinc-800 hover:border-cyan-500/50 text-xs text-zinc-300 cursor-pointer disabled:opacity-40">✨ {i}</button>)}</div>}
        <div ref={end} />
      </div>

      {drag && <div className="absolute inset-2 z-20 rounded-xl border-2 border-dashed border-cyan-400 bg-cyan-500/10 flex items-center justify-center text-sm text-cyan-200 pointer-events-none">Drop files for the AI to read</div>}

      <div className="pt-2 space-y-2 border-t border-zinc-800 mt-2">
        {files.length > 0 && <div className="flex flex-wrap gap-1.5">{files.map((f, i) => <span key={i} className="inline-flex items-center gap-1 pl-1.5 pr-1 py-0.5 rounded bg-zinc-800 text-[11px]">{f.thumb ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={f.thumb} alt="" className="w-4 h-4 rounded object-cover" /> : '📄'}{f.name.slice(0, 22)}<button aria-label={`Remove ${f.name}`} className="px-1 text-zinc-400 hover:text-white cursor-pointer" onClick={() => setFiles((x) => x.filter((_, k) => k !== i))}>✕</button></span>)}</div>}
        <label className="flex items-center gap-2 text-[11px] text-zinc-400 cursor-pointer"><input type="checkbox" checked={allowCode} onChange={(e) => setAllowCode(e.target.checked)} /> Let the AI write custom code (CSS / JS / HTML) <span className="text-zinc-600">— off by default for safety</span></label>
        <div className="flex gap-2 items-end">
          <label className={`shrink-0 w-10 h-10 rounded-lg border border-zinc-700 flex items-center justify-center cursor-pointer hover:border-zinc-400 ${disabled ? 'opacity-40 pointer-events-none' : ''}`} title="Attach files">
            📎<input type="file" multiple className="hidden" accept="image/*,.pdf,.docx,.pptx,.txt,.md,.csv,.json" onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }} />
          </label>
          <textarea value={input} disabled={disabled} rows={2} placeholder="Ask for anything… (Enter to send)" aria-label="Message to the AI assistant"
            onChange={(e) => setInput(e.target.value)}
            onPaste={(e) => { const fs = Array.from(e.clipboardData.files); if (fs.length) { e.preventDefault(); addFiles(fs); } }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-cyan-500 disabled:opacity-50" />
          <button disabled={disabled || !!busy || (!input.trim() && !files.length)} onClick={() => send()} className="shrink-0 h-10 px-3 rounded-lg bg-cyan-500 text-black font-semibold text-sm hover:bg-cyan-400 disabled:opacity-40 cursor-pointer" aria-label="Send">↑</button>
        </div>
        {left !== null && <div className="text-[10px] font-mono text-zinc-500 text-right">{left} AI request{left === 1 ? '' : 's'} left today</div>}
      </div>
    </div>
  );
}
