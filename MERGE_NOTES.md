# Merge notes (v7 unified)

This project merges three trees into one:

| Tree | What it contributed |
|---|---|
| **site-merged** (your merged tree, the base) | Server store, tickets + tracking, booking slots, payments, owner admin at `/admin` (Tickets, Studio, Templates, Sites, Portfolio, Insights, Data), Site Studio and live demos, template builder, Turnstile, light/dark mode, services/portfolio pages, SEO files |
| **WIP v6** | Builder upgrades: AI assistant panel, code editor panel, pricing + live exchange rates, readiness check, "pro" view page, Word export, scroll progress |
| **My upgrades (v3.5)** | New chat assistant (reasoning engine, rich cards, voice, files, hand-off, tour), terminal, Games page (17 games, stronger AI), extra admin screens (Overview/Pulse, Analytics, Chat Lab, Site, Health, Security, Board, Shell, Lab) |

## Setup (copy this whole folder over your project; no new npm packages are needed)
1. Copy `src/`, `scripts/`, `engine/`, `documentation/`, `tests/`, `next.config.ts` over your project. Keep your own `package.json`, `.env.local` and `public/`.
2. Environment: see `.env.example`. The important ones: `ADMIN_PASSWORD` (10+ characters), `RESEND_API_KEY` + `CONTACT_TO`, `NEXT_PUBLIC_SITE_URL`.
3. **On Vercel, connect free Upstash Redis** (Vercel > Storage > Upstash Redis > Connect). Without it Vercel wipes the disk on restart, so tickets, builder sites and analytics can disappear. The admin warns you when this is the case. Both naming schemes (`UPSTASH_REDIS_REST_*` and `KV_REST_*`) work.
4. Optional: `ADMIN_TOTP_SECRET` (authenticator-app 2FA; run `node scripts/make-totp-secret.mjs`), `ADMIN_WEBHOOK_URL` / `ADMIN_NTFY_TOPIC` (instant alerts), a Gemini/Anthropic/OpenAI key for the builder's AI panel (the builder works without it).

## How the conflicts were resolved
- **One admin, one login.** Your `server/auth` (cookie `sys_admin`, 2FA, IP allow-list, lockout, sign-out-everywhere, audit log) guards everything. `/admin` is still your Desk (tickets, bookings, portfolio, studio, templates). My extra screens live at `/admin/overview`, `/admin/analytics`, `/admin/chat`, `/admin/site`, `/admin/health`, `/admin/security`, `/admin/board`, `/admin/shell`, `/admin/lab`, share one frame with a command palette (Ctrl/Cmd+K), and are linked from the Desk's tool bar.
- **`/api/track` stays yours** (customer ticket lookup). Visitor analytics flow through your `/api/ev`, which now also feeds the richer counters (referrers, devices, hours, countries, games, chat questions, page speed).
- **Contact route** is yours (tickets, booking, emails). Chat hand-offs are saved as tickets marked `[Chat hand-off]`, so a missing email key can never lose a lead. My separate Inbox screen was dropped because Tickets already does that job.
- **Chat** is my new assistant, with your hooks ported: ticket tracking, builder, privacy page, CMS projects, Studio answers, WhatsApp, analytics, and chat opens requested before the lazy loader finishes are queued, not lost.
- **Storage** is your store with an added Upstash Redis back end (chunked large records, short atomic locks so two servers cannot overwrite each other). Without Redis it falls back to files as before.
- **Games** are at `/games` (nav, footer, chat and terminal know about it). **Announcement bar** is controlled from `/admin/site`.
- Chat and the admin frame never load on `/admin` or `/builder/edit`.

## Bugs found and fixed during the merge
- Builder `assetDataUrls` was not awaited in the admin route (project export could break).
- Single template store (two copies could disagree); template save now keeps price, tag and category.
- Cookie signing key on Vercel without Redis or secret changed on every instance (login loop). It is now derived once from the password with scrypt unless `ADMIN_SESSION_SECRET` is set.
- Layout and sitemap no longer crash the whole site if storage is down (built-in projects are used).
- Chat hand-off owner emails are awaited (serverless could cut them off), and every lead is persisted.
- Lock used two Redis commands (INCR then EXPIRE), so a crash between them could leave a lock forever. It is now one atomic `SET NX EX`.
- A chunked record read while a writer swapped versions was treated as "missing", which could make a read-modify-write overwrite good data. It now retries and, if still incomplete, throws.
- Client IP could be spoofed through `X-Forwarded-For`; platform headers are preferred and the proxy hop count is configurable (`TRUSTED_PROXY_HOPS`).
- Admin: "Clear log" for the sign-in log (leaves one entry saying it was cleared).
- 15-puzzle: about 1 in 40 hard boards returned an unsolved path when the optimal search timed out; now falls back to a weighted search (0 failures in 150 boards).
- Two regular expressions used the dotAll `s` flag, which TypeScript rejects when the project targets older than ES2018 (Vercel build error TS1501). Rewritten with `[\s\S]`, same behaviour (`lib/studio/import.ts`, `utils/chatEngine/sanitize.ts`).
- Analytics null crash on first load; admin overview route restored.

## Verification (honest)
- **Done:** type check of the whole tree (against shims), 84 integration checks (login, 2FA, tickets, booking, payments, builder orders and zip, contact, tracking, store locks and chunking, backup/restore, clear-log), ~50 chat/game/terminal regression suites, and real-Chromium end-to-end runs of the admin (desktop and phone: every screen, login/logout, palette, announcement showing on the public site) and of the public site + builder, all with zero console errors.
- **Not done:** a real `next build` / `next dev` on your project (my sandbox has no npm registry), real Upstash and Resend calls (tested against faithful stand-ins), and a visual review on real phones.
- Known and expected: `route.test.ts` prints 3 FAIL lines because it predates your ticket flow (a stored ticket now answers 200 even when email is not configured; that is the intended behaviour).
- The analytics counters in the extra admin screens live in Redis only (they do not fall back to files); with no Redis they reset on restart and the screens say so.
- The old admin test file (`admin.test.ts`) targeted my retired stand-alone login and is superseded.

## Round 2 (builder scrollbars, home training, admin access)
- Builder: scrollbars are now rounded and themed (editor panels via `.sb-slim`, the generated sites follow each template's colours and
  `color-scheme`); the preview viewer no longer shows a horizontal rail on desktop.
- Home training: taught answers now match typos, plurals and extra words ("what are your openning hours on sunday?"); Train screen gained
  Bulk teach (paste a FAQ), Suggest more ways to ask, Check every phrasing, and 8 more quick starts (`src/lib/admin/trainTools.ts`).
- Admin: /login, /signin, /dashboard, /owner, /administrator and /cms redirect to /admin. The live site only shows the ADMIN link after the
  latest build deploys successfully.

