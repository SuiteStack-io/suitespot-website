import { createClient } from '@supabase/supabase-js';
import { proxyAwareFetch, supabaseBaseUrl } from '@/lib/supabaseProxy';

// Public website CONTENT (blog, FAQ, slideshows, room-type photos) lives in
// SuiteSpot's dedicated content project — separate from the PMS database
// (Decision #13). This client is read-only/public (anon key); content is
// edited directly in the content project, not the PMS.
const SUPABASE_URL = import.meta.env.VITE_CONTENT_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_CONTENT_SUPABASE_ANON_KEY;

// Deployed sites go through the same-origin /sb/content proxy, photo URLs
// included (see src/lib/supabaseProxy.ts). Read-only anon client: no session.
export const content = createClient(supabaseBaseUrl(SUPABASE_URL, 'content'), SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: proxyAwareFetch(SUPABASE_URL, 'content') },
});
