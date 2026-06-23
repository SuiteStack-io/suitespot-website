import { createClient } from '@supabase/supabase-js';

// Public website CONTENT (blog, FAQ, slideshows, room-type photos) lives in
// SuiteSpot's dedicated content project — separate from the PMS database
// (Decision #13). Public visitors read with the anon key (RLS read-only). The
// /admin editor signs in (email/password) and writes as the `authenticated`
// role, which RLS allows full CRUD on the content tables + storage buckets.
const SUPABASE_URL = import.meta.env.VITE_CONTENT_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_CONTENT_SUPABASE_ANON_KEY;

// Session persistence keeps the /admin login sticky across reloads. Anonymous
// public visitors simply have no session and keep hitting RLS as `anon`.
export const content = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storage: localStorage,
  },
});
