# v7 — Cloud inbox: shared data for Pro sites

Closes the biggest gap from v6: orders, bookings and enquiries used to live only on the device that made them. Now every Pro site can send
them to **your server**, so the owner sees them in the site's `#admin` on **any device**, customers can **track an order from any device**, and two
visitors **can never book the same slot**. Customers need no setup (no Firebase, no accounts). Everything still works offline.

## How it works
Pro site (static, hosted anywhere) ──HTTPS──► `POST /api/site` on your platform. Per-site data lives in `DATA_DIR/cloud/`.
* **Visitors** can only *submit*, see which time slots are taken (times only), and look up *their own* order (reference + phone).
* **Owner** proves identity with a token derived from the passcode: `token = sha256(siteKey:cloud:passcode)`. The server keeps only
  `sha256("v:" + token)` (a hash of a hash). The token exists in browser memory only (verified: never written to storage).
* **The cloud decides the passcode** when configured: a passcode changed on one device works on all devices and the old one stops working everywhere.
  If the server is unreachable, the passcode saved with the site is the offline fallback.
* **Offline-first**: a failed send is queued on the device and retried (idempotent — a retry after a lost response never duplicates).
  A booking made offline whose slot was taken meanwhile is flagged "Conflict" in the admin.
* The customer's **download registers the site automatically** (generated passcode → verifier; or the verifier the builder stored when they chose their own).
  `site-data.json` gets `cloud:{u,id}`; previews never talk to the network. A "Cloud inbox" switch in *Features* turns it off per site.
* Optional **e-mail to the shop owner** for each new order/booking/enquiry (uses your existing Resend setup; escaped; max 20/hour/shop).

## Security & abuse protection (all tested)
Server re-validates everything and recomputes order totals · ids/times assigned server-side · control characters stripped · hostile text is stored as
plain text and escaped on display · atomic slot claims (hard-link create-if-absent) · per-address submit limit (30 / 10 min) · per-shop hourly cap
(`CLOUD_SITE_HOURLY_LIMIT`, default 400) · owner brute-force lockout (10 wrong tokens → 10 min, even the right token is refused while locked) ·
tracking answers are identical for "no such order" and "wrong phone" · 40 KB body cap · path traversal impossible (ids validated, never used as paths) ·
one shop's token cannot read another's data · per-kind storage cap (`CLOUD_MAX_PER_SITE`, default 3,000, oldest removed first) · master switch `CLOUD_INBOX=off`.

## Files
`src/server/cloud.ts` · `src/app/api/site/route.ts` (CORS `*`: no cookies are used, owner calls need the token) · `engine/*` (client) ·
`store.ts` +`createExclusive` · builder: passcode field now stores *two* derived values, `features.cloud`, registration inside `buildProjectZip`.

## Bugs found by the new tests and fixed
1. **Passcode lock-out across devices** — changing the passcode in the admin updated the cloud but another device still checked the *old* saved hash. Now the cloud is authoritative.
2. Engine could contact the network in editor previews when a cloud config was present → ignored in preview.
3. A customer on a *different* device had no way to reach "Track order" (only shown right after ordering) → footer link.
4. Double-tap / keyboard-repeat on "Confirm booking" could send two requests → in-flight guard.
5. Thundering herd: 20 simultaneous owner refreshes took 1,394 ms (each rebuilt the list) → shared rebuild with write-invalidation: 133 ms; race-tested for stale reads (0 in 400 checks).

## Verified here (`node tests/run-all.mjs --stress`: 178 checks + 2 load tests, all green)
* **server: cloud inbox (41)** — forged totals, 60 simultaneous bookings of one slot → exactly one wins, brute force, cross-shop isolation, floods, caps, e-mail escaping, rotation rules.
* **engine ⇄ cloud (14)** — the real engine against the real server handlers: cross-device order → owner → tracking; double-booking race between devices; offline-then-recover;
  40 orders over a network failing 2 of 3 requests with lost responses → exactly 40, no duplicates; 3,000-action fuzz on 3 devices.
* **builder/Pro (16), server Pro (22)** — registration, generated and customer passcodes open the inbox, legacy sites and "cloud off" export without it, idempotent re-download.
* **Load (100 simultaneous visitors, 25 s, one machine)**: 10,340 requests, 0 unexpected; submit order p95 0.5 s; track p95 0.34 s; abuse probes all throttled/locked.
  Owner list: ~70–130 ms typical; **p95 ≈ 1.8 s only under the extreme test of ~40 orders/second into a single shop with 1,000+ records per type.**

## NOT verified — please check
* **Real browsers**: CORS preflight/`fetch` from a customer's domain to your server (tested at handler level only), mixed content (customer site on https needs your `NEXT_PUBLIC_SITE_URL` to be **https**), the admin UI on phones.
* Real Next.js routing of `OPTIONS` (should be fine; confirm once with `curl -i -X OPTIONS https://your-site/api/site`).
* Hard links on your production file system (falls back to O_EXCL automatically if unsupported).

## Things to know / decide
* **Single server.** Like the rest of the JSON-file store, this is for one Node process (not serverless/Vercel). Back up `DATA_DIR/cloud/` with the rest of `DATA_DIR`.
* **You now store your customers' customers' personal data** (names, phones, addresses, orders). Make sure your terms/privacy page covers it and decide a retention policy (not legal advice).
* **What it does not do**: products/prices are still published via `site-data.json` (not live from the cloud); stock is not decremented; no payment processing — payment stays MoMo/Airtel/bank/cash with the owner confirming.
* Pricing idea: this is a natural paid add-on (“hosted order inbox”) — the per-shop caps and the master switch make it controllable.

## Do this
1. Set `NEXT_PUBLIC_SITE_URL` to your public **https** address; optionally `CLOUD_*` variables (see `.env.example`).
2. `node tests/run-all.mjs` (should be all green), then deploy.
3. Download a Pro template site, host it on any https host, order from your phone, open `#admin` on your laptop with the passcode from `ADMIN-PASSCODE.txt`.
