// src/components/builder/RecoverScreen.tsx — shown when a customer site cannot be opened: never a dead end.
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { listProjects, parseEditLink, type SavedProject } from '@/lib/builder/access';

export default function RecoverScreen({ id, target = 'edit' }: { id: string; target?: 'edit' | 'view' }) {
  const [saved, setSaved] = useState<SavedProject[]>([]);
  const [paste, setPaste] = useState('');
  const [err, setErr] = useState('');
  useEffect(() => { setSaved(listProjects()); }, []);

  const open = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseEditLink(paste, id);
    if (!parsed) return setErr('That does not look like an edit link. It should contain "id=PRJ-..." and "key=...". If you only have the key, open this page from your saved link so the site can be found.');
    window.location.href = `/builder/${target}?id=${encodeURIComponent(parsed.id)}&key=${encodeURIComponent(parsed.key)}`;
  };
  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-xl flex-col justify-center gap-6 px-5 py-10">
      <div>
        <h1 className="text-xl font-bold text-zinc-100">{id ? 'We need your edit link to open this site' : 'Which site would you like to open?'}</h1>
        <p className="mt-2 text-sm text-zinc-400">
          {id ? <>Site <span className="font-mono text-accent">{id}</span> is not saved on this device. </> : null}
          Each site has a private edit link (we showed it when you started). Paste it below and you are back in.
        </p>
      </div>
      <form onSubmit={open} className="space-y-3">
        <label className="block text-xs font-mono text-zinc-400" htmlFor="edit-link">PASTE YOUR EDIT LINK</label>
        <input id="edit-link" value={paste} onChange={(e) => { setPaste(e.target.value); setErr(''); }} placeholder="https://.../builder/edit?id=PRJ-...&key=..." autoComplete="off" spellCheck={false}
          className="min-h-11 w-full rounded border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 focus:border-accent focus:outline-none" />
        {err && <p role="alert" className="text-xs text-red-400">{err}</p>}
        <button type="submit" className="min-h-11 rounded bg-accent-strong px-5 font-mono text-xs font-semibold text-black">OPEN MY SITE</button>
      </form>
      {saved.length > 0 && (
        <div>
          <div className="mb-2 text-xs font-mono text-zinc-400">OR PICK ONE SAVED ON THIS DEVICE</div>
          <ul className="space-y-2">
            {saved.map((s) => (
              <li key={s.id}>
                <Link href={`/builder/${target}?id=${encodeURIComponent(s.id)}`} className="flex min-h-11 items-center justify-between rounded border border-zinc-800 bg-zinc-900/40 px-3 text-sm text-zinc-200 hover:border-accent">
                  <span className="truncate">{s.name || s.template || s.id}</span><span className="font-mono text-[11px] text-zinc-500">{s.id}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      <Link href="/builder" className="text-sm text-accent underline">Start a new site or choose a design</Link>
    </div>
  );
}
