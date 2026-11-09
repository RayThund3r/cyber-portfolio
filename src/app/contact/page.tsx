// src/app/contact/page.tsx
//
// Contact / booking form. Combines:
//   * repair bookings with real appointment slots, tickets you can track, privacy consent and a
//     bot check (Cloudflare Turnstile, when configured)
//   * ?type=repair|design pre-selects the form (the chat's "book a repair" lands on the right one)
//   * the shared SiteNav replaces the page-level nav; errors scroll into view on phones
'use client';

import { Suspense, useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useTheme } from '@/context/ThemeContext';
import { collectSystemTelemetry, SystemTelemetryData } from '@/utils/telemetry';
import { hasWhatsApp, whatsappLink } from '@/utils/chatEngine/siteConfig';
import Turnstile, { turnstileEnabled } from '@/components/Turnstile';
import { trackEvent } from '@/utils/analytics';
import { parseContactType } from '@/lib/siteUrls';
import SuccessCheck from '@/components/ui/SuccessCheck';
import { buildIcs, downloadIcs } from '@/lib/calendar';
import { SITE } from '@/utils/chatEngine/siteConfig';

function ContactInner() {
  const { theme, themeClasses } = useTheme();
  const params = useSearchParams();
  const urlType = parseContactType(params.get('type'));
  const nonce = params.get('k'); // changes every time the chat re-opens the form

  const [formType, setFormType] = useState<'design' | 'repair'>(urlType ?? 'design');
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [ticket, setTicket] = useState<string | null>(null);
  const [honeypot, setHoneypot] = useState('');
  const [chatContext, setChatContext] = useState('');
  const [consent, setConsent] = useState(false);
  // Appointment booking (repairs)
  const [win, setWin] = useState<{ min: string; max: string; openDays: number[] } | null>(null);
  const [slotDate, setSlotDate] = useState('');
  const [slotTime, setSlotTime] = useState('');
  const [slotRefresh, setSlotRefresh] = useState(0);
  const [slots, setSlots] = useState<{ time: string; available: boolean }[]>([]);
  const [slotMsg, setSlotMsg] = useState<string | null>(null);
  const [copiedRef, setCopiedRef] = useState(false);
  const [bookedSlot, setBookedSlot] = useState<{ date: string; time: string } | null>(null);
  // Bot check (only when Turnstile keys are configured)
  const [tsToken, setTsToken] = useState('');
  const [tsKey, setTsKey] = useState(0);
  const onTsToken = useCallback((t: string) => setTsToken(t), []);
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The chat assistant (or a link) can open this page pre-set to repairs/design (?type=repair)
  useEffect(() => {
    if (urlType) {
      setFormType(urlType);
      setSubmitted(false);
      setErrorMessage(null);
    }
  }, [urlType, nonce]);

  // A validation error can sit above the fold on a phone (the submit button is at the bottom);
  // bring it into view so a tap on DISPATCH never looks like it did nothing.
  const errorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (errorMessage) errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [errorMessage]);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    details: '',
  });

  // Telemetry states
  const [telemetryConsent, setTelemetryConsent] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scannedData, setScannedData] = useState<SystemTelemetryData | null>(null);

  // 1. LocalStorage Persistence: Load saved draft on initial mount
  useEffect(() => {
    try {
      const savedDraft = localStorage.getItem('sys_contact_draft');
      if (savedDraft) {
        const parsed = JSON.parse(savedDraft);
        setFormData({ name: '', email: '', phone: '', details: '', ...parsed });
      }
    } catch (e) {
      console.error('Failed to read draft', e);
    }
    try {
      const handoff = sessionStorage.getItem('sys_chat_handoff');
      if (handoff) setChatContext(handoff);
    } catch {
      /* storage blocked */
    }
  }, []);

  // 2. Auto-save draft changes to localStorage as user types
  const saveDraftSoon = (updated: typeof formData) => {
    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => {
      try { localStorage.setItem('sys_contact_draft', JSON.stringify(updated)); } catch { /* storage blocked */ }
    }, 400);
  };
  // Functional update: always builds on the CURRENT text (an async scan could otherwise overwrite typing).
  const handleChange = (field: string, value: string | ((prev: string) => string)) => {
    setFormData((prev) => {
      const next = typeof value === 'function' ? value(prev[field as keyof typeof prev]) : value;
      const updated = { ...prev, [field]: next };
      saveDraftSoon(updated);
      return updated;
    });
    setErrorMessage((m) => (m ? null : m));
  };

  // 3. Handler to run the diagnostic scan
  const handleRunDiagnostic = async () => {
    if (!telemetryConsent) return;
    setIsScanning(true);
    try {
      const data = await collectSystemTelemetry();
      setScannedData(data);
      
      // Automatically format and inject telemetry into the details field
      const telemetryString = `\n\n--- AUTO-COLLECTED SYSTEM TELEMETRY ---\n` +
        `Platform: ${data.platform}\n` +
        `CPU Cores: ${data.cores} | RAM: ${data.approxMemoryGB}\n` +
        `GPU: ${data.gpu}\n` +
        `Screen: ${data.screenResolution} | Connection: ${data.connectionType}\n` +
        `---------------------------------------`;
        
      handleChange('details', (current) => current + telemetryString);
    } catch (err) {
      console.error("Telemetry collection failed", err);
    } finally {
      setIsScanning(false);
    }
  };

  // 4. Submit Handler linked to real API endpoint (/api/contact)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Strict validation
    if (!formData.name.trim() || !formData.details.trim()) {
      setErrorMessage('Please fill in your name and the details of your request.');
      return;
    }

    if (!formData.email.trim() && !formData.phone.trim()) {
      setErrorMessage('Please give us an email address OR a phone / WhatsApp number so we can reply.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (formData.email.trim() && !emailRegex.test(formData.email.trim())) {
      setErrorMessage('That email address does not look valid. Please check it, or leave it blank and use a phone number.');
      return;
    }

    if (!consent) {
      setErrorMessage('Please tick the box to agree to us using your details to reply (see Privacy).');
      return;
    }

    if (formData.phone.trim() && !/^[\d\s\-\+\(\)]+$/.test(formData.phone.trim())) {
      setErrorMessage('ERROR: Phone contact contains invalid characters. Use digits and standard symbols (+, -, spaces).');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          formType,
          website: honeypot,
          chatContext,
          turnstile: tsToken,
          slot: formType === 'repair' && slotDate && slotTime ? { date: slotDate, time: slotTime } : undefined,
          serviceType: formType === 'design' ? 'UI/UX & Design Inquiry' : 'Hardware Repair Booking',
          details: formData.details,
          telemetry: scannedData,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'TRANSMISSION_FAILED: Server rejected the payload.');
      }

      setTicket(result.ticket || null);
      setBookedSlot(result.slot || null);
      trackEvent('contact_submit');
      if (result.slot) trackEvent('booking_created');
      setSubmitted(true);
      try { localStorage.removeItem('sys_contact_draft'); sessionStorage.removeItem('sys_chat_handoff'); } catch { /* ignore */ }
    } catch (err: any) {
      setErrorMessage(err.message || 'TRANSMISSION_FAILED: An unexpected error occurred.');
    } finally {
      setTsToken('');
      setTsKey((k) => k + 1);
      if (slotDate) setSlotRefresh((n) => n + 1); // re-fetch availability (a slot may have just been taken)
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (formType !== 'repair' || win) return;
    fetch('/api/slots').then((r) => (r.ok ? r.json() : null)).then((w) => w && setWin(w)).catch(() => {});
  }, [formType, win]);

  useEffect(() => {
    if (!slotDate) { setSlots([]); setSlotMsg(null); return; }
    const ac = new AbortController();
    fetch(`/api/slots?date=${slotDate}`, { signal: ac.signal })
      .then((r) => r.json())
      .then((d) => { setSlots(d.slots || []); setSlotMsg(d.closed || null); })
      .catch(() => {});
    return () => ac.abort();
  }, [slotDate, slotRefresh]);

  const handleReset = () => {
    setSubmitted(false);
    setFormData({ name: '', email: '', phone: '', details: '' });
    setScannedData(null);
    setTelemetryConsent(false);
    setTicket(null);
    setBookedSlot(null);
    setSlotDate('');
    setChatContext('');
    try { localStorage.removeItem('sys_contact_draft'); } catch { /* ignore */ }
  };

  return (
    <div className="w-full">
      {/* Main Container with Responsive Padding */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-14">
        <div className="mb-8 sm:mb-10 text-center">
          <span className={`text-[11px] sm:text-xs font-mono ${themeClasses.accent} tracking-wider uppercase`}>
            INITIATE_CONTACT // DISPATCH INQUIRY
          </span>
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight mt-2 text-zinc-100">
            Project Request & Service Booking
          </h1>
          <p className="text-zinc-400 mt-2 max-w-lg mx-auto text-xs sm:text-sm">
            Configure parameters below. Drafts are auto-saved locally to prevent data loss across devices.
          </p>
        </div>

        {/* Responsive Form Type Selector Toggle */}
        <div className="flex justify-center mb-6 sm:mb-8">
          <div className="bg-zinc-900/90 border border-zinc-800 p-1 rounded-lg flex flex-col sm:flex-row gap-2 font-mono text-xs w-full sm:w-auto">
            <button
              type="button"
              onClick={() => { setFormType('design'); setSubmitted(false); setErrorMessage(null); }}
              className={`min-h-11 py-3 sm:py-2.5 px-4 sm:px-6 rounded-md transition-all text-center ${
                formType === 'design'
                  ? `${theme === 'cyan' ? 'bg-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.4)]' : theme === 'amber' ? 'bg-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.4)]' : 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.4)]'} text-black font-semibold`
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              [01] UI/UX & DESIGN
            </button>
            <button
              type="button"
              onClick={() => { setFormType('repair'); setSubmitted(false); setErrorMessage(null); }}
              className={`min-h-11 py-3 sm:py-2.5 px-4 sm:px-6 rounded-md transition-all text-center ${
                formType === 'repair'
                  ? `${theme === 'cyan' ? 'bg-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.4)]' : theme === 'amber' ? 'bg-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.4)]' : 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.4)]'} text-black font-semibold`
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              [02] HARDWARE REPAIR
            </button>
          </div>
        </div>

        {hasWhatsApp() && (
          <div className="mb-6 text-center">
            <a
              href={whatsappLink(formType === 'repair' ? 'Hello, I need a device repair. My device/fault: ' : 'Hello, I would like a design / web project. Details: ')}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-3 rounded bg-emerald-500 hover:bg-emerald-400 text-black font-mono text-xs font-semibold transition-colors"
            >
              💬 Prefer WhatsApp? Chat with us directly
            </a>
          </div>
        )}

        {/* Form Card */}
        <div className={`bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-5 sm:p-10 relative overflow-hidden shadow-2xl backdrop-blur-sm`}>
          <div className={`absolute top-0 right-0 w-48 sm:w-64 h-48 sm:h-64 ${theme === 'cyan' ? 'bg-cyan-500/5' : theme === 'amber' ? 'bg-amber-500/5' : 'bg-emerald-500/5'} rounded-full blur-3xl pointer-events-none`}></div>

          {/* Inline Error Banner */}
          {errorMessage && (
            <div ref={errorRef} className="mb-6 p-4 bg-red-950/50 border border-red-800 text-red-300 rounded-lg text-xs font-mono flex items-start sm:items-center justify-between gap-3">
              <span role="alert">
                {errorMessage}
                {hasWhatsApp() && (
                  <>
                    {' '}
                    <a href={whatsappLink(`Hello, I tried the website form. ${formData.details.slice(0, 300)}`)} target="_blank" rel="noopener noreferrer" className="underline">
                      Message us on WhatsApp instead
                    </a>
                  </>
                )}
              </span>
              <button onClick={() => setErrorMessage(null)} className="text-red-400 hover:text-red-200 font-bold shrink-0">✕</button>
            </div>
          )}

          {submitted ? (
            <div className="py-12 sm:py-16 text-center space-y-4 font-mono">
              <div className="flex justify-center">
                <SuccessCheck size={72} className={themeClasses.accent} />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-zinc-100">TRANSMISSION_SUCCESSFUL</h3>
              <p className="text-xs sm:text-sm text-zinc-400 max-w-md mx-auto">
                Your request was delivered. We'll reply using the email or phone you gave us.
              </p>
              {ticket && (
                <p className="text-xs text-zinc-300">
                  Reference: <span className="font-bold">{ticket}</span> — quote this if you follow up.
                </p>
              )}
              {bookedSlot && (
                <p className="text-xs text-zinc-300">📅 Visit requested: <span className="font-bold">{bookedSlot.date} at {bookedSlot.time}</span>. We&apos;ll confirm it.</p>
              )}
              <div className="flex flex-wrap justify-center gap-2">
                {bookedSlot && (
                  <button
                    type="button"
                    onClick={() => {
                      const ics = buildIcs({ title: 'Repair visit', date: bookedSlot.date, time: bookedSlot.time, description: ticket ? `Reference ${ticket}. We will confirm this visit.` : 'We will confirm this visit.', location: SITE.location, uid: ticket ? `${ticket}@system-portfolio` : undefined });
                      if (ics) downloadIcs('repair-visit.ics', ics);
                    }}
                    className="min-h-11 rounded border border-zinc-700 px-4 text-xs text-zinc-200 transition-colors hover:border-current"
                  >
                    📅 Add to calendar
                  </button>
                )}
                {ticket && (
                  <button
                    type="button"
                    onClick={async () => {
                      try { await navigator.clipboard.writeText(ticket); setCopiedRef(true); setTimeout(() => setCopiedRef(false), 1800); } catch { /* clipboard blocked */ }
                    }}
                    className="min-h-11 rounded border border-zinc-700 px-4 text-xs text-zinc-200 transition-colors hover:border-current"
                  >
                    {copiedRef ? 'Copied ✓' : '⧉ Copy reference'}
                  </button>
                )}
              </div>
              {ticket && (
                <Link href={`/track?id=${encodeURIComponent(ticket)}`} className={`text-xs underline ${themeClasses.accent}`}>
                  Track this request →
                </Link>
              )}
              <button
                onClick={handleReset}
                className={`mt-6 px-6 py-3 bg-zinc-800 border border-zinc-700 ${themeClasses.accent} text-xs rounded hover:border-current transition-all font-mono`}
              >
                SUBMIT_NEW_INQUIRY
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
                <div>
                  <label className={`block text-xs font-mono ${themeClasses.accent} mb-2`}>CLIENT_NAME *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    placeholder="Enter your full name"
                    className={`w-full bg-zinc-950 border border-zinc-800 rounded px-4 py-3 text-sm text-zinc-100 focus:outline-none ${theme === 'cyan' ? 'focus:border-cyan-500' : theme === 'amber' ? 'focus:border-amber-500' : 'focus:border-emerald-500'} transition-colors font-mono`}
                  />
                </div>
                <div>
                  <label className={`block text-xs font-mono ${themeClasses.accent} mb-2`}>EMAIL_ADDRESS (or phone below)</label>
                  <input
                    type="email"
                    autoComplete="email"
                    value={formData.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    placeholder="client@domain.com"
                    className={`w-full bg-zinc-950 border border-zinc-800 rounded px-4 py-3 text-sm text-zinc-100 focus:outline-none ${theme === 'cyan' ? 'focus:border-cyan-500' : theme === 'amber' ? 'focus:border-amber-500' : 'focus:border-emerald-500'} transition-colors font-mono`}
                  />
                </div>
              </div>

              <div>
                <label className={`block text-xs font-mono ${themeClasses.accent} mb-2`}>PHONE_OR_WHATSAPP (or email above)</label>
                <input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={formData.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  placeholder="+256 ..."
                  className={`w-full bg-zinc-950 border border-zinc-800 rounded px-4 py-3 text-sm text-zinc-100 focus:outline-none ${theme === 'cyan' ? 'focus:border-cyan-500' : theme === 'amber' ? 'focus:border-amber-500' : 'focus:border-emerald-500'} transition-colors font-mono`}
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className={`text-xs font-mono ${themeClasses.accent}`}>
                    {formType === 'design' ? 'PROJECT_SCOPE & REQUIREMENTS *' : 'DEVICE MODEL & FAULT DESCRIPTION *'}
                  </label>
                  <span className="text-[11px] font-mono text-zinc-400">
                    {formData.details.length} chars
                  </span>
                </div>
                <textarea
                  required
                  rows={4}
                  value={formData.details}
                  onChange={(e) => handleChange('details', e.target.value)}
                  placeholder={
                    formType === 'design'
                      ? 'Describe your branding, UI/UX prototype, or poster design requirements...'
                      : 'Specify your PC or mobile device model, OS version, and exact issue...'
                  }
                  className={`w-full bg-zinc-950 border border-zinc-800 rounded px-4 py-3 text-sm text-zinc-100 focus:outline-none ${theme === 'cyan' ? 'focus:border-cyan-500' : theme === 'amber' ? 'focus:border-amber-500' : 'focus:border-emerald-500'} transition-colors font-mono resize-none`}
                />
              </div>

              {formType === 'repair' && (
                <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-lg space-y-3 font-mono">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-300 font-semibold">// OPTIONAL: DEVICE INFO</span>
                    <span className="text-[11px] text-cyan-400">BROWSER_ONLY</span>
                  </div>
                  <p className="text-xs text-zinc-400">
                    Optionally attach basic info about the browser and device you are using right now (platform, screen size, approximate GPU/memory where your browser reports it). If you're filling this form on a different device from the broken one, skip this and just describe the fault.
                  </p>
                  
                  <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={telemetryConsent}
                      onChange={(e) => setTelemetryConsent(e.target.checked)}
                      className="rounded bg-zinc-900 border-zinc-700 text-cyan-500 focus:ring-0"
                    />
                    I agree to attach this browser/device info to my request.
                  </label>

                  {telemetryConsent && (
                    <button
                      type="button"
                      onClick={handleRunDiagnostic}
                      disabled={isScanning || scannedData !== null}
                      className="mt-2 px-4 py-2 bg-zinc-900 border border-cyan-500/50 text-cyan-400 text-xs rounded hover:bg-cyan-500/10 transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                      {isScanning ? (
                        <>
                          <div className="w-3 h-3 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
                          COLLECTING...
                        </>
                      ) : scannedData ? (
                        '✓ INFO ATTACHED'
                      ) : (
                        'ATTACH_BROWSER_&_DEVICE_INFO →'
                      )}
                    </button>
                  )}
                </div>
              )}

              {formType === 'repair' && (
                <div className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-900/30 p-4" data-reveal>
                  <p className="text-xs font-mono text-zinc-300">📅 BOOK_A_VISIT <span className="text-zinc-400">(optional — pick a time to bring your device in)</span></p>
                  <input
                    type="date"
                    aria-label="Preferred visit date"
                    value={slotDate}
                    min={win?.min}
                    max={win?.max}
                    onChange={(e) => { setSlotDate(e.target.value); setSlotTime(''); }}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-cyan-500"
                  />
                  {slotMsg && <p className="text-xs text-amber-400" role="status">{slotMsg}</p>}
                  {slots.length > 0 && (
                    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Available times">
                      {slots.map((sl) => (
                        <button
                          key={sl.time}
                          type="button"
                          role="radio"
                          aria-checked={slotTime === sl.time}
                          disabled={!sl.available}
                          onClick={() => setSlotTime(sl.time)}
                          className={`px-3 py-1.5 rounded border text-xs font-mono transition-colors ${slotTime === sl.time ? themeClasses.badge : 'border-zinc-700 text-zinc-300 hover:border-zinc-500'} disabled:opacity-30 disabled:line-through disabled:cursor-not-allowed`}
                        >
                          {sl.time}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {turnstileEnabled && <Turnstile key={tsKey} onToken={onTsToken} />}

              {/* Honeypot: hidden from people, bots fill it in */}
              <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, overflow: 'hidden' }}>
                <label>
                  Website
                  <input type="text" name="website" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
                </label>
              </div>

              {chatContext && (
                <p className="text-[11px] font-mono text-zinc-400">✓ Your chat conversation will be attached so you don't have to repeat yourself.</p>
              )}

              <label className="flex items-start gap-2 text-xs text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-0.5 rounded bg-zinc-900 border-zinc-700 text-cyan-500 focus:ring-0"
                />
                <span>
                  I agree to my details being used to reply to this request. See the{' '}
                  <Link href="/privacy" className={`underline ${themeClasses.accent}`}>Privacy notice</Link>.
                </span>
              </label>

              <button
                type="submit"
                disabled={isSubmitting}
                className={`w-full py-4 ${theme === 'cyan' ? 'bg-cyan-500 hover:bg-cyan-400 shadow-[0_0_25px_rgba(6,182,212,0.5)]' : theme === 'amber' ? 'bg-amber-500 hover:bg-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.5)]' : 'bg-emerald-500 hover:bg-emerald-400 shadow-[0_0_25px_rgba(16,185,129,0.5)]'} text-black font-semibold rounded transition-all duration-300 font-mono text-xs sm:text-sm tracking-wider disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer`}
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                    TRANSMITTING_PARAMETERS...
                  </>
                ) : (
                  `DISPATCH_${formType.toUpperCase()}_INQUIRY →`
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ContactPage() {
  // useSearchParams needs a Suspense boundary so the rest of the page can be prerendered.
  return (
    <Suspense fallback={null}>
      <ContactInner />
    </Suspense>
  );
}