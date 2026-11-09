# Website builder (public: /builder)

Visitors build a website without code. Two ways to begin:
- **Start from scratch** (always the first card): a clean page with a menu, one headline and a footer. They add sections one by one.
- **Choose a template**: Business, Portfolio, Restaurant, Landing page (edit or disable them in Admin → TEMPLATES; "Start from scratch" can be renamed, priced or hidden there too).

## First-time help
- /builder shows a short "three steps" guide the first time (dismiss with *Got it*; *How does this work?* reopens it).
- The editor starts a guided tour on the first visit (name, tabs, sections, add a section, live preview, full preview, buy). The **❓ Tour** button replays it.
- A blank site shows a highlighted "Add a section" prompt until it has a few sections.

## How a customer's site is remembered
Each site has a private edit link (`/builder/edit?id=PRJ-…&key=…`). The key is saved on the device (localStorage, then sessionStorage) **before** it is removed from the address bar.
If storage is blocked the key stays in the address so reloading still works. If a site cannot be opened the visitor gets a screen to paste the edit link or pick a saved site.
Two tabs editing the same site are protected: a stale tab is told "changed somewhere else" and chooses *Load the newer version* or *Keep my changes*.
Customers can delete their own site (not once an order exists) from "Your projects".

## Limits and protection
Only WRONG keys count against a visitor (20 per 10 minutes per IP, 10 per hour per project), so reloading never locks anyone out; up to 30 new sites per hour per IP;
request bodies are size-capped; text is HTML-escaped in generated pages; downloaded sites carry a Content-Security-Policy (own script, Bootstrap CDN, Google Fonts, https pictures, Google/OSM maps only).
