// src/components/admin/SettingsPanel.tsx — owner controls for the whole public site: business details, maintenance mode, SEO, switches.
'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Icon from '@/components/ui/IconAny';
import { DEFAULT_SETTINGS, type SiteSettings } from '@/lib/siteSettings';
import { api, box, primary } from './adminKit';
import PricingPanel from './PricingPanel';

const Card = ({ title, icon, children, hint }: { title: string; icon: string; children: ReactNode; hint?: string }) => (
  <section className="space-y-3.5 rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-4 shadow-sm shadow-black/20 sm:p-5">
    <header className="flex items-start gap-3">
      <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-accent/12 text-accent"><Icon name={icon} size={17} /></span>
      <div className="min-w-0"><h3 className="text-sm font-semibold text-zinc-100">{title}</h3>{hint && <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">{hint}</p>}</div>
    </header>
    {children}
  </section>
);
const Field = ({ label, children }: { label: string; children: ReactNode }) => <label className="block"><span className="mb-1 block text-xs font-medium text-zinc-400">{label}</span>{children}</label>;
const Switch = ({ on, set, label, hint, danger }: { on: boolean; set: (v: boolean) => void; label: string; hint?: string; danger?: boolean }) => (
  <button type="button" role="switch" aria-checked={on} onClick={() => set(!on)} className={`flex w-full min-h-12 cursor-pointer items-center justify-between gap-4 rounded-xl border px-3.5 py-2.5 text-left transition ${on ? (danger ? 'border-amber-500/40 bg-amber-500/[0.07]' : 'border-accent/35 bg-accent/[0.06]') : 'border-zinc-800 bg-zinc-950/50 hover:border-zinc-700'}`}>
    <span className="min-w-0"><span className="block text-sm font-medium text-zinc-100">{label}</span>{hint && <span className="mt-0.5 block text-xs leading-relaxed text-zinc-500">{hint}</span>}</span>
    <span className={`relative h-6 w-11 flex-none rounded-full transition-colors ${on ? (danger ? 'bg-amber-500' : 'bg-accent-strong') : 'bg-zinc-700'}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} /></span>
  </button>
);

export default function SettingsPanel() {
  const [s, setS] = useState<SiteSettings | null>(null);
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => { api<{ settings: SiteSettings }>('settings.get').then((d) => { setS(d.settings); setSaved(JSON.stringify(d.settings)); }).catch((e) => setMsg({ ok: false, text: e.message })); }, []);
  if (!s) return msg ? <p className="text-sm text-rose-300">{msg.text}</p> : <div className="space-y-4" aria-busy="true"><div className="h-64 animate-pulse rounded-2xl bg-zinc-900/70" /><div className="h-48 animate-pulse rounded-2xl bg-zinc-900/70" /></div>;
  const dirty = JSON.stringify(s) !== saved;
  const up = <K extends keyof SiteSettings>(k: K, patch: Partial<SiteSettings[K]>) => setS({ ...s, [k]: { ...s[k], ...patch } });
  const save = async () => {
    if (s.maintenance.enabled && !confirm('Maintenance mode hides the whole public site from visitors (you can still use /admin). Turn it on?')) return;
    setBusy(true); setMsg(null);
    try { const d = await api<{ settings: SiteSettings }>('settings.save', { settings: s }); setS(d.settings); setSaved(JSON.stringify(d.settings)); setMsg({ ok: true, text: 'Saved. The public site now shows these settings.' }); } catch (e: any) { setMsg({ ok: false, text: e.message }); } finally { setBusy(false); }
  };

  return (
    <section className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Business details" icon="store" hint="Shown in the footer and used by the chat assistant and WhatsApp buttons.">
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
          <Card title="Maintenance mode" icon="wrench" hint="Hides the public site behind a friendly message. /admin keeps working so you can switch it off.">
            <Switch danger on={s.maintenance.enabled} set={(v) => up('maintenance', { enabled: v })} label={s.maintenance.enabled ? 'Maintenance mode is ON' : 'Maintenance mode is off'} hint="Visitors see the message below instead of the site." />
            <Field label="Message visitors see"><textarea className={`${box} min-h-[70px]`} value={s.maintenance.message} onChange={(e) => up('maintenance', { message: e.target.value })} maxLength={400} /></Field>
          </Card>
        </div>
        <Card title="Social links" icon="share" hint="A handle (like mybrand) or a full https:// link. Shown in the footer.">
          <div className="grid gap-3 sm:grid-cols-2">
            {(['instagram', 'facebook', 'tiktok', 'youtube', 'x'] as const).map((k) => <Field key={k} label={k[0].toUpperCase() + k.slice(1)}><input className={box} value={s.social[k]} onChange={(e) => up('social', { [k]: e.target.value } as any)} /></Field>)}
          </div>
        </Card>
        <Card title="Google & sharing text" icon="search" hint="The title and description search engines and link previews show for the home page.">
          <Field label={`Title (${s.seo.title.length}/70)`}><input className={box} value={s.seo.title} onChange={(e) => up('seo', { title: e.target.value })} maxLength={70} /></Field>
          <Field label={`Description (${s.seo.description.length}/170)`}><textarea className={`${box} min-h-[70px]`} value={s.seo.description} onChange={(e) => up('seo', { description: e.target.value })} maxLength={170} /></Field>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-xs"><div className="text-[#8ab4f8]">{s.seo.title || 'System Portfolio // Tech & Design Hub'}</div><div className="text-zinc-400">{s.seo.description || 'Your current description appears here.'}</div></div>
          <Switch on={s.features.chat} set={(v) => up('features', { chat: v })} label="Show the chat assistant" hint="Turn it off to hide the chat bubble on every page." />
        </Card>
        <Card title="Optional features" icon="sparkles" hint="Off until you need them. Nothing changes for visitors while a switch is off.">
          <Switch on={s.features.smartPricing} set={(v) => up('features', { smartPricing: v })} label="Smart pricing for the website builder" hint="On: a customer's price follows what is in their website (sections, pictures, extras) with a live price and breakdown; the template price becomes the minimum. Off: the template's own price, as today. Set your rates below once it is on and saved." />
          <Switch on={s.features.dragDrop} set={(v) => up('features', { dragDrop: v })} label="Drag and drop reordering in the builder" hint="On: repeating items (cards, services, FAQs…) get a drag handle (mouse, finger or ↑/↓ keys) and a picture can be dropped onto a picture field. The existing arrow buttons keep working." />
        </Card>
      </div>
      {JSON.parse(saved || '{}')?.features?.smartPricing && <div className="border-t border-zinc-800 pt-5"><PricingPanel /></div>}
      <div className="sticky bottom-3 z-20 flex flex-wrap items-center gap-3 rounded-2xl border border-zinc-700/80 bg-zinc-950/90 p-3 shadow-xl shadow-black/40 backdrop-blur">
        <button className={`${primary} !min-h-10 !px-5`} onClick={save} disabled={busy || !dirty}>{busy ? 'Saving…' : 'Save settings'}</button>
        {dirty && <span className="flex items-center gap-1.5 text-xs text-amber-300"><span className="h-1.5 w-1.5 rounded-full bg-amber-400" />Unsaved changes</span>}
        <button className="cursor-pointer text-xs text-zinc-500 hover:text-zinc-200" onClick={() => setS(DEFAULT_SETTINGS)}>Reset all fields</button>
        {msg && <span role="status" className={`text-xs ${msg.ok ? 'text-emerald-400' : 'text-red-400'}`}>{msg.text}</span>}
      </div>
    </section>
  );
}
