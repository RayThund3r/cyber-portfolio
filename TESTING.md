# Testing & stress

    node tests/run-all.mjs            # everything (~35 s): compiles, 9 suites, 178 checks
    node tests/run-all.mjs --stress   # + two 15 s load tests (builder, cloud inbox) against the local harness

| File | What it proves |
|---|---|
| `tests/engine.core.test.mjs` | pure logic: SHA-256, cart/promo/slot invariants (100k random ops), URL safety, CSV injection, merge |
| `tests/engine.app.test.mjs` | the real engine in a DOM model: journeys, admin, XSS, corrupt/blocked storage, 3,000 products, 6,000-action fuzz |
| `tests/engine.cloud.test.mjs` | the real engine talking to the real cloud handlers: cross-device order/tracking, booking races, offline recovery, lossy network, passcode rules |
| `tests/server.cloud.test.cjs` | cloud inbox security + correctness: validation, atomic slots, brute force, isolation, floods, caps, e-mail, read-your-writes |
| `tests/builder.pro.test.mjs` | settings → validator → generator → engine; hash parity; injection; all 20 templates; 3,000-config fuzz |
| `tests/server.*.test.cjs` | storage, per-ticket store + migration, concurrency, zips/passcodes, AI route (mock model), 4,000-config fuzz |
| `scripts/stress.mjs` | load test for any deployment: `node scripts/stress.mjs https://your-site --users 100 --seconds 30`; add `--cloud` for the cloud inbox (needs a registered test shop: `--site <id> --pass <passcode>`) |

Stress against your REAL server (not the harness): the script sends a different `X-Forwarded-For` per visitor so per-IP limits behave as
for separate people (works when the server trusts that header). It also checks that one abusive address IS throttled. Exit code 1 if
errors > 1 %, p95 > 3 s, or the limiter is inactive. Don't point it at a production site with real customers' data you care about —
it creates hundreds of projects/orders.
