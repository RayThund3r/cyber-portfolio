// src/components/admin/SettingsPanel.tsx — owner controls for the whole public site: business details, maintenance mode, SEO, switches.
'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Icon from '@/components/ui/IconAny';
import { DEFAULT_SETTINGS, type SiteSettings } from '@/lib/siteSettings';
import { api, box, primary } from './adminKit';
import PricingPanel from './PricingPanel';

const Card = ({ title, icon, children, hint }: { title: string; icon: string; children: ReactNode; hint?: string }) => (
  <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
    <h3 className="flex items-center gap-2 font-mono text-xs text-cyan-400"><Icon name={icon} /> {title}</h3>
    {hint && <p className="text-xs text-zinc-500">{hint}</p>}
    {children}
  </div>
);
const Field = ({ label, children }: { label: string; children: ReactNode }) => <label className="block text-xs text-zinc-400">{label}<div className="mt-1">{children}</div></label>;
const Switch = ({ on, set, label }: { on: boolean; set: (v: boolean) => void; label: string }) => (
  <button type="button" role="switch" aria-checked={on} onClick={() => set(!on)} className="flex w-full min-h-11 items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-left text-sm text-zinc-200">
    <span>{label}</span><span className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors ${on ? 'bg-emerald-500' : 'bg-zinc-700'}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} /></span>
  </button>
);

