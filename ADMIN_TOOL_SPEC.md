# Build brief — SuiteSpot Website Content Admin (`/admin`)

> Paste this whole file as the prompt for a fresh Claude Code session **run inside the
> `suitespot-website` repo**. It is self-contained. Work on a new branch
> (e.g. `feat/content-admin`); do not push to `main` until verified on a preview.

## Goal

Build a **login-gated content admin tool at `/admin`** in this website so the operator can
manage the site's content (blog posts, FAQ, hero slideshow, our-story slideshow, room-type
photos) — create / edit / delete + image uploads — directly, without using the Supabase
dashboard.

## Why this exists (background)

This public website's **content** was just moved out of the Hostbase **PMS** database into a
**dedicated Supabase project** (its own account). The site already reads content from that
project (see `src/integrations/content/client.ts`); **booking** data still comes from the PMS
client (`src/integrations/supabase/client.ts`) — leave booking alone. The PMS used to host the
content editors; under the new "each site owns its content + its editor" model, that editor now
lives here. (This is "Phase 2.4-C, step 1" of a larger plan; you only build the website side.)

## What already exists — do NOT re-create

- **Content Supabase project:** ref `saarhzqccbeucbdodylp`, URL `https://saarhzqccbeucbdodylp.supabase.co`.
- **Content client:** `src/integrations/content/client.ts` — `createClient(VITE_CONTENT_SUPABASE_URL, VITE_CONTENT_SUPABASE_ANON_KEY)`. Env vars are already set locally (`.env.local`) and on Vercel (Production + Preview).
- **RLS on the content project (already configured):**
  - `anon` → **read-only** (`SELECT`; blog/faq filtered to published). Public site uses this. Don't change it.
  - `authenticated` → **full CRUD** on all 5 content tables (`FOR ALL ... USING(true) WITH CHECK(true)`), plus `SELECT/INSERT/UPDATE/DELETE` grants.
  - **Storage:** buckets `property-photos`, `slideshow`, `our-story-slideshow` are **public** (anon read); `authenticated` may upload/replace/delete in those 3 buckets.
- **Admin login user:** the operator creates it in the content project dashboard (Authentication → Users → Add user, email + password, Auto Confirm). Email/password auth. Assume it exists.

## Auth (the core new piece)

- The website is currently anon/read-only. The admin tool authenticates with **Supabase email/password** on the **content project** and then writes as the `authenticated` role (RLS allows it). **Never** put a service_role key in the frontend.
- **Enable session persistence on the content client** so login sticks. Update `src/integrations/content/client.ts`:
  ```ts
  export const content = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, storage: localStorage },
  });
  ```
  (Anonymous public visitors simply have no session → still hit RLS as `anon`, unchanged.)
- Use `content.auth.signInWithPassword`, `content.auth.signOut`, `content.auth.getSession`, `content.auth.onAuthStateChange`.

## What to build

