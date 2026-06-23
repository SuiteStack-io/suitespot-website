# Project State — SuiteSpot Website

_Last updated: 2026-06-23_

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
| `/blog` | `Blog` |
| `/blog/:slug` | `BlogPost` |
| `/faq` | `FAQ` |

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
- `public/` — `robots.txt`, `sitemap.xml`, `favicon.png`, fonts, slideshow images, icons.

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
