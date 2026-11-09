// src/app/admin/health/page.tsx — environment checklist, storage status, deployment info, SEO audit and a latency check.
'use client';
import { useState } from 'react';
import Icon from '@/components/ui/Icon';
import { api, useApi } from '@/lib/admin/client';
import type { EnvCheck, PageAudit } from '@/lib/admin/health';
import { ROUTES } from '@/lib/siteMap';
import { AButton, Badge, Card, ErrorBox, Notice, PageHead, Skel, useToast } from '@/components/admin/ui';

interface Health { env: EnvCheck[]; store: { mode: string; ok: boolean; ms: number; error?: string }; runtime: { node: string; region: string; vercelEnv: string; commit: string; branch: string; commitMsg: string }; at: number }
interface Seo { origin: string; pages: PageAudit[]; avg: number; at: number }

const ring = (n: number) => (n >= 90 ? 'text-emerald-300' : n >= 70 ? 'text-amber-300' : 'text-rose-300');

export default function HealthPage() {
  const toast = useToast();
  const { data, error, reload } = useApi<Health>('/api/admin/health');
  const [seo, setSeo] = useState<Seo | null>(null);
  const [seoBusy, setSeoBusy] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [pings, setPings] = useState<Array<{ path: string; ms: number[]; status: number }> | null>(null);
  const [pingBusy, setPingBusy] = useState(false);

  const runSeo = async () => { setSeoBusy(true); try { setSeo(await api<Seo>('/api/admin/seo')); } catch (e) { toast(e instanceof Error ? e.message : 'Audit failed', 'err'); } finally { setSeoBusy(false); } };
  const runPing = async () => {
    setPingBusy(true); const out: NonNullable<typeof pings> = [];
    for (const r of ROUTES) {
      const ms: number[] = []; let status = 0;
      for (let i = 0; i < 3; i++) { const t = performance.now(); try { const res = await fetch(r.path, { cache: 'no-store', credentials: 'omit' }); status = res.status; await res.arrayBuffer(); } catch { status = 0; } ms.push(Math.round(performance.now() - t)); }
      out.push({ path: r.path, ms, status }); setPings([...out]);
    }
    setPingBusy(false);
  };

  return (
    <>
      <PageHead title="Health" sub="Is everything switched on, and how does the site look to a search engine?" icon="bolt" right={<AButton icon="refresh" small onClick={reload}>Re-check</AButton>} />
      {error && <ErrorBox text={error} retry={reload} />}
      {!data && !error && <Skel h="h-64" />}
      {data && (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Setup checklist" icon="check">
              <ul className="space-y-2">{data.env.map((e) => (
                <li key={e.name} className="flex items-start gap-3 rounded-lg border border-zinc-800 bg-zinc-900/40 p-2.5"><Icon name={e.set ? 'check' : 'bell'} size={15} className={`mt-0.5 shrink-0 ${e.set ? 'text-emerald-300' : e.required ? 'text-rose-300' : 'text-amber-300'}`} />
                  <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><code className="break-all font-mono text-xs text-zinc-200">{e.name}</code>{e.required && <Badge tone={e.set ? 'ok' : 'bad'}>{e.set ? 'set' : 'required'}</Badge>}{!e.required && <Badge tone={e.set ? 'ok' : 'default'}>{e.set ? 'on' : 'optional'}</Badge>}</div><p className="text-xs text-zinc-500">{e.purpose}{!e.set && <span className="text-zinc-600"> · {e.hint}</span>}</p></div></li>))}</ul>
            </Card>
            <div className="space-y-4">
              <Card title="Storage" icon="disk" right={<Badge tone={data.store.ok ? (data.store.mode === 'upstash' ? 'ok' : 'warn') : 'bad'}>{data.store.mode === 'upstash' ? 'upstash redis' : 'temporary memory'}</Badge>}>
                <p className="text-sm text-zinc-300">{data.store.ok ? `Read/write test passed in ${data.store.ms} ms.` : `Storage check failed: ${data.store.error || 'unknown error'}`}</p>
                {data.store.mode === 'memory' && <Notice tone="warn" title="Data is lost when the server restarts"><ol className="mt-1 list-decimal space-y-0.5 pl-4"><li>In Vercel open your project → Storage → Create → Upstash Redis (free plan).</li><li>Connect it to this project; Vercel adds the environment variables for you.</li><li>Redeploy. Analytics, inbox, board and settings then persist for good.</li></ol></Notice>}
                {data.store.mode === 'upstash' && <p className="mt-2 text-[11px] text-zinc-500">Each page view costs about a dozen Redis commands, so the free plan comfortably covers a few tens of thousands of views a month.</p>}
              </Card>
              <Card title="Deployment" icon="globe"><dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 font-mono text-xs">{[['Environment', data.runtime.vercelEnv], ['Region', data.runtime.region || 'n/a'], ['Node', data.runtime.node], ['Branch', data.runtime.branch || 'n/a'], ['Commit', data.runtime.commit || 'n/a']].map(([k, v]) => <div key={k} className="contents"><dt className="text-zinc-500">{k}</dt><dd className="truncate text-zinc-300">{v}</dd></div>)}</dl>{data.runtime.commitMsg && <p className="mt-2 truncate text-xs text-zinc-500">“{data.runtime.commitMsg}”</p>}</Card>
            </div>
          </div>

          <Card title="SEO and quality audit" icon="search" right={<div className="flex items-center gap-3">{seo && <span className={`font-mono text-lg font-bold ${ring(seo.avg)}`}>{seo.avg}<span className="text-[10px] text-zinc-500">/100</span></span>}<AButton variant="solid" small icon="play" onClick={runSeo} disabled={seoBusy}>{seoBusy ? 'Auditing…' : seo ? 'Run again' : 'Run audit'}</AButton></div>} pad={false}>
            {!seo ? <p className="p-6 text-center text-sm text-zinc-500">Fetches each page the way a search engine would and checks titles, descriptions, headings, image alt text, mobile settings and speed.</p> : (
              <ul className="divide-y divide-zinc-800/70">{seo.pages.map((p) => (
                <li key={p.path}><button type="button" onClick={() => setOpen(open === p.path ? null : p.path)} aria-expanded={open === p.path} className="flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left hover:bg-zinc-900/50"><span className={`w-10 font-mono text-sm font-bold ${ring(p.score)}`}>{p.score}</span><span className="min-w-0 flex-1 truncate font-mono text-xs text-zinc-200">{p.path}</span><Badge tone={p.status >= 400 || !p.status ? 'bad' : 'default'}>{p.status || 'ERR'}</Badge><span className="w-16 text-right font-mono text-[10px] text-zinc-500">{p.ms} ms</span><Icon name="arrow" size={12} className={`text-zinc-600 transition ${open === p.path ? 'rotate-90' : ''}`} /></button>
                  {open === p.path && <div className="space-y-2 bg-zinc-950/50 px-4 py-3 text-xs">{p.error && <p className="text-rose-300">Could not fetch: {p.error}</p>}<p className="text-zinc-400"><span className="text-zinc-600">Title:</span> {p.title || '—'}</p><p className="text-zinc-400"><span className="text-zinc-600">Description:</span> {p.description || '—'}</p><p className="font-mono text-[10px] text-zinc-600">h1 ×{p.h1} · images {p.imgs} ({p.imgsNoAlt} without alt) · lang {p.lang || '—'} · viewport {p.viewport ? 'yes' : 'no'} · canonical {p.canonical ? 'yes' : 'no'} · OG {p.og ? 'yes' : 'no'}</p>{p.issues.length === 0 ? <p className="text-emerald-300">No issues found.</p> : <ul className="list-disc space-y-0.5 pl-5 text-amber-200">{p.issues.map((i) => <li key={i}>{i}</li>)}</ul>}</div>}</li>))}</ul>)}
          </Card>

          <Card title="Speed check from your browser" icon="clock" right={<AButton small icon="play" onClick={runPing} disabled={pingBusy}>{pingBusy ? 'Measuring…' : 'Measure'}</AButton>}>
            {!pings ? <p className="py-4 text-center text-sm text-zinc-500">Loads each page three times and reports how long the server takes. This measures your connection to the site, not your visitors’.</p> : (
              <ul className="space-y-2">{pings.map((p) => { const best = Math.min(...p.ms); return <li key={p.path} className="flex items-center gap-3 font-mono text-xs"><span className="w-28 shrink-0 truncate text-zinc-300">{p.path}</span><div className="h-2 flex-1 overflow-hidden rounded bg-zinc-800"><div className={`h-full ${best > 1500 ? 'bg-rose-400' : best > 700 ? 'bg-amber-400' : 'bg-emerald-400'}`} style={{ width: `${Math.min(100, (best / 2000) * 100)}%` }} /></div><span className="w-24 text-right text-zinc-400">{p.status || 'ERR'} · {best} ms</span></li>; })}</ul>)}
          </Card>
        </div>
      )}
    </>
  );
}
