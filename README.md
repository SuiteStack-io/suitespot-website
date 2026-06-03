# SuiteSpot Website

Marketing + property browsing site for SuiteSpot. React 19 + TypeScript + Vite, styled with Tailwind and Radix UI, data layer on Supabase.

## Quick start

```bash
npm install
cp .env.example .env   # then fill in the values — see below
npm run dev
```

Dev server runs on http://localhost:5173 by default.

## Environment variables

Copy `.env.example` to `.env` and populate the keys. Only the Supabase pair is required to boot — the app calls `createClient()` at module load, so missing values throw before the first render.

| Variable | Required | Purpose |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | yes | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | yes | Supabase anon/publishable key |
| `VITE_GOOGLE_MAPS_API_KEY` | no | Enables `InteractivePropertyMap`; map is blank without it |
| `VITE_DEFAULT_PROPERTY_ID` | no | Default property shown by `propertyContext`; defaults to `''` |

All variables must be `VITE_`-prefixed — Vite only exposes prefixed vars to the browser bundle.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the Vite dev server with HMR |
| `npm run build` | Type-check (`tsc -b`) then produce a production build in `dist/` |
| `npm run preview` | Serve the built `dist/` locally |
| `npm run lint` | Run ESLint over the repo |

## Stack

- **Framework:** React 19, React Router 7, Vite 5
- **Styling:** Tailwind CSS 3, Radix UI primitives, `tailwindcss-animate`
- **Data:** Supabase JS, TanStack Query
- **Forms:** React Hook Form + Zod
- **Maps:** `@react-google-maps/api`
- **Deployment:** Vercel (`vercel.json`)

## Project layout

```
src/
  components/        UI components (incl. InteractivePropertyMap)
  integrations/
    supabase/        Supabase client + generated types
  lib/               Shared utilities and React contexts (propertyContext, …)
public/              Static assets served as-is
```
