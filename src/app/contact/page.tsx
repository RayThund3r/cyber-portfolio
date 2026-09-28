// src/app/contact/page.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTheme } from '@/context/ThemeContext';
import { collectSystemTelemetry, SystemTelemetryData } from '@/utils/telemetry';

export default function ContactPage() {
  const { theme, themeClasses } = useTheme();

  const [formType, setFormType] = useState<'design' | 'repair'>('design');
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
    const savedDraft = localStorage.getItem('sys_contact_draft');
    if (savedDraft) {
      try {
        const parsed = JSON.parse(savedDraft);
        setFormData(parsed);
      } catch (e) {
        console.error('Failed to parse draft', e);
      }
    }
  }, []);

  // 2. Auto-save draft changes to localStorage as user types
  const handleChange = (field: string, value: string) => {
    const updated = { ...formData, [field]: value };
    setFormData(updated);
    localStorage.setItem('sys_contact_draft', JSON.stringify(updated));
    if (errorMessage) setErrorMessage(null);
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
        
      handleChange('details', formData.details + telemetryString);
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
    if (!formData.name.trim() || !formData.email.trim() || !formData.details.trim()) {
      setErrorMessage('ERROR: All mandatory fields must contain valid data (no whitespace-only entries).');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email.trim())) {
      setErrorMessage('ERROR: Invalid email format detected. Please verify your address.');
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
          formType: formType.toUpperCase(),
          serviceType: formType === 'design' ? 'UI/UX & Design Inquiry' : 'Hardware Repair Booking',
          details: formData.details,
          telemetry: scannedData,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'TRANSMISSION_FAILED: Server rejected the payload.');
      }

      setSubmitted(true);
      localStorage.removeItem('sys_contact_draft');
    } catch (err: any) {
      setErrorMessage(err.message || 'TRANSMISSION_FAILED: An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setSubmitted(false);
    setFormData({ name: '', email: '', phone: '', details: '' });
    setScannedData(null);
    setTelemetryConsent(false);
    localStorage.removeItem('sys_contact_draft');
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-cyan-500 selection:text-black">
      {/* Responsive Top Navigation */}
      <nav className="sticky top-0 z-50 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-800/80">
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 max-w-7xl mx-auto">
          <Link href="/" className={`font-bold tracking-wider text-sm sm:text-lg ${themeClasses.accent} font-mono hover:opacity-80 transition-colors flex items-center gap-1`}>
            <span>←</span> <span className="hidden xs:inline">BACK_TO_HOME</span><span className="xs:hidden">HOME</span>
          </Link>
          <div className="text-[10px] sm:text-xs font-mono text-zinc-400 bg-zinc-900/80 px-2.5 py-1 rounded border border-zinc-800">
            SEC: SECURE_TRANSMISSION
          </div>
        </div>
      </nav>

      {/* Main Container with Responsive Padding */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
        <div className="mb-8 sm:mb-10 text-center">
          <span className={`text-[10px] sm:text-xs font-mono ${themeClasses.accent} tracking-wider uppercase`}>
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
              className={`py-3 sm:py-2.5 px-4 sm:px-6 rounded-md transition-all text-center ${
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
              className={`py-3 sm:py-2.5 px-4 sm:px-6 rounded-md transition-all text-center ${
                formType === 'repair'
                  ? `${theme === 'cyan' ? 'bg-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.4)]' : theme === 'amber' ? 'bg-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.4)]' : 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.4)]'} text-black font-semibold`
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              [02] HARDWARE REPAIR
            </button>
          </div>
        </div>

        {/* Form Card */}
        <div className={`bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-5 sm:p-10 relative overflow-hidden shadow-2xl backdrop-blur-sm`}>
          <div className={`absolute top-0 right-0 w-48 sm:w-64 h-48 sm:h-64 ${theme === 'cyan' ? 'bg-cyan-500/5' : theme === 'amber' ? 'bg-amber-500/5' : 'bg-emerald-500/5'} rounded-full blur-3xl pointer-events-none`}></div>

          {/* Inline Error Banner */}
          {errorMessage && (
            <div className="mb-6 p-4 bg-red-950/50 border border-red-800 text-red-300 rounded-lg text-xs font-mono flex items-start sm:items-center justify-between gap-3">
              <span>{errorMessage}</span>
              <button onClick={() => setErrorMessage(null)} className="text-red-400 hover:text-red-200 font-bold shrink-0">✕</button>
            </div>
          )}

          {submitted ? (
            <div className="py-12 sm:py-16 text-center space-y-4 font-mono">
              <div className={`w-16 h-16 ${theme === 'cyan' ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.3)]' : theme === 'amber' ? 'bg-amber-500/10 border-amber-500 text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.3)]' : 'bg-emerald-500/10 border-emerald-500 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)]'} border rounded-full flex items-center justify-center mx-auto text-2xl animate-bounce`}>
                ✓
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-zinc-100">TRANSMISSION_SUCCESSFUL</h3>
              <p className="text-xs sm:text-sm text-zinc-400 max-w-md mx-auto">
                Your operational parameters have been securely logged and dispatched via email relay. Response incoming.
              </p>
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
                  <label className={`block text-xs font-mono ${themeClasses.accent} mb-2`}>EMAIL_ADDRESS *</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    placeholder="client@domain.com"
                    className={`w-full bg-zinc-950 border border-zinc-800 rounded px-4 py-3 text-sm text-zinc-100 focus:outline-none ${theme === 'cyan' ? 'focus:border-cyan-500' : theme === 'amber' ? 'focus:border-amber-500' : 'focus:border-emerald-500'} transition-colors font-mono`}
                  />
                </div>
              </div>

              <div>
                <label className={`block text-xs font-mono ${themeClasses.accent} mb-2`}>PHONE_OR_WHATSAPP_CONTACT</label>
                <input
                  type="text"
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
                  <span className="text-[10px] font-mono text-zinc-500">
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
                    <span className="text-xs text-zinc-300 font-semibold">// OPTIONAL: SYSTEM DIAGNOSTIC SCANNER</span>
                    <span className="text-[10px] text-cyan-400">SECURE_CLIENT_SIDE</span>
                  </div>
                  <p className="text-xs text-zinc-400">
                    Allow our diagnostic tool to automatically append your device specs, GPU, and platform info to your repair request for faster troubleshooting.
                  </p>
                  
                  <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={telemetryConsent}
                      onChange={(e) => setTelemetryConsent(e.target.checked)}
                      className="rounded bg-zinc-900 border-zinc-700 text-cyan-500 focus:ring-0"
                    />
                    I authorize secure, read-only collection of browser environment & hardware metrics.
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
                          SCANNING_HARDWARE_PARAMETERS...
                        </>
                      ) : scannedData ? (
                        '✓ DIAGNOSTIC PAYLOAD ATTACHED'
                      ) : (
                        'RUN_HARDWARE_DIAGNOSTIC_SCAN →'
                      )}
                    </button>
                  )}
                </div>
              )}

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
      </main>
    </div>
  );
}