# v2 — new features, optimizations, GSAP

## Before you run it (3 commands)
    npm i @mlc-ai/web-llm        # the chat's "Enable AI" imports it, but it was NOT in package.json / lockfile
    npm rm @google/genai         # installed but unused anywhere (optional cleanup)
    cp .env.example .env.local   # then fill it in (at minimum ADMIN_PASSWORD, NEXT_PUBLIC_SITE_URL, NEXT_PUBLIC_WHATSAPP)
Add `.data/` to your .gitignore (that's where tickets / CMS edits / stats are stored).
Copy `src/` and `next.config.ts` over your project. No other new npm packages are required (gsap was already installed).

## New features
- **Booking**: repair form has an optional date + time-slot picker (live availability, capacity per slot, closed days, lead time). Server re-validates so double-booking a full slot is refused.
- **Repair/request tracking**: every request is now a ticket (`SYS-XXXXXX`). Customers use /track with reference + the phone/email they used (brute-force limited).
- **Mobile-money deposits (manual verification)**: you set a quote/deposit in /admin → customer sees MTN/Airtel instructions on /track → submits the transaction ID → you verify in your wallet and click Confirm.
- **Admin (/admin)**: password login (signed httpOnly cookie, rate-limited). Tickets (status, quote, deposit, customer-visible message, private notes, confirm payments, WhatsApp/email update), Portfolio CMS (add/edit/delete/reorder/feature, real image URLs), Insights.
- **Analytics**: cookie-free, no IPs stored, honours Do-Not-Track / GPC. Page views, WhatsApp clicks, bookings, chat opens.
- **Chat insight**: questions the assistant couldn't answer are aggregated (emails/numbers scrubbed) and shown in Insights.
- **Error monitoring**: browser + server errors recorded (deduped) and emailed to you the first time each new error appears (max 10/day).
- **Bot protection**: optional Cloudflare Turnstile (set the two keys).

## Optimizations
- `next/image` (AVIF/WebP, responsive sizes, lazy) for project cards and detail hero; unknown hosts still display (unoptimized) and fall back safely.
- Chat widget + engine now load after the page is idle (smaller first load).
- Draft autosave debounced; security headers; `X-Powered-By` removed; pages stay static (admin edits call revalidatePath).
- Dead hover/transition code removed; page transition respects reduced motion.

## GSAP (all skipped for `prefers-reduced-motion`; content is never hidden without JS)
- Hero intro timeline with SplitText on the headline, scroll-reveal for cards/sections (also for items that appear later), magnetic CTA buttons, scroll-progress bar, chat window open + message pop-in, tracking progress bar.
- Driven by `data-hero`, `data-hero-title`, `data-hero-item`, `data-reveal`, `data-magnetic` attributes — add them to any element.

## Honest limits
- The file store needs a persistent writable disk (VPS, Railway/Render with a volume, your own server). On Vercel/most serverless hosts it will NOT persist — swap `src/server/store.ts` (read/update at the top) for Supabase/Turso/Neon.
- Payments are manual-verify. Automatic confirmation needs a provider account (MTN MoMo Collections, Airtel, Flutterwave, Pesapal) — not possible without your credentials.
- Rate limits are per server instance. Booking has a tiny race window if two people grab the last slot in the same instant.
- Booking defaults (Mon–Sat 09:00–18:00, 1h, 2 per slot) are assumptions — change them in .env.
- Error monitoring is a simple built-in log, not Sentry. Nothing was built/run here (no network) — run `npm run build` first.

## v3 — navigate the site from the chat
Say it, and the chat takes you there (auto-navigates after a short beat so you can read the confirmation):
- Pages: "go to services", "take me to the portfolio", "contact", "privacy policy", "take me home", "where can I find your prices?"
- Actions: "book a repair" (opens the form on Repair with the slot picker), "hire you" (design/web request), "track my repair", "track SYS-AB12CD" (opens /track with the reference filled in)
- Filters: "show me branding projects", "I want to see hardware repair projects" (portfolio opens pre-filtered)
- Projects: "open project 03", "open the workspace translucency project" (matched by number or distinctive title words, including projects you add in /admin)
- Page controls: "back", "scroll to the bottom", "scroll up"
- Discovery: "what pages are there?", "where else can I go?"
- Awareness: on /services, "services" replies "you're already here" and scrolls to top. On phones the chat tucks itself away after navigating (the bubble stays).
- Questions are NOT hijacked: "what are your prices?" gets the normal answer plus an "Open Services →" button.
- Safety: chat can never open /admin or leave the site; the conversation is still attached to the contact form when you land there.
Files: `utils/chatEngine/navigation.ts` (routes + synonyms table — add new pages there), `utils/useNavParams.ts`, widget + engine wiring.

## v4 — Website Template Builder (sell sites) + locked-down admin

### Setup (extra steps for v4)
    node scripts/make-totp-secret.mjs     # prints ADMIN_TOTP_SECRET → add to .env.local + your authenticator app (2FA)
    node scripts/vendor-bootstrap.mjs     # OPTIONAL, needs internet: bundles Bootstrap 5.3 into customers' zips (offline-capable)
Then set in `.env.local`: `ADMIN_PASSWORD` (12+ chars), `ADMIN_TOTP_SECRET`, optionally `ADMIN_ALLOWED_IPS`. See `.env.example`.

### For customers — /builder
1. Pick a template (Business, Creative Portfolio, Restaurant, Product Landing) with live thumbnails.
2. Edit EVERYTHING with no code: every text, picture (upload or link), colours (8 one-click themes + custom), fonts, button/corner style,
   section order / show-hide / duplicate / delete, 12 section types you can add (hero, about, services, stats, gallery, testimonials, pricing,
   team, FAQ, banner, free text, contact), menu labels, SEO title/description, tab icon, language.
   Live preview with desktop/tablet/phone sizes; click anything in the preview to edit it; undo/redo; autosave; works on phones.
3. "Confirm & buy": readiness checklist → order → pay with mobile money on /track → once YOU confirm the payment, "Download website (.zip)" unlocks.
   The zip contains index.html, css/style.css, js/script.js, assets/ (their uploaded pictures), README.txt (+ Bootstrap if vendored).
   The download is generated from the design frozen at confirmation. Unpaid orders can be "unlocked" to keep editing.
4. Projects are private: secret edit link (the key is removed from the address bar after load). Resume on the same device automatically.

### For you — /admin
- **Templates tab**: set price per template (empty = not for sale, 0 = free), show/hide, rename, duplicate, delete, and "Edit design" (opens the builder in template mode).
- **Sites tab**: every customer project with status (draft / awaiting payment / paid), preview, download zip, delete.
- **Tickets**: template orders appear as tickets; confirming the payment auto-completes the order and unlocks the customer's download (+ email/WhatsApp update).
- The chat can answer questions about the builder and open it ("open the template builder").

### "Only I can get in" — admin hardening
Password (required) + optional authenticator-app 2FA (single-use codes) + optional IP allow-list + per-IP rate limit + GLOBAL lockout (12 failures / 15 min)
+ signed httpOnly SameSite=Strict cookie (8h) + "Log out all devices" + audit log of every sign-in/failure (Insights tab) + email alert on every successful sign-in.
Blocked IPs get a plain 404. No password or code is ever stored in the browser. Honest limit: this protects against guessing and stolen cookies;
it cannot protect you if your password AND phone are both compromised — keep ADMIN_PASSWORD long and unique, enable 2FA.

### Safety design of the builder
- Customers never write code. Every config is rebuilt server-side from the schema (unknown fields dropped, URLs scheme-checked, colours/enums whitelisted, sizes bounded) and all output is HTML-escaped — tested against script/attribute-injection attempts.
- Uploaded images: JPG/PNG/WebP/GIF only, magic-byte checked, compressed in the browser, ≤600 KB each, ≤14 MB per project. SVG is refused.
- The live preview runs in a sandboxed iframe with no access to your site, cookies or admin.
- Downloads require a CONFIRMED payment (or a free price of 0) — verified server-side; brute-forcing is rate-limited.

### Honest limits
- Single-page sites (sections on one page), not multi-page. Google Fonts and Unsplash sample photos load from the internet unless customers choose "System fonts" / upload their own.
- Contact form on a static site needs either a form service link (e.g. Formspree) or it opens the visitor's email app — no server-side sending in a static zip.
- Payment is manual-verify (as with deposits). Storage is the same JSON-file store (needs a persistent writable disk, i.e. not Vercel).
- Not run in a real browser here: the generator, sanitizer, zip, ordering and payment-gate were tested in Node (zip validated with `unzip -t`); please click through the editor once after `npm run build`.
