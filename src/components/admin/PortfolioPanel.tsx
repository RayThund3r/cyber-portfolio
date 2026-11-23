// src/components/admin/PortfolioPanel.tsx — the projects shown on the public site: add, edit, reorder, delete.
'use client';

import { useEffect, useState } from 'react';
import type { ProjectItem } from '@/data/portfolioData';
import Icon from '@/components/ui/Icon';
import { api, box, btn, primary } from './adminKit';
import { AButton, Badge, Card, Empty, Field, Notice } from './ui';

const EMPTY: ProjectItem = { id: '', title: '', category: 'WEBAPP', description: '', image: '', tools: [], gallery: [], featured: false } as ProjectItem;

export default function PortfolioPanel() {
  const [items, setItems] = useState<ProjectItem[]>([]); const [edit, setEdit] = useState<ProjectItem | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => { api<{ projects: ProjectItem[] }>('projects').then((d) => setItems(d.projects)).catch((e) => setMsg({ ok: false, text: e.message })); }, []);

  const run = async (action: string, data: Record<string, unknown>) => {
    setMsg(null);
    try { const d = await api<{ projects: ProjectItem[] }>(action, data); setItems(d.projects); setEdit(null); setMsg({ ok: true, text: 'Saved. The site updates on the next page load.' }); } catch (e: any) { setMsg({ ok: false, text: e.message }); }
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <AButton variant="solid" icon="star" onClick={() => setEdit({ ...EMPTY })}>New project</AButton>
        {msg && <span role="status" className={`text-xs font-medium ${msg.ok ? 'text-emerald-300' : 'text-rose-300'}`}>{msg.text}</span>}
      </div>
      <Notice title="Using placeholder pictures?">Replace the image link with your real photos any time (an https:// link, or a /path inside <code className="font-mono">public/</code>).</Notice>

      {edit && (
        <Card title={edit.id ? `Editing: ${edit.title || edit.id}` : 'New project'} icon="pencil">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Title"><input className={box} value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></Field>
            <Field label="Category"><select className={box} value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value as ProjectItem['category'] })}>{['UI/UX', 'BRANDING', 'WEBAPP', 'HARDWARE'].map((c) => <option key={c}>{c}</option>)}</select></Field>
            <div className="sm:col-span-2"><Field label="Description"><textarea className={box} rows={3} value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></Field></div>
            <Field label="Main image link"><input className={box} value={edit.image} placeholder="https://…" onChange={(e) => setEdit({ ...edit, image: e.target.value })} /></Field>
            <Field label="Tools used" hint="Separate with commas"><input className={box} value={(edit.tools || []).join(', ')} onChange={(e) => setEdit({ ...edit, tools: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} /></Field>
            <div className="sm:col-span-2"><Field label="Gallery images" hint="One link per line"><textarea className={box} rows={3} value={(edit.gallery || []).join('\n')} onChange={(e) => setEdit({ ...edit, gallery: e.target.value.split('\n').map((x) => x.trim()).filter(Boolean) })} /></Field></div>
            <Field label="Client type (optional)"><input className={box} value={edit.clientType || ''} onChange={(e) => setEdit({ ...edit, clientType: e.target.value })} /></Field>
            <Field label="Real result or metric (optional)" hint="Leave empty if you have none"><input className={box} value={edit.metrics || ''} onChange={(e) => setEdit({ ...edit, metrics: e.target.value })} /></Field>
            <div className="sm:col-span-2"><Field label="Live site link (optional)" hint="/demo/your-site from the Studio, or https://…"><input className={box} value={edit.liveUrl || ''} onChange={(e) => setEdit({ ...edit, liveUrl: e.target.value })} /></Field></div>
          </div>
          <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-zinc-300"><input type="checkbox" className="accent-[var(--accent)]" checked={!!edit.featured} onChange={(e) => setEdit({ ...edit, featured: e.target.checked })} />Show on the home page <span className="text-xs text-zinc-500">(the first 3 featured)</span></label>
          <div className="mt-4 flex gap-2"><button className={primary} onClick={() => run('project.save', { project: edit })}>Save project</button><button className={btn} onClick={() => setEdit(null)}>Cancel</button></div>
        </Card>
      )}

      {items.length === 0 && !edit ? (
        <div className="rounded-2xl border border-dashed border-zinc-800"><Empty icon="star" title="No projects yet" text="Add your first project to show it on the public site." /></div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {items.map((p, i) => (
            <li key={p.id} className="group flex gap-3 overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-3 transition hover:border-zinc-700">
              {p.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.image} alt="" className="h-20 w-20 flex-none rounded-xl bg-zinc-800 object-cover" loading="lazy" />
              ) : <span className="flex h-20 w-20 flex-none items-center justify-center rounded-xl bg-zinc-800 text-zinc-600"><Icon name="layout" size={22} /></span>}
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-start gap-2"><span className="min-w-0 flex-1 truncate text-sm font-semibold text-zinc-100">{p.title}</span>{p.featured && <Badge tone="accent">Featured</Badge>}</div>
                <div className="mt-0.5 truncate font-mono text-[11px] text-zinc-500">{p.category} · {p.id}</div>
                <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-2">
                  <AButton small disabled={i === 0} onClick={() => run('project.move', { id: p.id, dir: 'up' })} title="Move up" icon="arrowUp" />
                  <AButton small disabled={i === items.length - 1} onClick={() => run('project.move', { id: p.id, dir: 'down' })} title="Move down"><Icon name="arrowUp" size={14} className="rotate-180" /></AButton>
                  <AButton small icon="pencil" onClick={() => setEdit(p)}>Edit</AButton>
                  <AButton small danger icon="trash" onClick={() => confirm(`Delete “${p.title}”?`) && run('project.delete', { id: p.id })} title="Delete" />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