## Round 3
- Emoji → real SVG icons across site, admin, studio and builder chrome (`components/ui/Icon.tsx`, `components/builder/icons.tsx`).
- Builder: template gallery with Buy / Download on every preview (server-confirmed payment gates download), mobile dock, polished editor chrome.
- Home: live system status (internet + server via `/api/health`), visitor-location node (opt-in GPS, otherwise timezone), feature showcase with previews, "About the dev" (edit `src/data/devProfile.ts`), back-to-top button, scroll-bar scrub easter egg.
- Games: 7 new 2D games (snake, tetris, breakout, pong, flappy, whack, typing), guides + first-time hint, GameBuddy (live banter + chat), search, and owner games (Admin → Games, `/api/games`, sandboxed embeds).
- AI: `utils/chatEngine/gameKnowledge.ts` — guides baked in, game-aware help ("I'm losing"), owner games listed.
- Not verified here: real `next build`, browser rendering, live Upstash/Resend.

## Round 4 — WIP-v8 merge
v8 was compared file by file against this tree. It is an older line of the same project: everything in it was already here in newer form
(modular chat engine, Upstash-capable store, hydration-safe page motion, recover screen, unified admin). Nothing was overwritten.
Taken from v8 / fixed while merging:
- **One record per ticket** (`tickets/<ID>`, per-ticket lock + Redis lock, auto-migration of an old `tickets` list to `tickets-legacy`) now works on every store backend (Upstash, files, memory). Also used by bulk status, delete and import in Admin.
- `removeTree` now also drops the empty folder/index entry (deleting a site leaves nothing behind).
- `.gitignore` (adds `tests/.build*`), a hard-coded `/home/claude/proj` path in `tests/server.pro.test.cjs` made relative, storage tests made backend-agnostic.
- Deliberately NOT taken: v8's GSAP/SplitText page motion (this tree's Web-Animations version avoids hydration mismatches), its single-file chat widget and older portfolio page, its separate ScrollProgress bar (the nav already has one, now draggable).
- `node tests/run-all.mjs`: all green.

