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
- Analytics null crash on first load; admin overview route restored.

## Verification (honest)
- **Done:** type check of the whole tree (against shims), 84 integration checks (login, 2FA, tickets, booking, payments, builder orders and zip, contact, tracking, store locks and chunking, backup/restore, clear-log), ~50 chat/game/terminal regression suites, and real-Chromium end-to-end runs of the admin (desktop and phone: every screen, login/logout, palette, announcement showing on the public site) and of the public site + builder, all with zero console errors.
- **Not done:** a real `next build` / `next dev` on your project (my sandbox has no npm registry), real Upstash and Resend calls (tested against faithful stand-ins), and a visual review on real phones.
- Known and expected: `route.test.ts` prints 3 FAIL lines because it predates your ticket flow (a stored ticket now answers 200 even when email is not configured; that is the intended behaviour).
- The analytics counters in the extra admin screens live in Redis only (they do not fall back to files); with no Redis they reset on restart and the screens say so.
- The old admin test file (`admin.test.ts`) targeted my retired stand-alone login and is superseded.
