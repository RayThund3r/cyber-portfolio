# Site Studio (admin → STUDIO)

Designs complete, responsive business websites like Elegant Hair & Glam, OLAM Creations and A.G.E Concepts,
and shows them live inside your portfolio.

## What a generated site contains
Hero slideshow, about + numbers, services, product/package catalogue (search, categories, product sheets), cart with
WhatsApp ordering, deposits and promo codes, appointment booking **or** quote requests, reviews, gallery with lightbox,
FAQ, contact form, order tracking, newsletter, English / Swahili / Luganda, light + dark mode, bottom tab bar on phones,
and an owner admin page (add `#admin` to the site address).

## Workflow
1. **New website**: pick a starting look (Rose Studio, Navy Workshop, Gold Events, Fresh Shop), type the business name.
2. **Design**: nine groups (brand, contact, look, content, catalogue, booking/quotes, payments, features, advanced).
   The live preview (phone / tablet / desktop) is the real site. Changes autosave.
3. **Publish live demo**: makes `/demo/<name>` public (noindex). Then **add to my portfolio**: creates a portfolio entry
   with a "Live site" link and a working phone-frame preview on its detail page.
4. **Download site (.zip)**: `index.html` + `assets/` + README with the owner passcode. Upload to any static host.
5. **Import / restore**: open a site's `index.html` made with this engine (your three existing sites import with their
   text, colours, fonts, translations intact; logo files that sat next to the site must be uploaded again), or restore a
   Studio **backup (.json)** (settings + pictures).

## Things to know (honest notes)
- The owner's first admin passcode is part of the site's code, so anyone who views the page source can read it until the
  owner changes it on first sign-in. Treat the in-site admin as a convenience, not bank-grade security.
- Orders, bookings and enquiries are sent to the business's WhatsApp number. Without a **cloud database URL** (Firebase
  Realtime Database, Advanced group) the site's admin dashboard only shows what happened in the browser being used.
- The engine used to seed the dashboard "visits" chart with invented numbers; generated sites start at zero.
- Public demos never include the real passcode or cloud database; their data stays in each visitor's own browser.
- Pictures are stored on the server's data disk (up to 20 MB per site). If your host's disk is temporary, download a
  **Backup** for each site regularly.
- Fonts load from Google Fonts; photos from the starter looks are stock images: replace them.
- `src/lib/studio/engineData.ts` is generated from three production sites by `scripts/studio/extract_engine.py`.

## Where the code is
`src/lib/studio/` (schema, generator, importer, looks, presets, engine), `src/server/studio.ts`,
`src/app/api/studio/route.ts`, `src/app/demo/[slug]/`, `src/components/studio/`.