## WIP-v8 check
v8 (v7 cloud inbox + builder Pro, tests, stress harness) was diffed file-by-file against this tree. Everything in it was already present
(engine, cloud server, /api/site, Pro builder, tests); this tree only differs by later fixes (key-guess limits, body caps, icons, scrollbars).
Only v8-only files: `.gitignore.additions` (already in .gitignore) and the old top ScrollProgress bar (replaced by the nav's progress + scrub handle). Nothing needed merging.

## Round 3 follow-up
- Fixed: `ratioCss` was imported by the owner-games page and Admin → Games but not defined in `lib/games/ext.ts` (build breaker). Added.
- Browser smoke test (Chromium, 430px, touch): 7 new games, guide modal, owner-games section, home sections all render and take input with no JS errors.
- Editor mobile: icon-only Design/View toggle on phones, safe-area padding on the bottom tool bar, "double-tap" hint.

## Round 4 — world events, easter eggs
- `lib/events/calendar.ts`: offline world calendar (30 days: Uganda, Africa, faith incl. moon-based Eid/Ramadan/Diwali/Lunar New Year 2026-2030 (approx), world, seasonal, tech). Easter is computed.
- `lib/events/config.ts` + `/api/events` (public) + `/api/admin/events`: owner settings (master switch, effects, per-day off, custom "surprise" events, solemn mood = never any effects).
- Public: `EventRibbon` (dismissible, per event per day), `FxLayer` (confetti/snow/hearts/lanterns/stars/leaves/rain/matrix/barrel; none for reduced motion), preview any day with `/?event=<id>`.
- Assistant: `utils/chatEngine/worldTalk.ts` (holiday questions, well-wishes, upcoming days, event line on the first hello) + easter eggs; new `fx` site command.
- Easter eggs: cheat code (keys, or 8 swipes + 2 taps), typed words (party, matrix, snow, hearts, stars, barrel, sudo), console hello.
- Admin: new **Events** page (key `g` then `v`), and Overview shows when the site is marking a day.
- Checked in Chromium (ribbon, effects, eggs, admin add/hide/preview). Moon-based dates can differ by a day.

## Round 5 — status bar + cyber motion kit
- Home status strip rebuilt as `components/site/StatusTicker.tsx`: status badge pinned on the left (was cut in half on phones), the rest is a smooth ticker under 768px (pauses on touch), static above; plain swipeable row for reduced motion.
- Motion kit in `globals.css` (all behind prefers-reduced-motion): button light-sweep, HUD corner brackets (`data-tilt` / `.cy-card`), `.cy-glitch`, stepped hero-grid drift, tap ping, route-change line, `.cy-breath`.
- `components/site/CyberMotion.tsx` (route sweep, tap ping, `[SECTION // X]` labels decode on scroll), `SessionLine` (real time-on-site counter in footer), glitch 404, sweeping loading bar.
- Checked with real Tailwind CSS in Chromium at phone and desktop width; all earlier smoke tests still pass.

## Round 6 — stress test
- Harness: every public page (home, services, portfolio, contact, games, track, builder, privacy, 404) with the real nav, footer and chat, rendered with real Tailwind CSS at 320/390/768/1280px, plus behaviour tests (hostile chat input incl. XSS and 6000-char messages, all 24 games opened/closed with key mashing, game search, mobile menu + Escape, offline and server-down badge, contact/track bad input, terminal odd commands, Ctrl+K, themes, 240px width, reduced motion). 
- Fixed: 57px sideways overflow at tablet width (768px) caused by the top nav (links tighter, ASK_AI and long contact label shown from 1024px, short CONTACT label at tablet).
- Fixed: small touch targets now have an invisible larger hit area (`.hit`): footer links, theme dots, GPS button, DETAILS/PLAY_NOW/back links, logo.
- Scroll areas: inner panes (chat, terminal, modals, lists, code) now get a slim themed scrollbar (appears on hover on desktop, hairline on phones). The page itself keeps its hidden bar + nav progress line.

## Round 7 — cloud model tier + voice/text reasoning
- **Cloud AI (no download):** `src/server/llm.ts`, `src/app/api/llm/route.ts` (GET status, POST stream; per-IP rate limit, message validation, same-origin). Client in `remoteLLM.ts` (`checkCloud`, `generateCloud`, 14 s first-token timeout → rules fallback, 60 s cool-down). `AiPanel` shows "AI ON · CLOUD", visitors can TURN OFF. Order: on-device model > cloud > browser-direct `NEXT_PUBLIC_LLM_*` > rules. Env: `LLM_ENDPOINT`, `LLM_MODEL`, `LLM_API_KEY`, `LLM_LABEL`, `LLM_MAX_TOKENS`, `LLM_RATE_PER_MIN` (see `.env.example`).
- **Hosting kit:** `inference/Dockerfile` + `README.md` (llama.cpp + Qwen2.5 1.5B/0.5B GGUF; HF Space free CPU / Oracle free VM / Ollama). NOT tested here (no network); privacy page should mention chat text goes to the owner's inference server when cloud AI is on.
- **Voice/text:** `voiceText.ts` (fillers, "port folio" style mishears, spoken numbers, "no I meant…" corrections, negated commands "don't open…" now run nothing, mic commands "send it" / "cancel" / "stop listening" in Composer); `followUp.ts` ("and for a laptop?" swaps device/service in the previous question, "tell me more about X"); "open the builder", "best game", multi-command bare second half, new `mobile-apps` knowledge entry (honest: web/PWA, native apps owner-confirmed).
- Evaluation corpus of 98 typed/voice-style utterances: 85 → 93 pass (rest are expectation mismatches or intentionally unanswerable).
- **Build fix (Vercel, @types/react 19):** the global `JSX` namespace no longer exists; `JSX.Element` in `builder/{Editor,ProContent,icons}.tsx` replaced with an imported `ReactElement`. (Local typecheck had a React shim that hid it.)

## Round 8 — admin Cloud AI card + eggs
- Admin → Chat Lab → Insights: **Cloud AI** card (`components/admin/CloudAiCard.tsx`, `/api/admin/llm`): configured/online badge, host, model, ping, limits, and a test prompt that reports first-word time, total time and words/s. The key is never sent to the browser.
- **Admin easter eggs** (`components/admin/AdminEggs.tsx`, cosmetic only): type coffee / matrix / party / uptime / root / hello / 42 anywhere outside a text box; the cheat code (↑↑↓↓←→←→ B A) = "root mode" glow; `gg` scrolls to the top.
- **Assistant eggs** (11 more in `worldTalk.ts`): programmer joke, the cake is a lie, favourite colour, are-you-ChatGPT, error 418 coffee, Star Trek/DBZ/Star Wars lines, xyzzy/iddqd, undo. Whole-message matches only; normal questions are never hijacked.

## Round 9 — merge check: checkpoint-wip.zip
- The zip is an OLDER, smaller snapshot (146 files vs 361); its chat, admin, builder, server and pages are already in this tree in newer form, so nothing from them was taken (taking them would have been a downgrade).
- Taken (the only pieces not already here): **builder guided tour** (`components/builder/GuidedTour.tsx`, wired into our Editor with `data-tour` marks, a "?" button and a one-time first-visit offer; hook placed above the early returns), **icon set + emoji→icon map** (`lib/icons.ts`, new `components/ui/EmojiText.tsx`, used by chat bubbles: mapped emojis such as 👋 ✅ 📬 become line icons, unmapped ones stay as written, code spans untouched), **SVG favicon** (`app/icon.svg`).
- Not taken: v9 `components/ui/Icon.tsx` (ours has a different, typed API used across the site).

## Round 10 — voice and attachments rebuilt
**Voice** (`components/chat/{useVoice,useSpeech,useVoiceChat,VoicePanel,VoiceContext}`, `lib/voice/{prefs,speechText}`; the old `useVoiceInput` is gone)
- Continuous listening that survives pauses and restarts itself, live interim text, "hearing you" pulse, stops after two silent sessions, specific messages for blocked/missing mic, offline and unsupported language. Auto-send after ~1.6 s of silence (switchable).
- Spoken controls: "send it", "cancel / start over", "stop listening", "stop talking", "say that again". A continuous session never re-sends words already sent.
- Read-aloud (browser speech synthesis, free): per-reply speaker button, optional "read every reply", speed and voice choice, text cleaned for speech (markdown, icons, links, tickets, currency), sentence chunking (Chrome cuts long utterances), barge-in (talking stops the reading).
- Hands-free conversation: listen → send → read the answer → listen again. Language picker (13 languages for the mic; replies stay English). Settings remembered per device.
**Attachments** (`lib/imageTools.ts`, `utils/chatEngine/dataQA.ts`, `AttachmentTray`, `useAttachments`, `Composer`)
- Phone photos up to 25 MB are re-encoded (≤1600 px WebP/JPEG) instead of being refused at 2 MB; the chat says what it did ("Optimised 8.5 MB → 395 KB"). GIFs are not touched.
- Paste a screenshot/file into the box; camera button on touch devices; more text formats (TSV, YAML, INI, SQL, XML).
- Image look: main colours, dark/bright/low-contrast/blurry/transparent notes. CSV/TSV/log answers computed in the browser: rows, columns, average/total/median/highest/lowest of a column (with the matching row), most common, unique, duplicates, missing, error counts, most repeated error, time range. Overview line after sharing a CSV.
- Tray: tap a chip to preview (text or picture), one-tap questions built from the file ("Average price", "Any errors?").
**Tested:** unit suites (speechText, prefs, voice commands, dataQA, imageTools, engine file answers) + a Playwright run with a faked microphone/speaker/clipboard/8.9 MB photo (all green). NOT tested on real devices: Chrome's real recogniser, iOS Safari voice (continuous mode is flaky there), real HEIC photos (unsupported by most browsers).

## Round 11 — free hosted model, daily limits, passes, build-a-website
- `server/aiAccess.ts`: signed device cookie, per-device + per-IP daily limit (EAT day), passes (N answers or unlimited, N days), payment requests approved manually, refunds on upstream failure. `/api/llm` enforces it (429 `limit`), `/api/ai-pass` redeems/requests. Rules engine takes over when exhausted (`remoteLLM.cloudExhausted`).
- Chat: remaining count, "limit reached" row, `AccessPanel` (code / buy pass). Admin: `/admin/ai-access` (g+i).
- `lib/builder/draft.ts` + `utils/chatEngine/siteBuild.ts`: "build me a website" conversation → deterministic draft from our templates (placeholder reviews/stats hidden) saved via `/api/builder` → button to the private editor link. Optional AI wording is validated (`mergeCopy`).
- `inference/Dockerfile` MODEL=7b / MODEL_URL. Not tested against a real server; model file URL unverified.

## Round 12 — builder "I see nothing" + "Storage is full" fix
Root causes (reproduced in a real browser against the real gallery, viewer and editor code):
1. `.animate-page-in` (globals.css) used `animation-fill-mode: forwards` with a final `transform: translateY(0)`. The browser keeps that transform on the wrapper that surrounds EVERY page, and a transformed ancestor becomes the containing block of `position: fixed` children, so each full-screen overlay (template preview, purchase sheet, editor dialogs, games guide) sized itself to the whole PAGE (thousands of px tall), slid under the sticky nav, and its Close / Buy buttons were unreachable. Fix: `backwards` fill + final `transform: none`, and overlays now render through `components/ui/Portal.tsx` (directly under <body>) so no page wrapper can ever do this again.
2. Template previews run in a sandboxed frame (no storage, on purpose). The shop-style engine treated "storage blocked" as "storage full" and showed "Storage is full or blocked — export a backup soon." in every shop template preview, and some thumbnails stayed blank. `engine/app.js` now stays silent in preview mode (and warns at most once on the real site). Engine regenerated into `lib/builder/engine.generated.ts` and `lib/studio/engineData.ts`.
3. `/builder/view` was not in ChromeGate's hidden list, so the full site nav + footer were stacked around the full-height viewer. Added.
Verified in Chromium at 1905x932 and 390x844: all 20 templates open, overlay == screen size, Close and Buy reachable, content present, no storage toast, Esc closes, no page errors.

## Round 13 — builder: "I see nothing", for real this time (data loss, empty gallery, CDN dependence)
Round 12 fixed what the Nov-16 screenshot showed (page-tall overlay + storage toast). A deeper look found why the builder/editor can still look EMPTY on the live site:
1. **Server forgets sites.** On Vercel without Upstash Redis, `server/store.ts` falls back to `/tmp`, which is wiped whenever an instance restarts. The browser still had the link, the server answered 404, the editor dead-ended. (Reproduced with a disk wipe in `cold2.py`.)
   - `server/projects.ts`: `restoreProject()` + `restoreAsset()`; `api/builder`: actions `restore`, `restoreAsset`. A site can only be restored under a FREE id with the key the customer holds (existing id + other key → 409, so nobody can take over a site); empty/garbage copies are rejected; racing restores are safe (`createExclusive`).
   - `lib/builder/localCopy.ts`: every editor load/save writes a private copy (settings → localStorage, pictures → IndexedDB; all try/catch). On a 404 with a matching local copy the editor restores it silently and shows a green "restored from this device" banner.
   - `components/builder/ImportBackup.tsx`: open a backup `.json` (the editor's Backup button) as a new site; on the gallery, the recover screen and the editor's error screen. Backup files now carry template id/name.
2. **Gallery went empty if `/api/builder/templates` failed** → falls back to the built-in `PRESETS` (also when the list is empty). Verified with 500 / aborted / empty responses.
3. **Classic templates depended on a third-party CDN for layout.** New route `app/vendor/bootstrap/[file]` serves Bootstrap from our own domain (fetched once from jsDelivr/cdnjs/unpkg, verified genuine, cached). If you run `node scripts/vendor-bootstrap.mjs`, the static files in `public/vendor/bootstrap` take over automatically. `generate.ts` source order: live views = own domain → jsDelivr → cdnjs; exported zips = bundled copy or jsDelivr → cdnjs (small ES5 loader `__bsCss/__bsJs`). If every source fails, `SAFETY_CSS` (active only until `<html>` gets `bs-ok`) keeps the site readable: real menu bar, centred content, pictures that fit.
**Tests:** `tests/server.restore.test.cjs` (12 checks, in run-all) → whole suite green. Browser (Chromium, desktop 1905x932 + phone 390x844): `walk.py` 124/124 (gallery → preview of all 20 templates), `edit_audit.py` 40/40 (editor opens for all 20, both sizes), cold-restore after wipe on both sizes, gallery fallback (3 failure modes × 2 sizes), backup import, Bootstrap fallback order (6 scenarios).
**NOT verified:** real `next build` (no network in my sandbox); the live `/vendor/bootstrap` fetch from a real CDN; template pictures (Unsplash is unreachable from my sandbox, so photos show as blank boxes in my screenshots); real Bootstrap 5.3.3 rendering (I could only check the fallback chain and the no-Bootstrap safety net). Typecheck of the new/changed files showed no errors other than missing-React-types noise from my sandbox.
**Do this on Vercel:** connect Upstash Redis (SETUP_GUIDE) — then sites are never forgotten in the first place; the restore above is the safety net, not a substitute.

## Round 14 — AI Providers hub in the admin (free AI services, on/off from the panel)
Hugging Face now gates Docker Spaces, so hosting our own model is dropped as the default (inference/ kept). Instead the owner manages free OpenAI-compatible services from the admin:
- `server/llmProviders.ts`: catalogue (Groq, Gemini, OpenRouter, Mistral, Cerebras + up to 6 custom https endpoints), per-service on/off, API key (AES-256-GCM at rest, key derived from ADMIN_SESSION_SECRET/ADMIN_PASSWORD; never returned to the browser, only last 4 chars), model, daily cap, priority order, master switch, and the old env server (`LLM_ENDPOINT`) as provider "env". `streamWithFallback()` tries them in order; a failure before the first word puts the service to rest (429 → 90 s, 4xx → 5 min, else 20 s) and the next answers; if all fail the route refunds the visitor's quota and the chat uses its rules engine. Hosted APIs are never pinged for health (that burns free quota); the self-hosted env server keeps its cached health check. `repeat_penalty` is only sent to llama.cpp-style servers (hosted APIs reject unknown fields). Custom endpoints must be public https (SSRF guard: no localhost/private ranges/credentials in URL).
- `api/admin/llm-providers` (GET status, POST save/order/master/env/addCustom/removeCustom/test), page `admin/(pro)/ai-providers`, nav entry "AI Providers" (g p), CloudAiCard points to it. `api/llm` now uses `anyAvailable()` + `streamWithFallback()`. `streamCompletion(messages, signal, target?)` is backward compatible.
- Tests: `tests/server.providers.test.cjs` (20 checks) in run-all → green. Page rendered in Chromium with a mocked API at 1440 and 390 px (no console errors, no sideways scroll; test/order/toggle POSTs verified).
- NOT verified: calls to the real services (no network here). Default model names and base URLs are best-known values; the admin Test button shows the provider's own error if one is wrong. Free-tier limits are NOT hard-coded; the page tells the owner to check them and set a cap.

## Round 15 — security & stress pass

Found and fixed (each has a regression test in `tests/server.attack.test.cjs` / `server.stress.test.cjs`):
- **Lost updates on save** — the revision check ran outside the lock, so racing saves all "won". Re-checked inside `update()` (also re-checks the order lock).
- **Server 500 from hostile JSON** (`{"action":{"toString":1}}`) — `readJsonLimited` now drops `toString/valueOf/toJSON/__proto__` keys.
- Upload quota race, CSRF hole (Sec-Fetch-Site), unbounded rate-limiter memory, email reflection/auto-reply spam (`mailBudget`, stricter `EMAIL_RE`), pending access-request flood cap (150), forged X-Forwarded-For in admin analytics, microphone Permissions-Policy (voice was blocked), game iframes sandbox escape (`gameSandbox`), big-AI-body rationing.

Checked, nothing found: 240-page XSS fuzz of the builder, admin mutating routes (need x-admin + origin), pass-code strength, device-limit race on pass redemption (exactly 2 of 30 accepted).

Not verified: real `next build`, live Upstash/Resend/Groq, Bootstrap/remote images in sandbox.
Recommendations: connect Upstash Redis (otherwise Vercel `/tmp` data is wiped); script-src CSP not added (would risk breaking inline builder previews).

## Round 16 — more layouts
New builder layout options (all optional; existing sites unchanged because defaults match the old look):
- Features: cards / rows with icon / numbered steps / minimal. Stats: plain / cards. Gallery: grid / masonry / scrolling strip. Team: round / cards. FAQ: collapsing / all answers visible in two columns.
- Cards lift slightly on hover (only on devices with hover, and never with reduced-motion on). No new always-running animations.
- Test: `tests/builder.layouts.test.cjs` (every variant renders, survives sanitizing, bogus value falls back); browser-checked at 375px and 1200px for sideways overflow.
Not done: a full-site visual redesign — I kept the existing look so nothing you already like breaks.

## Round 17 — dev identity
- Owner name "Ray Thund3r", WhatsApp/phone +256 752 225 256 and raytbolt@gmail.com are now the built-in defaults in `siteConfig.ts` (the NEXT_PUBLIC_* env vars still override them). Used by the footer, contact page, chat assistant persona and the About-the-developer block.
- About-the-developer block: lightning-bolt icon (replaces initials), WhatsApp / call / email buttons.
- Favicon is now a cyan bolt on the dark rounded square.

## Round 18 — Launch Pad + small-AI fixes
- WhatsApp/phone corrected to +256 752 225 156.
- **Admin → Launch Pad** (`/admin/launch`, key `g x`): readiness score ring, status level, expandable step-by-step per mission (storage, login strength, 2FA, free cloud AI, email, mobile money, public URL, spam shield), links, and a copy-all block of the missing env variable names. Never shows values. Logic in `lib/admin/launch.ts`, API `api/admin/launch`, test `server.launch.test.cjs`.
- **Assistant (no-LLM mode) bugs found by probing 28 visitor questions and fixed:**
  - "what is react" answered with the location (typo-match "react"≈"reach" outscored the exact match) → retriever now weights fuzzy matches at 0.6.
  - "do you fix laptops" answered with factory-reset advice → added fix/repair phrases to phone/PC entries.
  - New KB entries: Track my request (/track), Who is Ray Thund3r. Payment entry now states mobile money (MTN/Airtel) + reference on Track page (supported by the Track page itself); other methods still "owner confirms".
  - Regression test `server.chatkb.test.cjs` (13 questions). The test build now includes `src/utils` so the engine runs in Node.
- Honest limit: this is the rules/retrieval engine only. It cannot reason like an LLM; real LLM quality comes from Admin → AI Providers (free Groq/Gemini key).

## Round 19 — assistant question battery (≈300 questions fired, simplest → silliest)
Ran greetings, slang, Luganda/Swahili, maths, definitions, repairs, pricing/business, advice, trivia, edge cases, abuse, safety and nonsense through `processChatQuery` with no model and no internet. Fixed everything that was wrong or empty:
- Definitions ("what is X") now answered from the glossary first (+35 terms: AI, ML, LLM, Python, database, server, Git, Figma, mobile money, bitcoin…); titles fixed (AI, Wi-Fi, UI vs UX).
- New `facts.ts`: capitals (~90 countries), Swahili/Luganda greetings, evergreen facts (speed of light, Nile source, Uganda currency/languages/independence…), contact-details handler (no longer confused with "recover WhatsApp"). Runs before game guide, which used to answer "speed of light" with Lights Out.
- New `moreFacts.ts` KB entries: swollen battery (safety), forgot PIN, WhatsApp recovery, install Windows, choosing a phone, WordPress, learn coding/design, freelance tips, delivery outside Kampala, hiring, discounts, data privacy, why choose / testimonials / experience (all honest: nothing invented).
- Smalltalk: which model, age, where do you live, sing/poem, rude remarks, feelings, hungry, "that was helpful". Bare "tell me more" with no history asks for a question.
- Slang: "hw much 4 screen", "my phn wont on". Light/dark mode commands ("dark mode", "turn off the lights"): new `mode` site command wired into the chat widget.
- Requests that need a real LLM (write code/essay/explain at length) now say so plainly instead of "I don't have a good answer".
- Retriever: typo matches count 0.6× (fixed "what is react" → location).
- Tests: `server.chatkb.test.cjs` (54 questions); test build now includes `src/utils`.
Limits: in this sandbox web lookup is offline, so open-ended trivia falls to the fallback; in production the web lookup and, above all, the cloud AI (Admin → AI Providers) handle those.

## Round 20 — internet answers, offline knowledge base, file reading, voice

**Internet answers (no more unrelated pulls)**
- `utils/chatEngine/webAnswer.ts`: questions are parsed (type + subject), candidates ranked, and a result is accepted only if the page title actually matches the subject; sentences are picked for relevance. Low-confidence results are dropped, volatile facts (office-holders, prices, populations) get a "may be out of date" note, only confidence ≥ 0.55 is cached.
- `webSearch.ts` tail rewritten around it. Tested against a mocked noisy Wikipedia (`tests/server.webanswer.test.cjs`, 24 checks). The real Wikipedia API could not be reached from the build sandbox.

**Offline knowledge base** (`utils/chatEngine/world/`, resolver `tryWorld`, runs right after `tryFacts`)
- ~100 countries (capital, currency, calling code, languages, continent), 118 elements, planets, 130+ tech acronyms, 21 programming languages, 32 companies, 43 events, 67 notable people, time zones, plus ~320 keyed facts (Uganda, first aid and health basics with no doses, business/branding/web, phones/PCs/security how-tos, nature, space, maths, inventions, arts, sport).
- Matching is strict (key must cover most of the question) so it falls through rather than answering the wrong thing. `tests/server.world.test.cjs` (56 checks, including "must not hijack" cases).

**File reading**
- `lib/docText.ts`: in-browser text extraction for PDF (Flate streams), DOCX, XLSX (as sheets/rows), PPTX (slides) using built-in DecompressionStream; bounded against zip bombs; honest note for scanned PDFs.
- `fileQA.ts`: no-model "summarize it" and "what does it say about X" that only quote the file. New kind `'doc'`, new extensions (docx/xlsx/pptx, srt/vtt/toml/py/js/ts/css) in the shared `attachmentRules` (server re-check uses the same rules). `tests/server.files.test.cjs` builds real fixtures on the fly.
- Images: size/colour/lighting only. Reading text inside pictures (OCR) is not included.

**Voice**
- Dictation: "plus two five six ..." → +256…, "ray at gmail dot com" → ray@gmail.com, "question mark/comma/full stop".
- Controls: "go ahead"/"send", bare "stop"/"pause", "speak slower/faster" (changes read-aloud rate).
- Read-aloud: phone numbers digit by digit, emails, UGX in words, %, °C, MB/GB, e.g./i.e. `tests/server.voice.test.cjs`.
- Not verifiable here: real microphone/recogniser behaviour on devices.

Caveat unchanged: no real `next build` here; type-checked changed modules, ran the full suite.

## Round 21 — file management: the assistant reads files and helps
- `utils/chatEngine/fileAdvice.ts`: from the text of a shared file it diagnoses ~20 error/crash patterns (disk full, permissions, DNS/timeouts, 4xx/5xx, BSOD codes, SMART/bad sectors, overheating, battery wear…) with a fixed plain-language meaning and next step; pulls totals, due dates, references and amounts from invoices/quotes/receipts; recognises a design/website brief and offers the owner hand-off; gives photos honest advice (size/colour only, repair hand-off). Used for the first reply, for "any errors?/how do I fix this?/what is the total?/when is it due?", and to adapt the one-tap question chips.
- "What files do I have?" lists them; Excel workbooks now answer table questions (row counts, averages…) like CSVs.
- UI: files already sent now show as removable chips ("In this chat") so a visitor can drop a file the assistant is using (`removeShared` in `useAttachments`, `shared`/`onRemoveShared` on `AttachmentTray`).
- Tests: `server.files.test.cjs` now 26 checks. Advice text is generic; only quoted/extracted values come from the file. No OCR for pictures.

## Round 22 — gap sweep
- Pasted error text (log line, stack trace, blue-screen code) is now explained in chat without needing a file (`diagnose` in `fileAdvice.ts`, hooked before the fact lookups; needs an error-like cue so ordinary sentences are untouched). +2 regression cases.
- Fuzzed the chat engine with 21 hostile inputs (empty, 50k chars, emoji floods, template/prototype strings, NULs): no throws, none slower than 1.5 s.

## Round 23 — closing the four open items
1. **Real services (can't be verified from the build sandbox):** Launch Pad → "Run live checks" (`lib/admin/liveChecks.ts`, `POST /api/admin/launch`, 8 s throttle). From the live server it tests storage round-trip (and whether it is persistent), the internet-answer pipeline against real Wikipedia, the Resend key (read-only call), and the public site address. Reports a plain fix per failure; never returns secrets.
2. **Voice on phones:** `lib/voice/recognition.ts` removes the repeated/cumulative results some Android browsers report in continuous mode ("hello hello world"). Used by `useVoice`. Needs a real-device test.
3. **Text in photos:** `lib/ocr.ts` + "Read the text in this picture" button. Uses the browser's built-in TextDetector where it exists (Chrome Android), otherwise Tesseract.js 5.1.1 loaded from jsDelivr only after the visitor taps (a few MB, one time). Result is stored on the file so summaries, error diagnosis and invoice answers work on it. Untested in a browser here; handwriting and poor photos read badly.
4. **AI key:** AI Providers → "Quick connect": paste a Groq/Gemini/OpenRouter/Cerebras key, the service is recognised from its prefix (`detectProvider`), saved encrypted, switched on and tested. Still needs the owner to create the free key.
- Also: fixed a TypeScript narrowing flag in `webAnswer.ts` (no behaviour change). Tests: launch 16 checks, voice 35.

## Round 24 — depth pass on files and the knowledge base
- **Real-PDF reader (important fix):** the first PDF extractor only worked on hand-made files. PDFs from Word, Chrome, LibreOffice, Google Docs use subset fonts with glyph codes, compressed object streams and per-page resources, and returned NO text. `lib/pdfText.ts` now parses objects (incl. object streams), page tree order, `/ToUnicode` CMaps, hex and literal strings, text positioning (lines, wide gaps → spaces) and rejoins wrapped lines. Verified against real Chromium, LibreOffice and qpdf-compressed PDFs (word count within 1% of `pdftotext`), plus real docx/xlsx/pptx made by python-docx/openpyxl/python-pptx. Password-protected PDFs are reported as such. Fixtures in `tests/fixtures/`. Not handled: scanned PDFs (no text layer), PDF forms/annotations, right-to-left shaping.
- **Knowledge base +~300 answers and a dictionary:** places and distances (Kampala–Entebbe/Jinja/Nairobi…), design/web/software, health curiosities (no doses), history/civics basics (neutral), study/work skills, authors/inventors, internet/hardware, a ~90-word dictionary with synonyms, greetings in 12 languages, "square of N", "what time zone is X". Fixed wrong answers found by a 130-question sweep (e.g. "tallest building in Africa" returned Burj Khalifa; "is coffee bad for you" returned phone liquid-damage advice; "where is Kampala" returned the owner's address) by requiring a key to cover ≥75% of the question. World test: 94 checks.
- Still unanswerable offline by design: who currently holds an office, live prices/weather/news. Those need the web path (Wikipedia/provider), which can't be tested from the build sandbox; Launch Pad → Run live checks tests it from the live server.

## Round 25: merge review of `c7b5e356-site-merged.zip`
The incoming build is an older lineage (177 files; none of Rounds 15–24, and it lacks our live-currency pricing, `/api/rates`, pro admin pages, chat engine, voice, files).
Merged (new to us, self-contained):
- **Admin → CUSTOMERS** tab (people grouped from requests, repeat customers, WhatsApp/call links, CSV with formula-injection guard).
- **Admin → SETTINGS** tab: business details (override WhatsApp/email/hours/location everywhere, incl. the chat), social links (shown in footer), Google/sharing title+description (via `generateMetadata`), chat on/off switch, **maintenance mode** (`MaintenanceGate`; `/admin` keeps working). Their announcement bar was left out: ours (`/admin/site`) already has one.
- `lib/siteSettings.ts` (validator drops `javascript:`/`data:` links), `lib/safeText.ts`, `SiteSettingsContext`, `applySiteOverrides`, store `getSiteSettings/saveSiteSettings`, API `settings.get/save` (audited), test `server.settings.test.cjs` (9 checks).
Not merged, on purpose:
- Smart content-based pricing + PRICING tab: our `lib/builder/pricing.ts` is the live-currency price used by checkout; theirs would replace how customers are charged (and its rates are placeholders). Worth a deliberate decision, not a silent swap.
- Drag-and-drop `useSortable`, icon/emoji pass, other differing files: ours are newer (82 differing files were checked as older versions of what we already have).
Verified: full suite ALL GREEN. Not verified: real `next build`; the new tabs/maintenance page not seen in a browser.

### Round 25b: optional features (OFF by default, switch in Admin → SETTINGS → OPTIONAL FEATURES)
- **Smart pricing** (`lib/builder/smartPricing.ts`, own file; live-currency `pricing.ts` untouched). ON: price follows the site's contents, template price is the minimum, free templates stay free, live price + breakdown in the buy dialog, server recomputes at checkout (`priceNow(templateId, config)`). The rate card editor (PricingPanel) appears under SETTINGS once the switch is saved ON. Default rates are placeholders: review before enabling. Pro (Site Engine) sites are never repriced.
- **Drag and drop**: `useSortable` handle on repeating items (mouse/touch/keys) and drop-a-picture on picture fields; arrow buttons unchanged.
- Tests: 14 checks in `server.settings.test.cjs`. Not browser-tested (no `next build`).

## Round 26: Vercel type errors + chat hand-off
- Build fix: the merged panels used icon names (`message-circle`, `grip`, any string) the small `components/ui/Icon` doesn't type. New `components/ui/IconAny.tsx` draws any icon from `lib/icons.ts`; CustomersPanel, SettingsPanel, MaintenanceGate, FieldForm use it.
- Hand-off (`utils/chatEngine/handoffText.ts`): the raw chat is no longer sent by default. Required info only: the assistant's worked-out brief, else the visitor's own substantive messages (greetings/"ok thanks"/repeats dropped, max 3). History is added only when ticked: "include chat history" beside Continue on WhatsApp; "Also include the chat history" in Send-to-owner (pre-ticked only when there is nothing else to send); contact page shows a summary with a checkbox. WhatsApp text now reads as a message (greeting, what I need, ask to reply on WhatsApp). 9 tests.

## Round 27 — Admin overhaul
- New sidebar shell + top bar (replaces the old top tab strip); mobile gets a section chip row.
- New kit pieces in components/admin/ui.tsx (StatusPill, KindBadge, Avatar, Banner, Chips, ListRow, compactUGX, redesigned Stat/Field/AreaChart).
- Panels split out of app/admin/page.tsx: Overview, TicketsPanel, TicketEditor, CustomersPanel, PortfolioPanel, TemplatesPanel, SitesPanel, InsightsPanel, SettingsPanel, DataPanel; logic unchanged, visuals restyled.
- Verified in a real browser (esbuild + Playwright, mocked API). Not verified: real `next build`, live data, light mode.
- Round 27b: login redesigned; Studio list restyled; light-mode fixes (status text shades in globals.css, chart strokes use theme vars).

## Round 28 — AI providers fix + admin motion
- server/llmModels.ts: model discovery (parse /models, drop speech/embedding models, flag retiring ones), best-model picker, plain-language error explanations.
- Defaults updated: Groq openai/gpt-oss-20b (llama-3.1-8b-instant shuts down 16 Aug 2026), Gemini gemini-2.5-flash-lite (2.5-flash retired 1 Dec 2026), Cerebras gpt-oss-120b. A saved model equal to an OLD default is upgraded automatically.
- Test button: checks key + model through the free models list first (no chat quota), refuses repeat clicks within 15 s, explains 429/404/401 clearly, offers suggested models. Quick connect auto-picks a working model.
- AI Providers page: "Load models" + model dropdown, recommended-model link, retiring warnings, clickable suggestions.
- Admin motion (globals.css adm-*): staggered rise, count-up numbers, chart line draw, bar grow, skeleton shimmer, hover lift; all off under prefers-reduced-motion.

## Round 29 — /track overhaul
- Restyled tracking page: plain-language 'what happens now' per stage, stepper, numbered mobile-money steps with copy buttons, payments list, update timeline, silent refresh every 3 min (max 8), remembers recent references (and phone only if ticked) on the device, auto-opens from ?id= when a phone is remembered.
- Admin 'Reply on WhatsApp' text now includes the /track?id= link (emails already did).

## Round 30 — Trust content (Admin → Content)
- New lib/siteContent.ts + server store key `site-content`; admin actions content.get / content.save (revalidates the site); tests/server.content.test.cjs.
- Admin → Content tab (ContentPanel): Reviews, Prices (starter list), FAQ, Guides (draft/publish, mini-markdown), Promise & headline numbers, Local & map (areas, directions, Google Maps + review links).
- Public: StatsStrip + ReviewsSection on home; PriceList, PromiseCard and owner FAQ (+ FAQPage JSON-LD) on /services; MapCard + PromiseCard on /contact; /guides and /guides/[slug] (server-rendered, 404 for drafts), added to sitemap and footer.
- Layout JSON-LD LocalBusiness now follows Settings (address, phone, hours, social sameAs) plus hasMap/areaServed.
- Everything is hidden until the owner adds content; nothing is invented.

## Round 31 — more GSAP (all via lib/useGsapEffects.ts, lazy, reduced-motion safe)
- New hooks: useStaggerIn (children of [data-stagger] rise in on scroll), useCountUp ([data-count] numbers), useParallax ([data-parallax] drift, mouse devices only).
- Used on: Trust sections (stats count-up, reviews/prices/promise stagger), home hero grid parallax, services "How it works" steps, /track stepper (line fill + dot pop + current-step pulse).
- Portfolio grid left on framer-motion (already animates filtering; mixing both would fight over transforms).
- Verified wiring with a GSAP stub in a real browser (no errors, nothing left hidden); real GSAP timing/feel not verified here.

## Round 32 — scroll-driven background
- New `components/fx/ScrollScene.tsx`, mounted in `app/layout.tsx` inside `ChromeGate` (so not on /admin, builder edit/view). Two soft accent orbs drift on slow loops tied to scroll position; faint dashed "data stream" lines at the page edges flow with scroll (down when scrolling down, back up when scrolling up); everything brightens while scrolling fast and settles when still.
- Transform/opacity only, a single rAF loop that sleeps when the page is still, no GSAP dependency, renders nothing under prefers-reduced-motion. Calmer in light mode (globals.css).
- Verified in the harness only (movement, boost decay, no errors). Real-device feel and `next build` not verified.

## Round 33 — change login from the panel
- Admin → Security → "Change your login": change password and turn 2FA on/rotate/off, saved in storage (password as scrypt hash). Every change needs the current password (+ current 2FA code); other devices are signed out, this one stays in; owner is notified.
- Saved values beat the Vercel variables, EXCEPT: if ADMIN_PASSWORD / ADMIN_TOTP_SECRET is later edited in Vercel, the saved value is ignored (fingerprint of the env value is stored) → lock-out recovery is always "edit the variable + redeploy". Needs permanent storage (Upstash), otherwise the panel says so.
- server/auth.ts: checkPassword/verifyTotp/totpRequired/adminConfigured are now async. New tests/server.creds.test.cjs. Unverified: `next build`, live UI.

## Round 34 — authenticator system + AI admin fixes
- Security → Two-factor: real QR code (new dependency-free `lib/qr.ts`, decode-verified for versions 1–10), manual setup key, Microsoft Authenticator instructions, test code, confirm password, then 8 one-time recovery codes (hashed; usable in the login code box; regenerate/turn off need password). Replay guard is now per secret. Login code box accepts recovery codes.
- Admin → Chat → "Cloud AI" card now reflects the whole provider chain (Groq/Gemini/… + own server) and its Test uses the real fallback chain (was only LLM_ENDPOINT, so it said NOT SET UP while providers worked).
- Chat assistant now receives the owner's prices/FAQ/promise/areas (Admin → Content) via `contentFacts()` → `setOwnerFacts()` → prompt "OWNER FACTS". LLM path only; the offline rules engine is unchanged.
- Unverified: `next build`, live UI of the Security page.

## Round 35 — stress audit fixes
- PageMotion no longer imports GSAP statically (lazy via loadGsap, mouse users only); magnet no longer jitters over child elements.
- BackgroundFX: removed the duplicate scroll-progress bar (SiteNav has the real one) and its per-scroll layout read.
- No background-tab polling: useNetStatus (/api/health) and useAiStatus (/api/llm) only poll while the tab is visible.
- Chat "run in terminal" now actually works: the home-page terminal listens to the terminal bus (queued commands run on arrival). Removed the unused components/terminal/Terminal.tsx.
- Admin Board: edits made <500 ms before leaving the page are flushed instead of lost.
- .env.example documents the previously undocumented optional variables.
- tests/engine.cloud.test.mjs runs on a pinned 10:00 clock: the three booking scenarios failed after ~22:00 only because no slots remain "today" (confirmed by re-running at a faked 07:00).
- NOT changed (needs a real build to verify): layout reads (getProjects/getSiteSettings/getSiteContent) use uncached Upstash fetches, which likely makes every public page dynamic. Check the Vercel build output: "○" = static, "ƒ" = dynamic.

## Round 36 — live updates + spam filter
- Live updates: `server/liveVersion.ts` (version stamp, `publishChange()`), `/api/version`, `components/site/LiveUpdates.tsx` mounted in the root layout. Every owner save (admin() wrapper for all mutating admin routes, plus publishChange in the main admin + studio routes) bumps the stamp. Open pages check on load, tab visible, Safari `pageshow` (bfcache), focus, online and every 20 s while visible → `router.refresh()` + a `site:updated` event (announcement bar, events and games refetch). `useApi` also reloads on visible/pageshow. Cause on iPhone: Safari restores pages from bfcache and pauses timers, so nothing asked for new data.
- Spam filter: `lib/spamFilter.ts` (scored, each point has a reason), `server/spam.ts` (settings + log), applied in `/api/contact` (contact form, repair booking, chat hand-off): clear spam refused (422, friendly message; bots get a silent OK), doubtful messages saved as "[Possible spam]" without emailing the owner. Admin → Security → "Spam & nonsense filter": on/off, Relaxed/Normal/Strict, blocked words, extra on-topic words, list of what was caught. Contact form sends `elapsedMs`. Shop-site (cloud) orders/bookings are NOT filtered (the offline-first engine retries errors).
- Tests: tests/server.live.test.cjs, tests/spam.test.cjs. Unverified: `next build`, real iPhone behaviour.

## Round 37 — chat redesign, voice mode, file reading, builder polish
- Chat: slim header (no scanline); the "⋯" menu now holds voice conversation, WhatsApp hand-off, reply style, help, export, size, clear, and the AI status. Composer: "+" menu (photo/file), mic swaps to send when you type, no hint clutter. Emojis replaced by icons in chat.
- New `VoiceMode.tsx` (orb states, live captions, tap to interrupt, settings sheet) driven by `startSession/endSession/tapOrb` in `useVoiceChat.ts`. `VoicePanel.tsx` removed. Not tested on a real device/microphone.
- File reading: cloud/remote AI now receive file text (redacted, ~10k chars); images use OCR text only (no vision). Attachment tray now says file text is read to answer.
- Builder editor: icon top bar, grouped zoom/device controls, wider panels, save status inline. Template/content emojis (generated site cards) intentionally unchanged.

## Round 38 — from the older merged snapshot
- Admin → Calendar tab (month view of booked visits), `components/admin/CalendarPanel.tsx`; chevron icons added to `ui/Icon.tsx`.
- `tests/noemoji.test.cjs` (source scan; registered in run-all) — remaining emoji/glyphs in admin, chat, builder chrome and studio replaced with icons or words.
- Old tests kept in `tests/legacy/` (not run); `documentation/ADMIN.md` rewritten for the current admin.

## Round 39 — strictly no emoji
- Interface, chat texts, builder templates/drafts, studio engine and the generated-site engine contain no emoji (tests/noemoji.test.cjs scans all of src/ and engine/; allowed: lib/icons.ts table, speechText.ts patterns, studio engineData glyph keys that are swapped for SVG at run time).
- Card icons and favicons are now icon names (`star`, `rocket`…); old projects that stored an emoji still render (mapped to the nearest icon, else dropped). Builder icon picker shows icons.
- Chess pieces / checkers crown / star ratings drawn as SVG. Chat replies had emoji removed at source; `EmojiText` now drops any leftover emoji instead of showing it.
- `engine/app.js` got an `IC()` icon helper; engine.generated.ts rebuilt.

## Round 40 — Art gallery
- Public `/art` (masonry grid, category chips, full-screen viewer with swipe/arrow keys), in nav/footer via `lib/siteMap.ts`, sitemap and chat navigation.
- Admin → Build → **Art** tab (`components/admin/ArtPanel.tsx`): pick a picture, it is shrunk on the device (`lib/artImage.ts`, ~380 KB + thumbnail), saved through `/api/admin/art`. Pictures live under their own keys (`art-img-<id>`, `art-thumb-<id>`), list in `art-list`; served by `/api/art/<id>` with a year-long cache (URL carries `?v=`).
- `admin()` gained an optional body-limit argument. Test: `tests/art.test.cjs`. The Backup & data download does NOT include artwork pictures yet.

## Round 41 — Art gallery v2
- /art rebuilt: spotlight hero, category chips with counts, search, sort, masonry/grid toggle, zoomable viewer (filmstrip, slideshow, fullscreen, share links `?piece=`), commission band.
- Each piece stores a vivid `color` and average `tone` (computed in the browser on upload) used for glows.
- Contact page accepts `?ref=<title>` to start the message.
- Not run in a real browser; `next build` unverified. Artwork is not part of the Backup download.

- Art admin: Download backup / Restore from backup (full pictures, restores only missing pieces) and Refresh glow colours for older pieces.

## Round 42
- Optional Telegram + CallMeBot WhatsApp alerts (lib/admin/auth.ts notify), optional Plausible/Umami script (layout), Health checklist rows, visitor text stripped of emoji (server/util.ts clean), ADMIN.md optional setups.

## Round 43
- Art page checked in a real Chromium render (desktop and phone): hero headline size, viewer buttons on phones.
