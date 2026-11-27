# Legacy tests (from an older snapshot of the project)

These are NOT run by `node tests/run-all.mjs`. They were written against an earlier layout (they import
`@/app/api/...` routes through a TypeScript test harness with stubs, and the two `.py` files expect a
harness server and sample images in `/tmp`). Keep them as a source of scenarios to port:

- `regress.test.ts` — contact/tracking, booking slots, studio, builder, backups
- `hard.test.ts` — auth, cookies, rate limits, body limits
- `r8.test.ts` — builder pricing, admin settings, generated sites
- `dnd_e2e.py` — builder drag-and-drop ordering in a real browser (Playwright)
- `panels_e2e.py` — admin panels in a real browser (Playwright)
