# Build brief — Repoint the booking flow to the Hostbase Booking API (Phase 2.4-B)

> Paste this whole file as the prompt for a fresh Claude Code session **run inside the
> `suitespot-website` repo**. Self-contained. Work on a new branch (e.g.
> `feat/booking-api`); don't push to `main` until verified on a preview.

## Goal

Stop the public website from querying the PMS **booking tables directly** with the anon
key. Instead, call **4 Hostbase Edge Functions** that resolve the tenant server-side from
the request domain and return only that org's data. This is the precondition for revoking
anon access to the PMS booking tables (done separately, PMS-side).

Currently the site reads `units`, `rate_plans`, `rate_plan_prices`, `rate_plan_date_overrides`,
`blocked_dates`, `reservations`, `properties` directly (in `BookingFlow.tsx`, `rateResolver.ts`,
`BookingWidget.tsx`, `Locations.tsx`, `Suites.tsx`). Replace those **data calls** with the API.
**Keep all UI/flow logic** (date pickers, breakdown rendering, calculateSubtotal/Tax/Total) —
only the data source changes.

## The API (already built + deployed to STAGING)

Base URL: **`${VITE_SUPABASE_URL}/functions/v1`** — same PMS project the booking client already
points at. All are `POST`, `Content-Type: application/json`, **no apikey/JWT needed**
(`verify_jwt=false`). The browser's `Origin` identifies the tenant.

> **Dev/preview gotcha:** on `localhost` / Vercel preview, `Origin` isn't a tenant domain, so
> the API 404s. Every request may include an optional **`serving_host`** in the body; it's used
> only as a fallback when the real Origin doesn't resolve (prod stays Origin-resolved). So add
> `VITE_BOOKING_SERVING_HOST=findyoursuitespot.com` to `.env.local`, and have the client include
> `serving_host: import.meta.env.VITE_BOOKING_SERVING_HOST` on every call (harmless in prod).