1. **Routing** (`src/App.tsx`, react-router-dom v7):
   - `/admin` → the admin app, **lazy-loaded / code-split** (`React.lazy` + `Suspense`) so the public bundle isn't bloated.
   - An auth guard: if no session → show the login screen; if session → show the dashboard. (A simple `useEffect`/state gate is fine; no need for the public site's providers.)
2. **Login screen** — email + password form (shadcn `Input`/`Button`/`Card`), calls `signInWithPassword`, shows errors, redirects to the dashboard on success.
3. **Admin dashboard** — a `Tabs` layout (shadcn `Tabs`) with one tab per content type + a Logout button:
   - **Blog**, **FAQ**, **Hero Slideshow**, **Our Story Slideshow**, **Room Photos**.
4. **Managers** (one per tab) — list existing rows, create, edit, delete; image uploads where relevant. Reuse the website's existing shadcn UI in `src/components/ui/`. Use TanStack Query (already a dependency) for fetch/mutate, or simple `useState`/`useEffect` — match the repo's prevailing style.

## Content model (tables in the content project)

All tables have `id uuid default gen_random_uuid()`, `created_at`, `updated_at` (where present). Fields to edit:

- **`blog_posts`**: `h1_title`*(req)*, `h2_subtitle`, `slug`*(req, unique)*, `content` *(markdown — the public `BlogPost` page renders it; match that renderer, see `src/pages/BlogPost.tsx` / any `BlogContentRenderer`)*, `excerpt`, `featured_image_url` *(upload → `property-photos` bucket, path `blog/<timestamp>-<rand>.<ext>`)*, `meta_title`, `meta_description`, `status` *('draft' | 'published')*, `published_at`.
- **`faq_items`**: `question`*(req)*, `answer`*(req)*, `sequence_order` *(int, for ordering)*, `is_published` *(bool)*.
- **`slideshow_images`** (homepage hero): `image_url`*(req, upload → `slideshow` bucket)*, `sequence_order`. *(Optional columns `blur_placeholder`, `image_url_sm/md/lg` exist — you may ignore them in v1; the site falls back to `image_url`.)*
- **`our_story_slideshow`**: `image_url`*(req, upload → `our-story-slideshow` bucket)*, `sequence_order`. (same optional columns.)
- **`room_type_photos`**: `room_type_name`*(req)*, `photo_url`*(req, upload → `property-photos` bucket, path `room-types/<room_type_name>/<filename>`)*, `display_order` *(int)*, `is_cover` *(bool — one cover per room type)*. Existing room type names: **Deluxe Suite, Double Room with Terrace, Family Suite, Junior Suite, Suite with Terrace** (the public `Suites` page matches photos to rooms by this name). Let the operator pick from existing names or type a new one.

## Image upload pattern

```ts
const ext = file.name.split('.').pop();
const path = `${prefix}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
const { error } = await content.storage.from(bucket).upload(path, file, { upsert: false });
const { data } = content.storage.from(bucket).getPublicUrl(path);
// store data.publicUrl in the row's *_url column
```
Buckets are public, so `getPublicUrl` gives the URL the public site reads. Requires an authenticated session (RLS).

## Constraints / conventions

- **Stack:** React 19 + Vite, TypeScript, react-router-dom v7, Tailwind, shadcn/Radix (`src/components/ui/`), TanStack Query, react-hook-form + zod, lucide-react. Match existing patterns.
- **Do NOT** touch the public-facing read components or the booking flow (PMS client). Only add the `/admin` area + enable auth on the content client.
- **Do NOT** add the service_role key anywhere in the frontend.
- Keep `/admin` code-split so the public site's bundle/perf is unaffected.
- `npm run build` must pass (`tsc -b && vite build`).

## Optional reference (same machine)

The original PMS editors are good references for fields/UX (read-only — they're in a different repo, the content schema here dropped `organization_id`/`author_id`/`property_id`):
`/Users/macmini/Documents/claude-projects/hostbase-product/src/components/{BlogManagement,CreateBlogPostDialog,FAQManagement,CreateFAQDialog,SlideshowManager}.tsx`, `src/pages/HomepageManagement.tsx`, and the room-photo manager inside `src/pages/Rooms.tsx` (~lines 300–410). Adapt them to write via the `content` client (no `property_id`/`organization_id`).

## Acceptance criteria

1. Visiting `/admin` unauthenticated shows the login screen; the rest of the site is unaffected.
2. Logging in with the content-project admin user shows the dashboard.
3. For each of the 5 content types: list, create, edit, delete works; image uploads land in the correct bucket and the new content appears on the corresponding **public** page.
4. Logout returns to the login screen.
5. `npm run build` passes; verify on a Vercel **preview** deploy before merging.

## Out of scope (handled separately, in the PMS repo)

- The PMS-side cleanup: removing the PMS **blog / FAQ / slideshow / our-story** editors and dropping those 4 PMS tables. (Done in the PMS repo, not here.)
- The booking API.

**PMS keeps** (do not worry about these here): `room_type_photos` / `unit_photos` (the PMS Rooms page manages them for operational use) and `property_amenities` / `nearby_amenities` (PMS guest portal).

> **Room Photos nuance:** this admin tool manages the **content-project** `room_type_photos` — the copy the **public site actually displays**. The PMS keeps a separate `room_type_photos` for its own operational Rooms page; the two are independent (PMS edits do not reach the website). So keep the **Room Photos** tab here — it's the only way to change what the site shows.
