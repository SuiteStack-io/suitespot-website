import { createClient } from '@supabase/supabase-js';

// Public website CONTENT (blog, FAQ, slideshows, room-type photos) lives in
// SuiteSpot's dedicated content project — separate from the PMS database
// (Decision #13). This client is read-only/public (anon key); content is
// edited directly in the content project, not the PMS.
const SUPABASE_URL = import.meta.env.VITE_CONTENT_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_CONTENT_SUPABASE_ANON_KEY;

export const content = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
