// src/components/admin/TrainPanel.tsx — "home training": teach the chat assistant answers in your own words.
// Saved to the site's store; every visitor's chat loads them (see utils/chatEngine/brain.ts). No redeploy needed.
'use client';
import { useEffect, useMemo, useState } from 'react';
import { api, useApi } from '@/lib/admin/client';
import { AButton, Badge, Card, Empty, ErrorBox, Notice, Skel, inputCls, useToast } from '@/components/admin/ui';
import { processChatQuery } from '@/utils/chatEngine';
import { applyBrain } from '@/utils/chatEngine/brain';
import type { SessionMemory } from '@/utils/chatEngine/types';
import { ROUTES } from '@/lib/siteMap';
import type { Taught } from '@/lib/admin/brain';
import { mergeNew, parseBulk, suggestPhrasings } from '@/lib/admin/trainTools';

import { ask } from '@/lib/dialog';
const fresh = (): SessionMemory => ({ interactionCount: 0, lastTopic: 'GREETINGS', userContext: {}, conversationHistory: [] });

const TEMPLATES: Array<{ name: string; q: string[]; a: string }> = [
  { name: 'Opening hours', q: ['what are your opening hours', 'when are you open', 'what time do you open', 'are you open on sunday'], a: 'We are open **Monday to Saturday, 8:00am – 7:00pm**. Edit this to your real hours.' },
  { name: 'Payment methods', q: ['how can i pay', 'what payment methods do you accept', 'do you take mobile money', 'can i pay by card'], a: 'You can pay by **mobile money (MTN / Airtel)** or cash on collection. Edit this to match what you accept.' },
  { name: 'Warranty', q: ['do you give a warranty', 'is there a warranty on repairs', 'what if it breaks again'], a: 'Repairs come with a **warranty on the part and labour**. Tell us the length you offer.' },
  { name: 'Walk-ins', q: ['do you take walk ins', 'can i just come to your shop', 'do i need an appointment'], a: 'Walk-ins are welcome, but booking ahead means no waiting. You can book from the contact page.' },
  { name: 'Location', q: ['where are you located', 'where is your shop', 'what is your address', 'how do i find you'], a: 'We are in **Ndejje, Makindye Ssabagabo**. Edit this with landmarks or a map link.' },
  { name: 'How long does a repair take', q: ['how long does a repair take', 'how fast can you fix it', 'turnaround time', 'when will it be ready'], a: 'Most repairs are done the **same day or within 2–3 days**. We confirm the time after we diagnose it.' },
  { name: 'Diagnosis fee', q: ['do you charge for diagnosis', 'is checking my device free', 'how much to check my phone'], a: 'Tell us whether checking is free and what happens if the repair goes ahead.' },
  { name: 'My data / privacy', q: ['is my data safe', 'will you see my photos', 'will i lose my files'], a: 'We do not need your files. Back up first if you can, and we treat everything on the device as **private**.' },
  { name: 'Design turnaround', q: ['how long does a logo take', 'how long for a design', 'how many revisions do i get'], a: 'A logo or flyer usually takes **2–5 days**, with revisions included. Edit to your real terms.' },
  { name: 'Website cost', q: ['how much is a website', 'website price', 'how much do you charge for a website'], a: 'It depends on pages and features. Tell us what you need and we will **quote you before any work starts**.' },
  { name: 'Contact / WhatsApp', q: ['how do i contact you', 'whatsapp number', 'can i call you'], a: 'Reach us from the **contact page** or on WhatsApp. Add your number here.' },
  { name: 'Delivery / pickup', q: ['do you deliver', 'can you pick up my device', 'do you do home service'], a: 'Tell us how pickup or delivery works for you.' },
];

const blank = { id: '', q: '', a: '', link: '', off: false };

