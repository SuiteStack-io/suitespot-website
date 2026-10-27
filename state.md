# Project State — SuiteSpot Website

_Last updated: 2026-08-13_

Public marketing & booking website for **SuiteSpot Hospitality** (Egypt). Single-page
React app deployed on Vercel at **https://www.findyoursuitespot.com**.

---

## Stack

| Layer | Tech |
|---|---|
| Framework | React 19 + Vite 5, TypeScript |
| Routing | `react-router-dom` v7 (client-side SPA) |
| Styling | Tailwind CSS 3 + `tailwindcss-animate`, `@tailwindcss/typography` |
| UI components | Radix UI primitives + shadcn-style wrappers in `src/components/ui/` |
| Data / backend | Dedicated **content** Supabase project (`@supabase/supabase-js`) + the **PMS** reached only via the **Hostbase Booking API** (Edge Functions) — see [Booking API repoint](#booking-api-repoint-phase-24-b) |
| Data fetching | TanStack React Query |
| Forms | `react-hook-form` + `zod` + `@hookform/resolvers` |
| SEO | `react-helmet-async` (per-route meta via `src/components/SEO.tsx`) |
| Maps | `@react-google-maps/api` |
| Icons | `lucide-react` |
| Hosting | Vercel (project `suitespot-website`, team `youssefs-projects-94b1f3d5`) |

---

## Routes (`src/App.tsx`)

| Path | Page |
|---|---|
| `/` | `PublicHome` |
| `/book` | `BookingFlow` |
| `/booking-confirmation` | `BookingConfirmation` |
| `/iconia-zamalek` | `IconiaZamalek` (property page) |
| `/about` | `About` |
| `/locations` | `Locations` |
| `/suites` | `Suites` |
| `/wellness` | `Wellness` |
| `/experiences` | `Experiences` |
| `/nearby` | `Nearby` |
| `/blog` | `Blog` — route works, but `blog_posts` is empty, so it renders a soft 404. **Removed from `sitemap.xml`**; re-add once posts are published |
| `/blog/:slug` | `BlogPost` |
| `/faq` | `FAQ` — content comes from the content Supabase project, not the repo |

Providers wrapping the app: `QueryClientProvider` → `PropertyProvider` → `BrowserRouter`,
plus `Toaster` (shadcn) and `Sonner` toasts.

---

## Key source areas

- `src/pages/` — one component per route (see table above).
- `src/components/` — feature components: `HeroSlideshow`, `BookingWidget`,
  `InteractivePropertyMap`, `OurStorySlideshow`, `SuiteLightbox`, `PublicNav`,
  `PublicFooter`, `BlogContentRenderer`, `SEO`.
- `src/components/ui/` — shadcn/Radix UI primitives.
- `src/integrations/supabase/` — `client.ts` (auto-generated client) + `types.ts`
  (generated DB types). **Do not hand-edit `client.ts`.**
- `src/lib/` — `auth.tsx`, `propertyContext.tsx`, `bookingApi.ts` (typed Booking API
  client), `utils.ts`. (`rateResolver.ts` removed — replaced by the Booking API.)
- `src/hooks/` — `use-mobile`, `use-toast`.
- `public/` — `robots.txt`, `sitemap.xml`, `llms.txt`, `favicon.png`, fonts, slideshow
  images, icons. Anything here must live in `public/` rather than being served by a route:
  `vercel.json`'s catch-all SPA rewrite would otherwise hand back `index.html`.

---

## Environment variables (`.env.example`)

| Var | Required | Notes |
|---|---|---|
| `VITE_CONTENT_SUPABASE_URL` | **Yes** | Content project URL (blog/FAQ/slideshows/photos) |
| `VITE_CONTENT_SUPABASE_ANON_KEY` | **Yes** | Content project anon/publishable key |
| `VITE_SUPABASE_URL` | **Yes** | PMS project URL — also the **Booking API base** (`${VITE_SUPABASE_URL}/functions/v1`). App crashes at startup without it |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | **Yes** | PMS anon key. No longer used for booking reads, but keep set so import doesn't throw |
| `VITE_BOOKING_SERVING_HOST` | No | Booking API tenant fallback for localhost/preview (Origin isn't a tenant domain there). Set to `findyoursuitespot.com`. Ignored in prod |
| `VITE_GOOGLE_MAPS_API_KEY` | No | Map renders blank without it |
| `VITE_DEFAULT_PROPERTY_ID` | No | Legacy/optional — Booking API resolves the property server-side |

---

## Booking API repoint (Phase 2.4-B) — ✅ live in production

**Merged to `main` and live on `findyoursuitespot.com`** (PRs #2 + #3). The public
site no longer queries the PMS booking tables directly with the anon key. All
booking data flows through **four Hostbase Edge Functions** at
`${VITE_SUPABASE_URL}/functions/v1` (POST, JSON, `verify_jwt=false` — no
apikey/JWT). The functions resolve the tenant from the request **Origin** (with an
optional `serving_host` body fallback for localhost/preview) and return only that
org's data.

- **Client:** `src/lib/bookingApi.ts` — typed `post()` helper that injects
  `serving_host`, throws `BookingApiError` on non-2xx. Exports
  `getPublicProperty()`, `getAvailability()`, `getRates()`, `createReservation()`.
- **Repointed files:** `BookingFlow.tsx` (availability + rates + reservation),
  `BookingWidget.tsx` (date/guest hand-off only), `Locations.tsx` (property
  marker + representative rate), `Suites.tsx` (`units` → `getAvailability`,
  keeps the content `room_type_photos` read). `rateResolver.ts` deleted.
- **Room-type key:** pricing lookups resolve `room_type` by **`units.name`**
  (`name || booking_com_name || unit_type`), matching the rate-plan key and the
  server's `public-create-reservation` resolution, so the displayed price and the
  charged price always hit the same rate plan. Display labels still use
  `booking_com_name`. (PR #3 — fixed a 422 where the create path priced by
  `unit_type` while the read path priced by name.)
- **Quote by `unit_id`:** `getRates` passes the selected `unit_id` (PR #4) so
  `public-rates` resolves `room_type` from `units.name` server-side — the exact key
  `public-create-reservation` prices on — making the quote and the booking share
  one canonical path that can't desync. (`Locations` keeps a bare `room_type` for
  its representative rate, with no specific unit.)
- **Pricing parity:** the site's `calculateSubtotal/Tax/Total` are unchanged, fed
  by `ratePlan` + `rates` (from `public-rates`) and `unit.tax_percentage` (from
  `public-availability`). The server recomputes the price authoritatively
  (`(Σ nightly rate + third-guest fee when adults===3) × (1 + tax%)`) and
  **ignores any client total** — the booking sends no `total_price`. Changing the
  site formula requires changing the PMS `public-create-reservation` too.
- **Behavior change:** per-date booked/blocked data is no longer exposed to the
  public site, so the calendars only disable **past** dates. Availability is
  enforced after a range is picked — `getAvailability` returns `availableUnitIds`
  (the bookable subset) and the suite dropdown shows "no suites available" when a
  range is fully booked. Server returns `409` as the final backstop.
- **Environments:** functions are live on **prod** (`zcrcjxidzyfnehebfnbq`) and
  **staging** (`lziepvaoiwxxajvpvkwu`); the prod org→domain map resolves
  `findyoursuitespot.com`. `VITE_BOOKING_SERVING_HOST=findyoursuitespot.com` is set
  on Vercel for Production + Preview (only needed off-prod, where Origin isn't a
  tenant domain).
- **Verified in prod (2026-06-23):** live routes 200; `public-property`,
  `public-availability` (incl. dated `availableUnitIds` filtering), and
  `public-rates` all 200; `public-create-reservation` returns 200 (real test
  bookings succeeded after the PR #3 fix). Edge logs clean for the SuiteSpot flow.
  Note: the prod functions are **multi-tenant** — a `public-rates` 404 in the
  shared logs is another org, not SuiteSpot (all 5 SuiteSpot room types have an
  active rate plan).

---

## AEO publish (2026-08-13) — ✅ live

Answer-engine optimization pass so AI assistants have something quotable to retrieve for
Cairo/Zamalek stay queries. Driven by
`Dowey-Workspace/content/suitespot-aeo/DEV-CHECKLIST.md`; strategy in
`Dowey-Workspace/campaigns/suitespot-aeo-cairo-playbook.md`.

**This repo — commit `63b0471`:**

- **`public/llms.txt`** — SuiteSpot Hospitality fact sheet, live at
  `https://www.findyoursuitespot.com/llms.txt` as real `text/plain; charset=utf-8`.
  It has to sit in `public/` to survive the SPA rewrite. Watch the file mode: `cp` from
  the drafts carries `600` across and would ship unreadable — it needs `644`.
- **`public/robots.txt`** — references `llms.txt`.
- **`public/sitemap.xml`** — `/blog` removed (soft 404, see the routes table). Now 10 `<loc>`
  entries. Building a real blog index was the alternative and was skipped: it needs Supabase
  content that doesn't exist yet.

**Sister repo `claude-projects/iconia-zamalek-residences` — commits `a2026f6` + `25cbddf`:**

Six long-form guide pages, `llms.txt`, sitemap (11 `<loc>`), then the FAQ/schema correction
pass. Then **`e71fa05` shipped the cinematic redesign** — all six main pages rewritten
against `css/cinematic.css` + `js/cinematic.js`, carrying the AEO work forward intact.

Worth knowing, because it cost time: the redesign sat **uncommitted in the working tree from
Aug 9 to Aug 13** and was widely assumed to be live. It never was. Every production deploy on
that Vercel project is git-sourced, and the Aug 9 15:59 deploy — made from the CLI, same
minute the `.vercel` folder appeared — redeployed the March 31 commit `926d7ea`, not the
working tree. **A `vercel` CLI deploy there does not publish uncommitted work.** If it isn't
pushed, it isn't live.

Two fact-lock drifts were caught in the redesign copy on the way out: `about.html` and
`suites.html` said "Daily housekeeping", and the `index.html` stat band had been restyled
from "24/7 / Guest Support" into "24/7 / On-site team" — a staffed-presence claim that
contradicts the 10:00–03:00 desk. Both corrected in `e71fa05`. `design-options/` is now in
`.vercelignore` so the mockups can never reach the live domain via a CLI deploy.

**The fact-lock, which both sites must agree on:**

| Fact | Value |
|---|---|
| Reception desk | Staffed **08:00–03:00 daily** — not a 24-hour lobby |
| Check-in / out | From 15:00 / by **12:00** |
| Breakfast | **No** large buffet. Serviced apartment, not a full-service hotel |
| Housekeeping | Serviced-apartment cadence, **not** automatic daily hotel service |
| Operator | SuiteSpot Hospitality. **Lemon Spaces is a different operator**, in the same building, leaving 2027-03-31 |
| Booking listing | "ICONIA Zamalek - Boutique Stay & Wellness Residences" |
| Suite from-prices | USD 110 / 130 / 145 / 160 (Junior / Deluxe / Terrace / Family) |

Anything that contradicts this row set is a bug, on either domain.

---

## Deployment & domains

- **Canonical host: `www.findyoursuitespot.com`.** Every SEO signal uses `www`:
  - `src/components/SEO.tsx` → `BASE_URL = 'https://www.findyoursuitespot.com'`
  - `public/sitemap.xml` → all URLs are `www`
  - `public/robots.txt` → sitemap points to `www`
  - `index.html` → static canonical is `www`
- **`vercel.json`** does two things:
  1. Redirects apex `findyoursuitespot.com` → `https://www.findyoursuitespot.com` (308, path-preserving).
  2. SPA rewrite: all paths → `/` so client-side routing works on deep links / refresh.
- DNS managed at GoDaddy (nameservers `ns65/66.domaincontrol.com`), with records pointing
  to Vercel (`www` → `cname.vercel-dns.com`, apex → Vercel IPs). Nameservers are **not**
  Vercel's, but the records resolve correctly so this is fine.
- Both `findyoursuitespot.com` and `www.findyoursuitespot.com` are attached to the
  Vercel project.

---

## Fix applied 2026-06-14 — TLS error + SEO canonicalization

### Symptom
Visitors hit `NET::ERR_CERT_COMMON_NAME_INVALID` ("Your connection is not private") on
`www.findyoursuitespot.com`. Separately, Google Search Console reported pages as
*"Alternate page with proper canonical tag."*

### Root cause
- The `www` subdomain was **never attached to the Vercel project**, so Vercel issued no
  TLS cert for it. The cert served covered only the apex (`CN=findyoursuitespot.com`),
  so `www` failed the hostname match.
- Meanwhile the entire site declares `www` as canonical — so Google was told to index a
  host that had no valid cert, and apex + `www` were both serving content independently
  (duplicate URLs → the "alternate page" notice).

### Changes made
1. **Attached `www.findyoursuitespot.com` to the Vercel project** via
   `vercel domains add www.findyoursuitespot.com`. Vercel auto-issued a Let's Encrypt
   cert covering the hostname. (Vercel-side config — not in the repo.)
2. **Added an apex → `www` 308 redirect** to `vercel.json` (committed) so search engines
   see a single canonical host and the apex stops competing as a duplicate.

### Verification
- `https://www.findyoursuitespot.com/` → HTTP 200, valid TLS cert (`CN=www.findyoursuitespot.com`).
- `https://www.findyoursuitespot.com/about` (deep route) → HTTP 200.
- `https://findyoursuitespot.com/` → 308 → `https://www.findyoursuitespot.com/`.
- `https://findyoursuitespot.com/about` → 308 → `https://www.findyoursuitespot.com/about` (path preserved).

### Commit
`01b4670` — "Redirect apex domain to www (canonical host)" — pushed to `main`.

---

## Follow-ups / open items

- [ ] In Google Search Console, run **"Validate Fix"** on the *Alternate page with proper
      canonical tag* report to speed up re-crawl (otherwise resolves on next natural crawl).
- [ ] Consider moving DNS nameservers to Vercel (`ns1/ns2.vercel-dns.com`) for fully
      managed DNS — optional; current external records work.
- [ ] **`feat/content-admin` (Phase 2.4-C)** — the login-gated `/admin` content editor
      is still unmerged. It was branched before the booking merges, so landing it needs
      a rebase onto `main` (expect a small `state.md` conflict; code files don't overlap).
- [ ] Optional booking hardening: if a unit ever gets a `booking_com_name` that differs
      from `name`, confirm rate plans stay keyed on `units.name` (the pricing key).

### AEO follow-ups

- [ ] **Youssef:** submit both sitemaps in Google Search Console and Bing Webmaster Tools
      (Bing is the retrieval path ChatGPT uses). GSC for `iconiazamalekresidences.com` was
      healthy on 2026-08-13 but still reported 5 discovered pages against the pre-publish
      sitemap; it should read 11 after a resubmit. `findyoursuitespot.com` in GSC and both
      domains in Bing are unchecked.
- [ ] **Youssef:** ops copy consistency — Booking.com property description, Google Business
      Profile hours/Q&A, and the WhatsApp business intro all need to match the fact-lock
      above. This is checklist section 6 and it blocks the campaign.
- [x] **`src/pages/IconiaZamalek.tsx:66`** — "24/7 concierge" in the meta description replaced
      with "reception 08:00–03:00" (owner-approved 2026-10-27).
- [ ] **Unverified:** the `/faq` route renders from the content Supabase project, so its
      answers were never checked against the fact-lock. If any of them claim 24/7 reception
      or a breakfast buffet, this domain now contradicts the sister site. Worth a query.
- [ ] `sameAs` on the ICONIA `LodgingBusiness` node is missing the Booking.com listing URL
      and the Google Business Profile URL. Neither exists anywhere in either repo and they
      were deliberately not invented — supply them and it's a one-line add.
- [ ] Optional: mirror longer `/llms-full.txt` versions on both domains (checklist section 1,
      marked optional).
