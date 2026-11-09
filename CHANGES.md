# What changed

## Fixed in code
**Contact form / API**
- Phone/WhatsApp was collected but never sent — now included. Form needs email OR phone.
- Resend errors were ignored (form said "success" even when no email was sent) — now checked; user sees a real error + WhatsApp fallback.
- HTML-escaped all user input in the email; length limits; strict server validation; `formType` whitelisted (no crash).
- Honeypot field + in-memory rate limit (5 / 10 min / IP). Add Cloudflare Turnstile / host firewall for real protection.
- `reply_to` = customer, ticket ID in subject and shown to customer, optional BCC backup inbox, lead copy always written to server logs.
- Customer confirmation email (only when CONTACT_FROM is a verified domain). Resend response no longer echoed to the browser.
- Missing API key no longer crashes the route at import.
- Privacy consent checkbox + new /privacy page (TEMPLATE — review it).
- Telemetry wording now honest (it reads the device you're typing on); telemetry whitelisted + clamped server-side.

**Credibility**
- Removed the `[cite: 15]` junk from page title/description.
- Removed invented metrics ("99.8% Success Rate", "0.4s Load Index"…). Metric blocks only render if you add a real one.
- Added honest "pricing depends on device/fault" note (no invented prices).
- Added missing `components/RepairShowcase.tsx` (replacement; delete if you have your original).
- WhatsApp / hours / location in footer, contact page, repair section and chat — driven by env vars.

**SEO / discoverability**
- Per-page metadata, OpenGraph/Twitter tags, canonical URLs, sitemap.xml, robots.txt, LocalBusiness JSON-LD.

**Performance / robustness**
- Tailwind `hover:${…}` dynamic classes never compiled — now literal classes via ThemeContext (hoverAccent, groupHoverAccent, hoverBorder).
- Page transition: removed no-op exit animation, shorter, respects reduced-motion. Full-screen loader replaced with a thin top bar.
- Lazy-loaded images; localStorage/sessionStorage access wrapped in try/catch.
- Added `error.tsx` and `not-found.tsx`.

**Chat**
- "Open contact" only scrolled to a `#contact` element that doesn't exist on most pages → now navigates to /contact and attaches the conversation.
- "Change theme" never worked (looked for a function that doesn't exist) → fixed.
- "Continue on WhatsApp" / "Send to owner" handoff bar after a few messages.
- Deleted dead, unauthenticated `/api/chat` route + unused legacy engine files.
- Crisis reply now includes Uganda emergency numbers (112 / 999); more Luganda/Swahili greetings & thanks.
- Chat log is announced to screen readers; small low-contrast text bumped.

## NOT fixable by code alone — you need to do these
1. Replace Unsplash stock images with photos of your real work; add testimonials with permission.
2. Set the env vars (see .env.example): WhatsApp number, site URL, hours, Resend sender domain.
3. Add real "from UGX …" prices to the services page when you decide them.
4. Create a Google Business Profile (biggest lever for local search).
5. Review /privacy with someone qualified; check Uganda DPPA 2019 registration duties.
6. Booking / repair-status tracking, mobile-money payments, CMS/database, analytics and error monitoring (e.g. Sentry) are new systems, not patches.
7. Rate limiting is per server instance; use your host's firewall/bot protection for real protection.
8. If `next.config` doesn't allow remote images, `<img>` was kept (not `next/image`) to avoid breaking the build.
