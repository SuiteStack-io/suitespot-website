# Project State — SuiteSpot Website

_Last updated: 2026-06-14_

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
| Data / backend | Supabase (`@supabase/supabase-js`) |
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
- `src/lib/` — `auth.tsx`, `propertyContext.tsx`, `rateResolver.ts`, `utils.ts`.
- `src/hooks/` — `use-mobile`, `use-toast`.
- `public/` — `robots.txt`, `sitemap.xml`, `favicon.png`, fonts, slideshow images, icons.

---

## Environment variables (`.env.example`)

| Var | Required | Notes |
|---|---|---|
| `VITE_SUPABASE_URL` | **Yes** | App crashes at startup without it |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | **Yes** | Supabase anon/publishable key |
| `VITE_GOOGLE_MAPS_API_KEY` | No | Map renders blank without it |
| `VITE_DEFAULT_PROPERTY_ID` | No | Falls back to empty string |

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
