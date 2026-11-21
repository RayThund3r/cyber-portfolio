// src/components/builder/ImportBackup.tsx — "I have a backup file": turns it back into an editable site.
'use client';

import { useRef, useState } from 'react';
import { importBackup, parseBackup } from '@/lib/builder/localCopy';
import { rememberProject } from '@/lib/builder/access';
import { post } from './lib';

export default function ImportBackup({ label = 'Open a backup file (.json)' }: { label?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const pick = async (f?: File) => {
    if (!f) return;
    setErr(''); setBusy(true);
    try {
      if (f.size > 20 * 1024 * 1024) throw new Error('That file is too big to be a site backup.');
      const b = parseBackup(await f.text());
      if (!b) throw new Error('That is not a site backup. Use the file saved by the editor’s “Backup” button.');
      const r = await importBackup(post, b);
      rememberProject({ id: r.id, key: r.key, name: b.name, template: b.templateName || '' });
      window.location.assign(`/builder/edit?id=${encodeURIComponent(r.id)}&key=${encodeURIComponent(r.key)}`);
    } catch (e: any) { setErr(e.message || 'Could not open that file.'); setBusy(false); }
  };
  return (
    <div className="flex flex-col items-center gap-2">
      <input ref={ref} type="file" accept="application/json,.json" className="sr-only" aria-label={label} onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ''; }} />
      <button type="button" disabled={busy} onClick={() => ref.current?.click()} className="min-h-11 rounded border border-zinc-700 px-4 font-mono text-xs text-zinc-200 hover:border-cyan-400 disabled:opacity-50 cursor-pointer">{busy ? 'OPENING…' : label.toUpperCase()}</button>
      {err && <p role="alert" className="max-w-sm text-xs text-red-400">{err}</p>}
    </div>
  );
}
