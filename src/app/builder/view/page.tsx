// src/app/builder/view/page.tsx — full-screen VIEWER.   ?id=PRJ-… (your project)   ·   ?t=<templateId> (a showcase design)
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import SiteViewer from '@/components/builder/SiteViewer';
import { post } from '@/components/builder/lib';
import { categoryOf, type SiteConfig } from '@/lib/builder/schema';
import RecoverScreen from '@/components/builder/RecoverScreen';
import { useProjectRef } from '@/utils/useProjectRef';

type Loaded = { title: string; subtitle: string; config: SiteConfig; assets: Record<string, string>; edit: () => void };

export default function ViewPage() {
  const router = useRouter();
  const ref = useProjectRef();
  const [tplId, setTplId] = useState<string | null | undefined>(undefined);
  const [data, setData] = useState<Loaded | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { setTplId(new URLSearchParams(window.location.search).get('t')); }, []);

  useEffect(() => {
    if (tplId === undefined) return;
    (async () => {
      try {
        if (tplId) {
          const { templates } = await (await fetch('/api/builder/templates')).json();
          const t = (templates || []).find((x: any) => x.id === tplId);
          if (!t) throw new Error('That design is not available.');
          setData({
            title: t.name, subtitle: `${categoryOf(t.category).icon} ${categoryOf(t.category).label}`, config: t.config, assets: {},
            edit: async () => { setBusy(true); try { const d = await post('/api/builder', { action: 'create', templateId: t.id }); router.push(`/builder/edit?id=${d.id}&key=${encodeURIComponent(d.key)}`); } catch (e: any) { setErr(e.message); setBusy(false); } },
          });
        } else if (ref && ref !== 'bad') {
          const d = await post('/api/builder', { action: 'load', id: ref.id, key: ref.key });
          setData({ title: d.name, subtitle: `${d.id} · ${d.templateName}`, config: d.config, assets: d.assets || {}, edit: () => router.push(`/builder/edit?id=${d.id}`) });
        } else if (ref === 'bad') throw new Error('We could not find that project on this device.');
      } catch (e: any) { setErr(e.message); }
    })();
  }, [tplId, ref, router]);

  if (ref === 'bad' && tplId === null) return <RecoverScreen id={new URLSearchParams(window.location.search).get('id')?.toUpperCase() || ''} target="view" />;
  if (err) return <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center gap-3 px-6 text-center"><p role="alert" className="text-sm text-red-300 max-w-sm">{err}</p><Link href="/builder" className="text-cyan-400 underline text-sm">← Browse designs</Link></div>;
  if (!data) return <div className="min-h-screen bg-zinc-950 text-zinc-400 flex items-center justify-center text-sm font-mono">Loading site…</div>;

  return (
    <SiteViewer
      config={data.config} assets={data.assets} title={data.title} subtitle={data.subtitle}
      onClose={() => router.push('/builder')}
      actions={<button disabled={busy} onClick={data.edit} className="px-4 py-2 rounded bg-cyan-500 text-black text-xs font-mono font-semibold hover:bg-cyan-400 disabled:opacity-50 cursor-pointer">{busy ? 'Starting…' : '✎ Edit →'}</button>}
    />
  );
}
