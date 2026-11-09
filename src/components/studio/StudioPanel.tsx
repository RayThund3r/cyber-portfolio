// src/components/studio/StudioPanel.tsx — "Studio" tab of the admin: all websites you have designed, plus new/import.
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import StudioEditor from './StudioEditor';

async function post(body: unknown) {
  const r = await fetch('/api/studio', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(d.error || 'Request failed'), { status: r.status });
  return d;
}
const btn = 'px-3 py-1.5 rounded border border-zinc-700 text-xs font-mono hover:border-zinc-500 disabled:opacity-40 cursor-pointer';
const primary = 'px-3 py-1.5 rounded bg-cyan-500 text-black text-xs font-mono font-semibold hover:bg-cyan-400 disabled:opacity-40 cursor-pointer';

type Site = { slug: string; name: string; mode: string; published: boolean; portfolioId: string | null; products: number; updatedAt: string; kb: number };
type Preset = { id: string; label: string; desc: string };

export default function StudioPanel({ onAuthLost }: { onAuthLost: () => void }) {
  const [sites, setSites] = useState<Site[] | null>(null);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [preset, setPreset] = useState('rose');
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);

  const fail = useCallback((e: any) => { if (e?.status === 401) onAuthLost(); else setMsg(e?.message || 'Something went wrong.'); }, [onAuthLost]);
  const load = useCallback(() => post({ action: 'list' }).then((d) => { setSites(d.sites); setPresets(d.presets); }).catch(fail), [fail]);
  useEffect(() => { load(); }, [load]);

  const run = async (fn: () => Promise<void>) => { setBusy(true); setMsg(null); try { await fn(); } catch (e) { fail(e); } finally { setBusy(false); } };

  if (editing) return <StudioEditor slug={editing} onAuthLost={onAuthLost} onBack={() => { setEditing(null); load(); }} />;

  return (
    <section className="space-y-6">
      <div>
        <h2 className="font-mono text-xs text-cyan-400">SITE STUDIO</h2>
        <p className="mt-1 text-sm text-zinc-400">Design complete business websites for your clients: slideshow, catalogue, cart with WhatsApp ordering, bookings or quotes, reviews, three languages, light and dark mode, and an owner admin panel. Preview on any device, download the finished site, and show it live in your portfolio.</p>
      </div>

      <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <h3 className="font-mono text-xs text-zinc-300">NEW WEBSITE</h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {presets.map((p) => (
            <button key={p.id} type="button" onClick={() => setPreset(p.id)} aria-pressed={preset === p.id} className={`rounded-lg border p-3 text-left transition-colors ${preset === p.id ? 'border-cyan-500 bg-cyan-500/10' : 'border-zinc-800 hover:border-zinc-600'}`}>
              <div className="text-sm font-semibold text-zinc-100">{p.label}</div>
              <div className="mt-1 text-[11px] leading-snug text-zinc-400">{p.desc}</div>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <input value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={60} placeholder="Client / business name" aria-label="Business name" className="min-w-0 flex-1 rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-cyan-500 focus:outline-none sm:max-w-xs" />
          <button className={primary} disabled={busy} onClick={() => run(async () => { const r = await post({ action: 'create', name: newName, preset }); setNewName(''); setEditing(r.slug); })}>Create &amp; design →</button>
          <input ref={file} type="file" accept=".html,.json,text/html,application/json" className="hidden" onChange={(e) => {
            const f = e.target.files?.[0]; e.target.value = '';
            if (!f) return;
            run(async () => {
              const text = await f.text();
              // a Studio backup (.json) restores a site with its pictures; an index.html is read back into settings
              const r = f.name.toLowerCase().endsWith('.json') ? await post({ action: 'restore', backup: JSON.parse(text) }) : await post({ action: 'import', html: text });
              setMsg(r.warnings?.length ? `Imported. ${r.warnings.join(' ')}` : 'Done.'); await load(); setEditing(r.slug);
            });
          }} />
          <button className={btn} disabled={busy} onClick={() => file.current?.click()} title="Open a site's index.html made with this engine, or restore a Studio backup (.json)">Import / restore</button>
        </div>
      </div>

      {msg && <p role="status" className="text-xs text-amber-300">{msg}</p>}

      <div className="space-y-3">
        <h3 className="font-mono text-xs text-zinc-300">YOUR WEBSITES</h3>
        {sites === null ? <p className="text-sm text-zinc-400">Loading…</p> : sites.length === 0 ? <p className="text-sm text-zinc-400">No websites yet. Pick a starting look above, or import one you already have.</p> : (
          <ul className="space-y-3">
            {sites.map((s) => (
              <li key={s.slug} className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-zinc-100">{s.name} {s.published && <span className="ml-1 rounded bg-emerald-500/20 px-1.5 py-0.5 font-mono text-[10px] text-emerald-400">LIVE</span>}</div>
                  <div className="font-mono text-[11px] text-zinc-500">{s.mode === 'quote' ? 'Quote site' : 'Booking site'} · {s.products} products · {s.kb} KB of pictures · edited {new Date(s.updatedAt).toLocaleDateString('en-UG')}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className={primary} onClick={() => setEditing(s.slug)}>Design</button>
                  {s.published && <a className={btn} href={`/demo/${s.slug}`} target="_blank" rel="noopener noreferrer">Open demo ↗</a>}
                  <a className={btn} href={`/api/studio?download=${encodeURIComponent(s.slug)}`}>⬇ .zip</a>
                  <a className={btn} href={`/api/studio?backup=${encodeURIComponent(s.slug)}`} title="Settings and pictures, to restore this site later">💾 Backup</a>
                  <button className={btn} disabled={busy} onClick={() => run(async () => { await post({ action: 'duplicate', slug: s.slug }); await load(); })}>Duplicate</button>
                  <button className={`${btn} !border-red-500/50 text-red-400`} disabled={busy} onClick={() => { if (confirm(`Delete "${s.name}" and all its pictures? This cannot be undone.`)) run(async () => { await post({ action: 'delete', slug: s.slug }); await load(); }); }}>Delete</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
