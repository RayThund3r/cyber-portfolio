# Merged project notes

This tree merges three versions of the same site: **src-v4** (server features), **site-upgrade_1**
(new chat widget, attachments, hand-off card) and **site-upgrade-light-dark** (light/dark mode,
portfolio + services upgrades, SEO files). Earlier change logs are kept: `CHANGES.md`, `CHANGES-v2.md`.

## Where each feature came from
- v4: admin (/admin), template builder (/builder), request tracking (/track), privacy page, booking slots,
  tickets + emails, Turnstile, CMS-backed projects, analytics, next/image, security headers, sitemap/robots.
- site-upgrade_1: chat widget in `components/chat/`, file attachments, "send to owner" card, shared
  SiteNav/SiteFooter, accent themes (cyan/amber/emerald), GSAP effects, URL-driven portfolio filters.
- light-dark: light/dark toggle (`ModeToggle`, `data-mode` on <html>), portfolio popup/cards in
  `components/portfolio/`, services page (jump links, process, FAQ), manifest + share image.

## How conflicts were resolved
- `api/contact`: one route handles repair/design tickets (booking, tracking) AND chat hand-offs
  (`formType: "chat"`, emailed with transcript + files, no ticket).
- Chat: the new widget is the UI. v4's extras were ported: tracking/builder/privacy/page-list commands,
  "Open page →" buttons, CMS projects, WhatsApp option, analytics, unanswered-question reporting.
  Chat opens requested before the lazy-loaded widget exists are queued, not lost.
- Animations: one reveal system (`PageMotion`, below-the-fold only). Per-page duplicates removed.
- Pages use CMS projects (`useProjects`) and `ProjectImage`; project metrics only show when real.
- Shared nav/footer are hidden on /admin and /builder/edit.

## Round 2: bug fixes, iOS-style motion, admin upgrades
Bug fixes
- Chat hand-offs no longer return a ticket id that doesn't exist.
- /track now follows `?id=` even while it is open (chat "track SYS-XXXXXX" from the track page).
- Removed nested `<main>` landmarks (track, privacy, builder, admin, editor); short pages no longer force a full-screen gap above the footer.
- Scroll reveals re-measure when images/fonts change page height.
iOS-style motion (all disabled for visitors who prefer reduced motion)
- `components/motion/PressFeedback.tsx`: every button/link/tab shrinks on press and springs back with overshoot; `data-haptic` adds a light vibration on supported phones. Opt out with `data-no-press`.
- Project popup is a bottom sheet on phones: springs up, grabber handle, drag down to dismiss.
- Springier reveals, chat sheet, page transition, light/dark icon pop, animated success checkmark (`components/ui/SuccessCheck.tsx`).
Admin dashboard (`/admin`)
- New OVERVIEW tab (needs-attention list, upcoming visits, KPIs, 14-day charts, pipeline) and DATA tab (backup, restore, CSV export, shortcuts).
- TICKETS: status chips with counts, type filter, sorting, age badges, bulk select (set status / delete), CSV export, "show more", `/` and `r` shortcuts, auto-refresh every 45 s with a NEW badge and a count in the browser tab title.
- API: `tickets.bulk`, `backup`, `restore` (adds missing items only; validates everything) in `api/admin/route.ts`.

## Round 3 extras
- Contact success screen: "Add to calendar" (.ics for the booked visit, Kampala time) and "Copy reference" (`lib/calendar.ts`).
- Admin ticket editor: one-tap quick replies (quote ready, deposit needed, work started, ready for pickup, completed) and a printable job card for the repair bench.

## Round 4
- `site-upgrade-light-dark_1.zip` and `site-upgrade_33bbae.zip` were checked: byte-identical to versions already merged (no new features).
- Verified by rendering every page + key components with real React (home, services, portfolio, contact, track, privacy, builder, 404, error, loading, nav, footer, chat, admin gate): all render.
- Added: offline/back-online pill (`components/ui/OfflineNotice.tsx`), "Add to calendar" on /track, admin backup reminder (Overview).

