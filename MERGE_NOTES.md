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