export default function TrainPanel({ seed, onSeedUsed }: { seed: string; onSeedUsed: () => void }) {
  const toast = useToast();
  const res = useApi<{ entries: Taught[] }>('/api/admin/brain');
  const [list, setList] = useState<Taught[] | null>(null);
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [test, setTest] = useState<{ q: string; out: string; src: string } | null>(null);
  const [filter, setFilter] = useState('');
  const [bulk, setBulk] = useState('');
  const [cover, setCover] = useState<Array<{ q: string; hit: boolean; src: string }> | null>(null);

  useEffect(() => { if (res.data) setList(res.data.entries); }, [res.data]);
  useEffect(() => { if (seed) { setForm({ ...blank, q: seed }); onSeedUsed(); } }, [seed, onSeedUsed]);

  // Leaving the tab restores the saved set (a test may have previewed an unsaved draft), so the Playground matches what visitors get.
  useEffect(() => () => { void api<{ entries: Taught[] }>('/api/admin/brain').then((r) => applyBrain(r.entries.filter((e) => !e.off).map((e) => ({ id: e.id, q: e.q, a: e.a, l: e.link })))).catch(() => undefined); }, []);

  const shown = useMemo(() => (list || []).filter((e) => !filter || (e.q.join(' ') + ' ' + e.a).toLowerCase().includes(filter.toLowerCase())), [list, filter]);
  const phrasings = form.q.split('\n').map((s) => s.trim()).filter(Boolean);
  const valid = phrasings.length > 0 && form.a.trim().length >= 2;

  async function persist(next: Taught[], msg: string) {
    setBusy(true);
    try {
      const out = await api<{ entries: Taught[] }>('/api/admin/brain', { method: 'PUT', body: { entries: next } });
      setList(out.entries); toast(msg, 'ok'); return true;
    } catch (e) { toast(e instanceof Error ? e.message : 'Could not save', 'err'); return false; }
    finally { setBusy(false); }
  }

  async function save() {
    if (!valid) return;
    const entry: Taught = { id: form.id || 'b' + Date.now().toString(36), q: phrasings, a: form.a.trim(), link: form.link || undefined, off: form.off || undefined, t: Date.now() };
    const next = form.id ? (list || []).map((e) => (e.id === form.id ? entry : e)) : [entry, ...(list || [])];
    if (await persist(next, form.id ? 'Answer updated. Visitors get it within a minute.' : 'Taught! Visitors get it within a minute.')) setForm(blank);
  }

  async function runTest(q: string) {
    const draft = valid ? [{ id: 'draft', q: phrasings, a: form.a.trim(), l: form.link || undefined }] : [];
    // Preview with the saved answers PLUS the one being edited, on the real engine.
    applyBrain([...(list || []).filter((e) => !e.off && e.id !== form.id).map((e) => ({ id: e.id, q: e.q, a: e.a, l: e.link })), ...draft]);
    try {
      const r = await processChatQuery(q, 'HUMAN', fresh(), { pathname: '/' });
      setTest({ q, out: r.reply, src: r.matchedEntryId?.startsWith('taught:') ? 'your taught answer' : r.source });
    } catch (e) { setTest({ q, out: e instanceof Error ? e.message : 'engine error', src: 'error' }); }
  }

  const bulkParsed = useMemo(() => parseBulk(bulk), [bulk]);
  async function addBulk() {
    const { next, added, skipped } = mergeNew(list || [], bulkParsed);
    if (!added) { toast(skipped ? 'Those questions are already taught' : 'Nothing to add yet', 'err'); return; }
    if (await persist(next, `Taught ${added} answer${added === 1 ? '' : 's'}${skipped ? ` (${skipped} skipped, already taught)` : ''}`)) setBulk('');
  }
  function suggest() {
    const more = suggestPhrasings(phrasings[0] || '', phrasings);
    if (!more.length) { toast('Type the main question first', 'err'); return; }
    setForm({ ...form, q: [...phrasings, ...more].slice(0, 12).join('\n') });
  }
  /** Runs every phrasing through the real engine and shows which ones actually land on this answer. */
  async function checkCoverage() {
    if (!valid) return;
    applyBrain([...(list || []).filter((e) => !e.off && e.id !== form.id).map((e) => ({ id: e.id, q: e.q, a: e.a, l: e.link })), { id: 'draft', q: phrasings, a: form.a.trim(), l: form.link || undefined }]);
    const rows: Array<{ q: string; hit: boolean; src: string }> = [];
    for (const q of phrasings) {
      try { const r = await processChatQuery(q, 'HUMAN', fresh(), { pathname: '/' }); rows.push({ q, hit: r.matchedEntryId === 'taught:draft' || r.reply.trim() === form.a.trim(), src: r.source }); }
      catch { rows.push({ q, hit: false, src: 'error' }); }
    }
    setCover(rows);
  }

  if (res.error && !list) return <ErrorBox text={res.error} retry={res.reload} />;
  if (!list) return <Skel h="h-56" />;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <div className="space-y-4">
        <Notice title="Teach it once, every visitor gets it">Write the questions people ask (one per line, in their words) and the answer you want them to see. Your answers win over the built-in ones, so use this for things only you know: hours, prices, policies, news.</Notice>
        <Card title={form.id ? 'Edit answer' : 'Teach a new answer'} icon="brain" right={form.id ? <AButton small onClick={() => setForm(blank)}>Cancel edit</AButton> : undefined}>
          <div className="space-y-3">
            <label className="block"><span className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-zinc-500">Ways people ask it (one per line, up to 12)</span>
              <textarea value={form.q} onChange={(e) => setForm({ ...form, q: e.target.value })} rows={4} maxLength={1900} placeholder={'what are your opening hours\nwhen are you open\nopen on sunday?'} className={`${inputCls} py-2`} /></label>
            <label className="block"><span className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-zinc-500">Your answer</span>
              <textarea value={form.a} onChange={(e) => setForm({ ...form, a: e.target.value })} rows={5} maxLength={1800} placeholder="We are open **Mon–Sat 8am–7pm**." className={`${inputCls} py-2`} />
              <span className="mt-1 block text-[11px] text-zinc-600">**bold** and “- ” bullet lists work. {form.a.length}/1800</span></label>
            <div className="flex flex-wrap items-end gap-3">
              <label className="block min-w-40 flex-1"><span className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-zinc-500">Offer a button to a page (optional)</span>
                <select value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} className={inputCls}><option value="">None</option>{ROUTES.map((r) => <option key={r.path} value={r.path}>{r.title}</option>)}</select></label>
              <label className="flex min-h-10 cursor-pointer items-center gap-2 font-mono text-[11px] text-zinc-400"><input type="checkbox" checked={form.off} onChange={(e) => setForm({ ...form, off: e.target.checked })} /> Save as hidden</label>
            </div>
            <div className="flex flex-wrap gap-2">
              <AButton variant="solid" icon="check" onClick={save} disabled={!valid || busy}>{busy ? 'Saving…' : form.id ? 'Save changes' : 'Teach it'}</AButton>
              <AButton icon="play" onClick={() => phrasings[0] && runTest(phrasings[0])} disabled={!valid}>Test it</AButton>
              <AButton icon="bolt" onClick={suggest} disabled={!phrasings.length}>Suggest more ways to ask</AButton>
              <AButton icon="check" onClick={checkCoverage} disabled={!valid}>Check every phrasing</AButton>
            </div>
            {cover && <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3"><div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-zinc-500">{cover.filter((c) => c.hit).length} of {cover.length} phrasings reach this answer</div><ul className="space-y-1">{cover.map((c) => <li key={c.q} className="flex items-center gap-2 text-xs"><Badge tone={c.hit ? 'ok' : 'warn'}>{c.hit ? 'reaches it' : 'goes to ' + c.src}</Badge><span className="truncate text-zinc-300">{c.q}</span></li>)}</ul></div>}
            {test && <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3"><div className="mb-1 flex items-center gap-2"><Badge tone={test.src === 'your taught answer' ? 'ok' : 'warn'}>{test.src}</Badge><span className="font-mono text-[10px] text-zinc-500">“{test.q}”</span></div><div className="whitespace-pre-wrap text-sm text-zinc-200">{test.out}</div></div>}
          </div>
        </Card>
        <Card title="Quick starts" icon="bolt"><div className="flex flex-wrap gap-2">{TEMPLATES.map((t) => <AButton key={t.name} small onClick={() => setForm({ ...blank, q: t.q.join('\n'), a: t.a })}>{t.name}</AButton>)}</div><p className="mt-2 text-[11px] text-zinc-600">Pre-fills the form with common questions. Replace the answer with your real one, then save.</p></Card>
        <Card title="Bulk teach" icon="brain">
          <textarea value={bulk} onChange={(e) => setBulk(e.target.value)} rows={6} maxLength={20000} aria-label="Paste questions and answers" placeholder={'Q: opening hours | when are you open\nA: We are open **Mon–Sat 8am–7pm**.\n\ndo you deliver | home service => Yes, within Ndejje.'} className={`${inputCls} py-2 font-mono text-xs`} />
          <div className="mt-2 flex flex-wrap items-center gap-2"><AButton variant="solid" icon="check" onClick={addBulk} disabled={!bulkParsed.length || busy}>{bulkParsed.length ? `Teach ${bulkParsed.length} answer${bulkParsed.length === 1 ? '' : 's'}` : 'Teach them'}</AButton><span className="text-[11px] text-zinc-600">Paste a whole FAQ. Separate phrasings with “|”, blocks with a blank line. Questions already taught are skipped.</span></div>
        </Card>
      </div>

      <Card title={`Taught answers (${list.length})`} icon="chat" right={<input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter…" aria-label="Filter taught answers" className={`${inputCls} !min-h-8 w-32 !text-xs`} />} pad={false}>
        {shown.length === 0 ? <Empty icon="brain" title={list.length ? 'No match' : 'Nothing taught yet'} text={list.length ? 'Try a different word.' : 'Use a quick start, or teach it something from the Gaps tab.'} /> : (
          <ul className="max-h-[36rem] divide-y divide-zinc-800/70 overflow-y-auto">{shown.map((e) => (
            <li key={e.id} className="space-y-1.5 px-4 py-3">
              <div className="flex items-start gap-2"><div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold text-zinc-200">{e.q[0]}</div><div className="font-mono text-[10px] text-zinc-600">{e.q.length} phrasing{e.q.length === 1 ? '' : 's'}{e.link ? ` · button → ${e.link}` : ''}</div></div>{e.off && <Badge tone="warn">hidden</Badge>}</div>
              <p className="line-clamp-3 whitespace-pre-wrap text-xs text-zinc-400">{e.a}</p>
              <div className="flex flex-wrap gap-1.5">
                <AButton small onClick={() => { setForm({ id: e.id, q: e.q.join('\n'), a: e.a, link: e.link || '', off: !!e.off }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Edit</AButton>
                <AButton small onClick={() => persist((list || []).map((x) => (x.id === e.id ? { ...x, off: !x.off || undefined } : x)), e.off ? 'Visible again' : 'Hidden from visitors')}>{e.off ? 'Show' : 'Hide'}</AButton>
                <AButton small danger onClick={async () => { if (await ask('Delete this taught answer?', { danger: true, confirmLabel: 'Delete' })) void persist((list || []).filter((x) => x.id !== e.id), 'Deleted'); }}>Delete</AButton>
              </div>
            </li>))}</ul>)}
        <div className="flex flex-wrap gap-2 border-t border-zinc-800/80 px-4 py-3">
          <AButton small onClick={() => { const blob = new Blob([JSON.stringify(list, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'taught-answers.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }} >Export JSON</AButton>
          <label className="inline-flex min-h-8 cursor-pointer items-center rounded-lg border border-zinc-700 px-2.5 font-mono text-[11px] text-zinc-300 hover:border-accent/50">Import JSON<input type="file" accept="application/json,.json" className="sr-only" onChange={async (ev) => { const f = ev.target.files?.[0]; ev.target.value = ''; if (!f) return; try { const parsed = JSON.parse(await f.text()); if (!Array.isArray(parsed)) throw new Error('x'); const keep = new Set((list || []).map((x) => x.id)); const merged = [...(list || []), ...parsed.filter((x: Taught) => x && !keep.has(x.id))]; await persist(merged, 'Imported'); } catch { toast('That file is not a taught-answers export', 'err'); } }} /></label>
        </div>
      </Card>
    </div>
  );
}
