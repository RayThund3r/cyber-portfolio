# Browser test harness (optional, developer use)
`builder_e2e.py` runs the real builder pages in Chromium (React development mode, StrictMode on) against the real API handlers
(30 checks: start from scratch, tour, reloads, blocked storage, recovery, conflicts, delete). `reveal_test.py` checks the scroll animations.
They need Playwright + esbuild and a small bundling step (see the commands in NOTES.md round 7 / ask your developer). They are NOT needed to run the site.