export default function SettingsPanel() {
  const [s, setS] = useState<SiteSettings | null>(null);
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => { api<{ settings: SiteSettings }>('settings.get').then((d) => { setS(d.settings); setSaved(JSON.stringify(d.settings)); }).catch((e) => setMsg({ ok: false, text: e.message })); }, []);
  if (!s) return <p className="text-sm text-zinc-400">{msg?.text || 'Loading…'}</p>;
  const dirty = JSON.stringify(s) !== saved;
  const up = <K extends keyof SiteSettings>(k: K, patch: Partial<SiteSettings[K]>) => setS({ ...s, [k]: { ...s[k], ...patch } });
  const save = async () => {
    if (s.maintenance.enabled && !confirm('Maintenance mode hides the whole public site from visitors (you can still use /admin). Turn it on?')) return;
    setBusy(true); setMsg(null);
    try { const d = await api<{ settings: SiteSettings }>('settings.save', { settings: s }); setS(d.settings); setSaved(JSON.stringify(d.settings)); setMsg({ ok: true, text: 'Saved. The public site now shows these settings.' }); } catch (e: any) { setMsg({ ok: false, text: e.message }); } finally { setBusy(false); }
  };

  return (
    <section className="space-y-5">
      <div><h2 className="font-mono text-xs text-cyan-400">SITE SETTINGS</h2><p className="mt-1 text-sm text-zinc-400">Change what visitors see across the whole website. Leave a field empty to use the built-in value.</p></div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="BUSINESS DETAILS" icon="store" hint="Shown in the footer and used by the chat assistant and WhatsApp buttons.">
          <Field label="Business name"><input className={box} value={s.business.name} onChange={(e) => up('business', { name: e.target.value })} maxLength={60} /></Field>
          <Field label="Tagline"><input className={box} value={s.business.tagline} onChange={(e) => up('business', { tagline: e.target.value })} maxLength={120} /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Phone"><input className={box} value={s.business.phone} onChange={(e) => up('business', { phone: e.target.value })} inputMode="tel" /></Field>
            <Field label="WhatsApp (digits, with country code)"><input className={box} value={s.business.whatsapp} onChange={(e) => up('business', { whatsapp: e.target.value })} inputMode="numeric" placeholder="256700000000" /></Field>
          </div>
          <Field label="Email"><input className={box} value={s.business.email} onChange={(e) => up('business', { email: e.target.value })} inputMode="email" /></Field>
          <Field label="Address / location"><input className={box} value={s.business.address} onChange={(e) => up('business', { address: e.target.value })} maxLength={160} /></Field>
          <Field label="Opening hours"><input className={box} value={s.business.hours} onChange={(e) => up('business', { hours: e.target.value })} placeholder="Mon–Sat, 8am–7pm" maxLength={120} /></Field>
        </Card>
        <div className="space-y-5">
          <Card title="MAINTENANCE MODE" icon="wrench" hint="Hides the public site behind a friendly message. /admin keeps working so you can switch it off.">
            <Switch on={s.maintenance.enabled} set={(v) => up('maintenance', { enabled: v })} label="Maintenance mode is ON" />
            <Field label="Message visitors see"><textarea className={`${box} min-h-[70px]`} value={s.maintenance.message} onChange={(e) => up('maintenance', { message: e.target.value })} maxLength={400} /></Field>
          </Card>
        </div>
        <Card title="SOCIAL LINKS" icon="share" hint="A handle (like mybrand) or a full https:// link. Shown in the footer.">
          <div className="grid gap-3 sm:grid-cols-2">
            {(['instagram', 'facebook', 'tiktok', 'youtube', 'x'] as const).map((k) => <Field key={k} label={k[0].toUpperCase() + k.slice(1)}><input className={box} value={s.social[k]} onChange={(e) => up('social', { [k]: e.target.value } as any)} /></Field>)}
          </div>
        </Card>
        <Card title="GOOGLE & SHARING TEXT" icon="search" hint="The title and description search engines and link previews show for the home page.">
          <Field label={`Title (${s.seo.title.length}/70)`}><input className={box} value={s.seo.title} onChange={(e) => up('seo', { title: e.target.value })} maxLength={70} /></Field>
          <Field label={`Description (${s.seo.description.length}/170)`}><textarea className={`${box} min-h-[70px]`} value={s.seo.description} onChange={(e) => up('seo', { description: e.target.value })} maxLength={170} /></Field>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-xs"><div className="text-[#8ab4f8]">{s.seo.title || 'System Portfolio // Tech & Design Hub'}</div><div className="text-zinc-400">{s.seo.description || 'Your current description appears here.'}</div></div>
          <Switch on={s.features.chat} set={(v) => up('features', { chat: v })} label="Show the chat assistant" />
        </Card>
        <Card title="OPTIONAL FEATURES" icon="sparkles" hint="Off until you need them. Nothing changes for visitors while a switch is off.">
          <Switch on={s.features.smartPricing} set={(v) => up('features', { smartPricing: v })} label="Smart pricing for the website builder" />
          <p className="text-[11px] text-zinc-500">On: a customer&apos;s price follows what is in their website (sections, pictures, extras) with a live price and breakdown; the template price becomes the minimum. Off: the template&apos;s own price, as today. Set your rates below once it is on and saved.</p>
          <Switch on={s.features.dragDrop} set={(v) => up('features', { dragDrop: v })} label="Drag and drop reordering in the builder" />
          <p className="text-[11px] text-zinc-500">On: repeating items (cards, services, FAQs…) get a drag handle (mouse, finger or ↑/↓ keys) and a picture can be dropped onto a picture field. The existing arrow buttons keep working.</p>
        </Card>
      </div>
      {JSON.parse(saved || '{}')?.features?.smartPricing && <div className="border-t border-zinc-800 pt-5"><PricingPanel /></div>}
      <div className="sticky bottom-3 z-20 flex flex-wrap items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950/95 p-3 backdrop-blur">
        <button className={primary} onClick={save} disabled={busy || !dirty}>{busy ? 'Saving…' : 'Save settings'}</button>
        {dirty && <span className="font-mono text-[11px] text-amber-300">unsaved changes</span>}
        <button className="font-mono text-xs text-zinc-400 hover:text-zinc-200" onClick={() => setS(DEFAULT_SETTINGS)}>Clear everything</button>
        {msg && <span role="status" className={`text-xs ${msg.ok ? 'text-emerald-400' : 'text-red-400'}`}>{msg.text}</span>}
      </div>
    </section>
  );
}
