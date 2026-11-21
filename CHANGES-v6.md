# v6 — Pro Site Engine, editor overhaul, tests & stress tooling

## 1. What you asked for, and what was built
You gave three finished client sites (OLAM Creations, A.G.E Concepts, Elegant Hair & Glam) as the quality bar.
Reading their code showed they are **one engine with three configurations** — but an engine with real problems: 16 layers of
monkey-patched functions, behaviour switched by hard-coded site names (`C.key==='olam'?'quote':'book'`), a plaintext default
admin passcode `admin123` visible in page source, and `crypto.subtle` hashing that silently fails on plain-http hosting.

So instead of copying it, a **clean-room Site Engine** (`/engine`) was written with the same kind of capabilities, fully
config-driven, with a pure-logic core that is property-tested. The builder can now produce two kinds of site:

| | Classic (unchanged) | **Pro (new)** |
|---|---|---|
| Output | Bootstrap section page | Self-contained app site (no libraries) |
| Does | Presents a business | Sells (cart, promo codes, delivery, MoMo/Airtel/bank/cash, WhatsApp order, tracking, receipts), books (day strip + slots + deposits), takes quotes |
| Owner admin | – | `#admin`: dashboard, products CRUD + photo upload, orders, bookings, enquiries, CSV export, settings, publish, backup |
| Templates | 14 | **6 new**: Electronics & Repair Shop, Fashion Boutique, Bakery, Salon, Clinic, Events |

### Honest comparison with your three reference sites
✅ equal or better · ◐ partly · ❌ not in the engine yet

| Feature | Status | Note |
|---|---|---|
| Glass nav, hero slider (fade/slide/zoom, swipe, pause, progress), masonry gallery + swipe lightbox, FAQ, reviews | ✅ | |
| Catalog: search, category chips, sort, favourites, product sheet with gallery + related | ✅ | |
| Cart, promo codes, delivery fee, checkout → WhatsApp + MoMo/Airtel/bank/cash instructions, order ref, tracking, printable receipt | ✅ | |
| Booking with slots + deposits, quote form | ✅ | |
| EN / Kiswahili, light / dark, WhatsApp button, back-to-top, SEO + JSON-LD + no-JS fallback | ✅ | SEO tags are now in the static HTML (references only had them at runtime) |
| Admin passcode | ✅ better | hashed (never plaintext), strong one generated per customer, lockout, **works on http** (pure-JS SHA-256) |
| Old/low-end Android support | ✅ better | conservative JS/CSS, no `?.`/`??`; storage-blocked mode works from memory |
| Admin: products, orders, bookings, enquiries, settings, backup, publish | ✅ | |
| Admin: edit slides / services / FAQ / reviews / colours / section order | ◐ | done in the **builder** (richer there), not inside the live site |
| Orders visible on every device | ◐ | static hosting has no shared database: orders live on the ordering device and reach the owner via **WhatsApp + optional email endpoint (Formspree etc.)** |
| Firebase-style cloud sync, staff accounts, review moderation | ❌ | the main gap vs the references; would need a backend |

**"Better than the references" is true for robustness, security, SEO, editing workflow and testing; it is NOT yet true for the
shared-database features in the last row.** Visual polish was designed from the references but has never been viewed in a real browser (see §5).

## 2. Editor overhaul (`components/builder`)
* **Pro editing**: new *Content* panel (`ProContent.tsx`) renders every group from one schema; preview jumps to the section being edited. Passcode field stores only a hash.
* **O(1) dirty tracking** (version counters) replaces re-serialising the whole site on every render / keystroke / unload check.
* **Undo history is memory-capped** (string snapshots, 12 MB budget, 120 steps) — previously ~80 full copies of a large site.
* **Double-buffered preview**: new version loads in a hidden iframe and is swapped in when ready → no white flash on each edit.
* Standalone "Full preview" fixed to use function replacements (the engine source contains `$$`, which `String.replace` would corrupt).

## 3. Server (`server/`)
* **Tickets are one file each** (`tickets/<ID>.json`) instead of one shared `tickets.json`. The load test showed the old design made
  `order` p95 = 5.6 s under 100 simultaneous visitors; it is now 0.5 s. Per-ticket locks; legacy `tickets.json` is **migrated automatically**
  and kept as `tickets.json.migrated`. Single-ticket reads are never cached in memory (safe with Next.js module duplication).
* Zip exporter handles Pro sites: engine files + `site-data.json` + README + **stable generated owner passcode** (`ADMIN-PASSCODE.txt`)
  unless the customer set their own (theirs always wins).
* AI: Pro-aware prompt + `setPro` operation; the AI can never touch the owner passcode. Offline assistant understands simple Pro commands.

## 4. Bugs found and fixed by the new tests
1. `//evil.com/x` (protocol-relative URL) passed the engine URL filter → blocked.
2. Lone-surrogate characters hashed differently from the standard → fixed (matters only if hashing ever moves server-side).
3. Tapping a product's empty image area opened a lightbox with no pictures → threw (hidden by a catch-all toast).
4. Owner was signed out of admin when viewing the site and coming back → session now lasts for the page lifetime.
5. Closed sheets could swallow taps during their fade-out → made non-interactive immediately.
6. A generated owner passcode could override the customer's own → customer's always wins.
7. Pro template SEO titles were silently truncated mid-sentence by the 70-char limit → clean generated titles.
8. Import cycle `schema ⇄ pro` (would crash module init in the bundler) → `readiness.ts`.

## 5. Verification — what is and is not proven
**Run here (all green, `node tests/run-all.mjs`):** engine core 12 property tests (100,000 random cart operations, 5,000 SHA-256 vectors vs Node);
engine end-to-end 19 tests in a DOM implementation (full shop / booking / quote journeys, admin, XSS in every field, corrupted storage,
blocked storage, 3,000 products in 0.25 s, **6,000-action random fuzz with zero errors**); builder pipeline 14 (3,000 fuzzed configs, injection,
all 20 templates); server 70 (400 concurrent creates, 200 concurrent updates of one ticket, migration, zips, AI route, 4,000-config fuzz);
**stress**: 100 simultaneous visitors × 25 s = 18,850 requests, 0 unexpected responses, p95 338 ms, abuse limiter working.

**NOT verified (needs you, ~30 min):** the React editor in a real browser (layout, drag-drop, mobile sheets, double-buffer swap);
the engine's *appearance* and animation in real browsers/phones (tests use a DOM model, not a rendering engine); real AI providers and
exchange-rate API; `npm run build`; the stress numbers are from a local harness serving the real handlers on one machine
(load generator and server share the CPU, no Next.js, no network) — run `scripts/stress.mjs` against your real deployment for real numbers.

## 6. Do this
1. `npm i @mlc-ai/web-llm` (the chat imports it; it is missing from package.json) then `npm run build` and fix anything it reports.
2. `.env.local`: `ADMIN_PASSWORD` (12+), `ADMIN_SESSION_SECRET` (random, set once), `ADMIN_TOTP_SECRET`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_WHATSAPP`, `MOMO_*`, optional AI key.
3. Add to `package.json` scripts: `"engine": "node scripts/build-engine.mjs"`, `"test": "node tests/run-all.mjs"`, `"test:stress": "node tests/run-all.mjs --stress"`; add `.gitignore.additions` to `.gitignore`.
4. Click through: open /builder → a Pro template → edit in every group → AI panel → preview on your phone → buy flow → download → open the zip's `index.html` → `#admin`.
5. After editing anything in `/engine`, run `npm run engine` (recompiles it into the generator), then `npm test`.
