// src/app/admin/board/page.tsx — a small kanban for your own to-dos; saved on the server so it follows you between devices.
'use client';
import { useEffect, useRef, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { api, useApi } from '@/lib/admin/client';
import { AButton, Card, ErrorBox, inputCls, PageHead, Skel, useToast } from '@/components/admin/ui';

type Col = 'todo' | 'doing' | 'done';
interface CardT { id: string; text: string; col: Col; tag: string; ts: number }
const COLS: Array<{ id: Col; label: string }> = [{ id: 'todo', label: 'To do' }, { id: 'doing', label: 'In progress' }, { id: 'done', label: 'Done' }];
const TAGS = ['repair', 'design', 'web', 'admin', 'idea'];
const TAG_CLS: Record<string, string> = { repair: 'border-amber-500/40 text-amber-300', design: 'border-violet-500/40 text-violet-300', web: 'border-accent/40 text-accent', admin: 'border-zinc-500 text-zinc-300', idea: 'border-emerald-500/40 text-emerald-300' };
const uid = () => Math.random().toString(36).slice(2, 9);

export default function BoardPage() {
  const toast = useToast();
  const { data, error, reload } = useApi<{ cards: CardT[] }>('/api/admin/board');
  const [cards, setCards] = useState<CardT[] | null>(null);
  const [text, setText] = useState('');
  const [tag, setTag] = useState('');
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<Col | null>(null);
  const loaded = useRef(false);
  const timer = useRef<number | null>(null);
  useEffect(() => { if (data && !loaded.current) { loaded.current = true; setCards(data.cards); } }, [data]);

  const persist = (next: CardT[]) => {
    setCards(next);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { api('/api/admin/board', { method: 'PUT', body: { cards: next } }).catch((e) => toast(e instanceof Error ? e.message : 'Could not save the board', 'err')); }, 500);
  };
  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);
  const add = (e: React.FormEvent) => { e.preventDefault(); const t = text.trim(); if (!t || !cards) return; persist([{ id: uid(), text: t.slice(0, 300), col: 'todo', tag, ts: Date.now() }, ...cards]); setText(''); };
  const move = (id: string, col: Col) => cards && persist(cards.map((c) => (c.id === id ? { ...c, col } : c)));
  const del = (id: string) => cards && persist(cards.filter((c) => c.id !== id));
  const order: Col[] = ['todo', 'doing', 'done'];

  return (
    <>
      <PageHead title="Board" sub="Your private to-do list. Drag cards between columns, or use the arrows on a phone." icon="puzzle" right={cards && cards.some((c) => c.col === 'done') && <AButton small icon="refresh" onClick={() => persist(cards.filter((c) => c.col !== 'done'))}>Clear done</AButton>} />
      {error && <ErrorBox text={error} retry={reload} />}
      {!cards && !error && <Skel h="h-64" />}
      {cards && (
        <div className="space-y-4">
          <form onSubmit={add} className="flex flex-wrap gap-2"><input value={text} onChange={(e) => setText(e.target.value)} maxLength={300} placeholder="Add a task, e.g. “Call Ann about the screen repair”" aria-label="New task" className={`${inputCls} min-w-0 flex-1`} />
            <select value={tag} onChange={(e) => setTag(e.target.value)} aria-label="Tag" className={`${inputCls} w-32`}><option value="">no tag</option>{TAGS.map((t) => <option key={t}>{t}</option>)}</select><AButton type="submit" variant="solid" icon="check" disabled={!text.trim()}>Add</AButton></form>
          <div className="grid gap-4 md:grid-cols-3">
            {COLS.map((col) => {
              const items = cards.filter((c) => c.col === col.id);
              return (
                <Card key={col.id} title={`${col.label} (${items.length})`} className={over === col.id ? 'ring-1 ring-accent' : ''}>
                  <div className="min-h-24 space-y-2" onDragOver={(e) => { e.preventDefault(); setOver(col.id); }} onDragLeave={() => setOver(null)} onDrop={(e) => { e.preventDefault(); if (drag) move(drag, col.id); setDrag(null); setOver(null); }} role="list" aria-label={col.label}>
                    {items.length === 0 && <p className="py-6 text-center text-xs text-zinc-600">{col.id === 'todo' ? 'Nothing waiting.' : 'Drop a card here.'}</p>}
                    {items.map((c) => (
                      <div key={c.id} role="listitem" draggable onDragStart={() => setDrag(c.id)} onDragEnd={() => { setDrag(null); setOver(null); }} className={`group cursor-grab rounded-lg border border-zinc-800 bg-zinc-950/70 p-2.5 text-sm text-zinc-200 active:cursor-grabbing ${drag === c.id ? 'opacity-40' : ''}`}>
                        <p className={`break-words ${col.id === 'done' ? 'text-zinc-500 line-through' : ''}`}>{c.text}</p>
                        <div className="mt-2 flex items-center gap-1.5">{c.tag && <span className={`rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase ${TAG_CLS[c.tag] || 'border-zinc-700 text-zinc-400'}`}>{c.tag}</span>}
                          <span className="ml-auto flex gap-1">{order.indexOf(col.id) > 0 && <button type="button" aria-label="Move back" onClick={() => move(c.id, order[order.indexOf(col.id) - 1])} className="cursor-pointer rounded border border-zinc-700 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400 hover:text-accent">←</button>}{order.indexOf(col.id) < 2 && <button type="button" aria-label="Move forward" onClick={() => move(c.id, order[order.indexOf(col.id) + 1])} className="cursor-pointer rounded border border-zinc-700 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400 hover:text-accent">→</button>}<button type="button" aria-label="Delete task" onClick={() => del(c.id)} className="cursor-pointer rounded border border-zinc-700 p-1 text-zinc-500 hover:border-rose-500/50 hover:text-rose-300"><Icon name="undo" size={11} /></button></span></div>
                      </div>))}
                  </div>
                </Card>);
            })}
          </div>
        </div>
      )}
    </>
  );
}