## Round 5: Site Studio (website designer)
- The three uploaded sites (`elegant_hair___glam`, `OLAM_creations`, `A_G_E_Concepts`) were all produced by ONE engine. It was extracted
  (the three engines are byte-identical once their per-site hooks are made configurable) and turned into a designer inside the admin:
  **STUDIO** tab, with 4 starter looks, 78 settings, live phone/tablet/desktop preview, zip export, import of existing engine sites,
  per-site backup/restore, public live demos at `/demo/<slug>`, and one-click "add to portfolio" (portfolio items now have `liveUrl`).
- Regenerating the three original sites from their own files reproduces text, colours, fonts, radii and layout counts exactly.
- Engine fixes: dashboard visits start at 0 (were invented numbers), returning visitors get updated content on republish.
- Security: demo/preview never expose the real passcode; preview iframe is sandboxed; imports are parsed, never executed;
  `next.config.ts` lets only `/demo/*` be framed (by this site).
- Chat assistant now answers questions about custom business websites. See `documentation/SITE_STUDIO.md`.

## Round 6: audit, fixes, hardening (details in `documentation/SECURITY.md`)
Found by attacking the code (not just reading it) and fixed:
- Admin cookie was signed with a key derived from the admin password (offline guessing risk) -> independent random key.
- Client IP trusted the left-most `X-Forwarded-For` (rate limits / allow-list bypass) -> platform headers or proxy-added entry.
- Studio: 12 text fields (titles, services, reviews, FAQ, stats) reached the generated page as raw HTML (script execution) -> escaped; owner passcode was readable in the page -> hash only
  (+ built-in SHA-256 for plain-http hosting); contact links/handles/email/dburl validated; demos/downloads carry a CSP.
- `//other.site` was accepted as an on-site link (portfolio live link, images) -> refused everywhere.
- Unbounded request bodies (public builder, admin, studio) and unbounded analytics keys -> capped.
- Guessing a request's contact detail from many IPs -> limited per reference number.
- A damaged data file silently became "empty" and could be overwritten -> last good copy + quarantine.
- Added `global-error.tsx`, HSTS/COOP/CSP basics, `no-store` for APIs, `opener` detached for the print window.
- 27 attack tests, XSS scans (studio + template builder), CSP browser tests, all earlier suites re-run clean.

## Round 7: console errors, builder access, from-scratch builder (see `documentation/BUILDER.md`)
- `@mlc-ai/web-llm` warnings: the package was never installed. `next.config.ts` now points the import at a harmless stand-in when it is missing
  (`src/lib/stubs/webllm-missing.ts`); run `npm install @mlc-ai/web-llm` to switch the real in-browser AI on.
- Hydration error on the home page: scroll/hero animations wrote inline styles onto server-rendered elements before React hydrated. They now use the Web Animations API
  (`src/lib/reveal.ts`), which cannot change the HTML. Tested: zero attribute changes, print/PDF shows everything.
- Builder "couldn't find that project": the edit page removed the key from the URL and then read the URL again, which failed whenever React ran effects twice (every dev server run).
  Fixed (`lib/builder/access.ts`, new edit page), plus a recovery screen, blocked-storage handling and a rate limit that only counts wrong keys
  (reloading used to burn the 40-per-10-minutes allowance).
- New: "Start from scratch" template, first-visit guide, guided tour in the editor, built-in template fallback, edit-conflict protection, delete own site,
  CSP for downloaded sites, thumbnails no longer log console errors.
- Verified in a real browser with React's development double-run on: 30/30 journey checks (`harness/` + `tools`-style tests), plus all earlier suites.

## Removed (unused or superseded)
`/api/chat` route and legacy intelligence engine files (dead code; v4 had removed them), v4 `ScrollProgress`
(BackgroundFX has the progress bar), `useNavParams` (URL params are read directly), v4's home hero SplitText intro
(the new entrance animation replaces it), `lib/site.ts` (use `SITE` in `utils/chatEngine/siteConfig.ts`).

## Verify before deploying
Not built or run in the environment this was assembled in. Run `npm install && npm run build`, then check:
home, portfolio (open a project), services, contact (repair slots + submit), /track, /builder, /admin login,
chat (ask "track my request", attach a file, send to owner), light/dark toggle on each page.
