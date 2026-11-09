# Security notes

## What protects what
**Admin login.** Password (10+ characters) compared in constant time, optional 2-step code (TOTP, each code usable once),
optional IP allow-list, 6 tries per 15 minutes per IP and a global lockout, cookie that is HttpOnly + SameSite=Strict (+ Secure in production),
"log out everywhere", and an audit log. The cookie is signed with its own random key (kept in the data folder, or `ADMIN_SESSION_SECRET`),
**not** derived from your password.

**Visitor IP.** Used for rate limits and the allow-list. Forgeable headers are not trusted: platform headers (Cloudflare, Vercel, Fly) first,
otherwise the `X-Forwarded-For` entry added by your own proxy (`TRUSTED_PROXY_HOPS`, default 1), never the left-most value a visitor can set.

**Requests.** Same-origin checks on every POST; request bodies are size-limited while being read (signed-out visitors can only send a tiny login body);
every field is validated and re-built from a schema (unknown keys dropped, links must be `/path` or `https://`, `//other.site` refused).

**Public endpoints.** Contact (honeypot, optional Cloudflare Turnstile, rate limit, file type + signature checks), tracking and payment
(rate limit per IP **and** per reference number, so a request's contact detail cannot be guessed from many addresses), analytics
(only real page addresses are stored, bounded).

**Storage.** Atomic writes with a last-good `.bak` copy; a damaged file is kept aside (`.corrupt-*`) and the last good copy is used instead of silently starting empty.

**Site Studio.** Generated sites never contain the owner passcode (only a SHA-256 hash; passcodes are 12 random characters by default, minimum 8);
studio text is HTML-escaped where the engine writes it as HTML; contact links are validated; the live demo and downloads carry a
Content-Security-Policy (own inline script only, Google Fonts, https pictures, no frames/plugins/form posts, no network calls except the site's own Firebase);
the editor preview runs in a sandboxed iframe; imports are parsed, never executed; backups are re-validated on restore.

**Headers.** HSTS, `nosniff`, no framing (except `/demo/*` by this site itself), COOP, restricted `base-uri`/`object-src`/`form-action`, `no-store` on `/api/*`.

## Tested
Forged and tampered cookies, a cookie forged with the admin password as key, spoofed IP headers, oversized and streamed bodies, link tricks,
damaged data files, analytics flooding, guessing a request's contact detail, 39 studio fields and all template-builder fields with script
payloads (page and translations, in a real browser), wrong/blank/legacy admin passcodes, CSP blocking outside scripts and frames. See `NOTES.md`.

## Still true (limits you should know)
- Rate limits and lockouts live in server memory: with several server instances they are per instance, and they reset on restart.
- The generated sites' in-site admin is client-side software. Anyone can read the page's code, and the passcode hash can be attacked offline; the default 12-character
  passcode makes that impractical, a short passcode does not. Treat it as a convenience for small shops. Orders still arrive on WhatsApp.
- The main site's CSP covers framing, plugins, form targets and `<base>` only. A full script policy needs nonces and was left out to avoid breaking Next.js.
- Data is stored on the server's disk. Download backups (Admin → DATA, and each Studio site's Backup).
- Keep `ADMIN_PASSWORD` long and unique, turn on `ADMIN_TOTP_SECRET`, and consider `ADMIN_ALLOWED_IPS` if you have a fixed address.