### 1. `POST /public-property`  → property + branding
Body: `{ serving_host? }`
Returns: `{ property: { id, name, currency, city, country, address, timezone, latitude, longitude, default_checkin_time, default_checkout_time }, organization: { name, logo_url, primary_color, secondary_color } }` · `404` unknown domain.
Replaces: the `properties` lookups in `BookingWidget.tsx` / `Locations.tsx` (and `getDefaultPropertyId`'s purpose — the property id now comes from here).

### 2. `POST /public-availability`  → room types + open units
Body: `{ date_from?, date_to?, unit_type?, serving_host? }` — `date_to` is the **checkout** date (exclusive).
Returns: `{ property_id, units: [{ id, name, booking_com_name, unit_type, unit_number, status, beds, baths, max_guests, unit_size, sofa_bed, tax_percentage, photos, room_type_display_order }], availableUnitIds: string[] | null }`
`availableUnitIds` is `null` when no dates are given (all `units` returned); otherwise it's the subset bookable for the range (same overlap + blocked-date rule the site uses). Filter/group `units` by `availableUnitIds` exactly as `BookingFlow`/`Suites` do today. **`tax_percentage` is included** — keep using it in `calculateTax`.

### 3. `POST /public-rates`  → nightly rates + rate-plan meta
Body: `{ room_type, date_from, date_to, serving_host? }` — `date_to` = checkout (exclusive).
Returns:
```json
{ "room_type": "...", "ratePlan": { "ratePlanId","ratePlanName","weekdayRate","weekendRate","offPeakRate","minStay","extraAdultRate" },
  "currency": "USD", "rates": [{ "date","finalRate","baseRate" }], "nightlyTotal": 267.45 }
```
This is a **one-call replacement** for `rateResolver.getActiveRate()` **+** the `calculate-dynamic-price-batch` invoke in `BookingFlow.tsx`. Map: `ratePlan` → your `ratePlanRate` state; `rates` → your `dailyRates` state (`{date, finalRate, baseRate}` already match). `400` missing params · `404` no rate plan.

### 4. `POST /public-create-reservation`  → create booking (server-authoritative price)
Body: `{ unit_id, check_in_date, check_out_date, guest_names: string[], guest_types?: string[], guest_genders?: string[], adults?, children?, contact_email, contact_phone?, guest_nationality?, notes?, serving_host? }`
Returns: `{ ok, booking_reference, reservation_id, total_price, price_per_night, currency }`
Replaces the `reservations.insert(...)` in `BookingFlow.tsx`. **The server recomputes the price and IGNORES any client total** — it uses the exact site formula: `(Σ nightly dynamic rate + third-guest fee when adults===3) × (1 + unit.tax_percentage%)`. It also fires `send-reservation-notification`. Errors: `400` invalid · `404` unit not found · `409` unavailable · `422` cannot price.
> Send the booking fields only — **do not send `total_price`** (the server computes it). Use the returned `total_price` for the confirmation screen.

## Pricing parity (important)

The site keeps its `calculateSubtotal / calculateTax / calculateTotalPrice` logic unchanged —
fed by `ratePlan` + `rates` (from `public-rates`) and `unit.tax_percentage` (from
`public-availability`). The server uses the **same formula**, so the displayed total equals
the stored/charged total. If you change the pricing formula on the site, the PMS function
`public-create-reservation` (in the `hostbase-product` repo) must change too.

## What to build

1. **`src/lib/bookingApi.ts`** — a small typed client: `const BOOKING_API = \`${import.meta.env.VITE_SUPABASE_URL}/functions/v1\``; one `post(path, body)` helper that injects `serving_host` and `Content-Type`, throws on non-2xx. Export `getPublicProperty()`, `getAvailability()`, `getRates()`, `createReservation()`.
2. **Repoint** the 5 files to use it, deleting the direct `supabase.from(<booking table>)` / `supabase.functions.invoke('calculate-dynamic-price-batch')` calls:
   - `src/lib/rateResolver.ts` → replace `getActiveRate` + batch with `getRates()` (or delete and inline).
   - `src/pages/BookingFlow.tsx` → availability via `getAvailability()`, rates via `getRates()`, booking via `createReservation()` (remove the direct `reservations.insert` + the `send-reservation-notification` invoke — the server does it).
   - `src/components/BookingWidget.tsx`, `src/pages/Locations.tsx` → `getAvailability()` / `getPublicProperty()`.
   - `src/pages/Suites.tsx` → its `units` (booking) query → `getAvailability()`. (Its `room_type_photos` read already uses the **content** client — leave that.)
3. Keep the PMS `supabase` client only if something non-booking still needs it; otherwise the booking tables are no longer queried directly.

## Constraints

- Stack: React 19 + Vite, TS, react-router v7, Tailwind/shadcn, TanStack Query. Match patterns.
- No apikey/service key in the frontend. Plain `fetch` to the function URLs is fine.
- `npm run build` must pass.
- **Staging vs prod:** the functions are live on **staging** (`lziepvaoiwxxajvpvkwu`) now. To test, point `VITE_SUPABASE_URL` at staging (+ `VITE_BOOKING_SERVING_HOST=findyoursuitespot.com`). The functions are **not on prod yet** — the PMS-side cutover deploys them to prod and revokes anon; don't merge the website repoint to prod-live until that's coordinated.

## Acceptance criteria

1. The booking flow (browse rooms → pick dates → see rates/breakdown → book) works end-to-end via the API, with **no direct `supabase.from()` on booking tables**.
2. Displayed total matches the breakdown; the created reservation's `total_price` (from the API) matches the displayed total.
3. `availableUnitIds` correctly hides booked/blocked units.
4. `npm run build` passes; verify on a Vercel preview (set the staging env + `serving_host`).

## Out of scope (handled PMS-side, separately)

- Deploying the functions to prod + **revoking anon** on the PMS booking tables (the cutover).
- Content/admin (`ADMIN_TOOL_SPEC.md`) — unrelated.
