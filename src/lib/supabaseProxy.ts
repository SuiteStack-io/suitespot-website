// Route Supabase traffic through this site's own domain.
//
// Browsers on some networks (seen from Cairo, Nov 2026) intermittently stall
// 12 to 80 seconds while connecting to *.supabase.co, while the site's own domain
// connects instantly. The Suites page then sits empty until the booking API
// answers. On deployed sites, requests go to /sb/<project>/... on the current
// origin instead, and Vercel forwards them to Supabase server-side (see the
// /sb/ rewrites in vercel.json). Guests' browsers never connect to supabase.co.
//
// Local dev (localhost) has no Vercel rewrites, so it keeps talking to
// Supabase directly.

export type SupabaseProject = 'pms' | 'content';

const isLocal = () =>
  typeof window === 'undefined' ||
  ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);

/** Base URL to use for a Supabase project: the same-origin proxy when deployed. */
export function supabaseBaseUrl(directUrl: string, project: SupabaseProject): string {
  const direct = directUrl.replace(/\/+$/, '');
  return isLocal() ? direct : `${window.location.origin}/sb/${project}`;
}

/**
 * fetch for the content client: also rewrites public Storage URLs inside JSON
 * responses (photo URLs are stored as absolute supabase.co links) so images
 * load through the proxy too.
 */
export function proxyAwareFetch(directUrl: string, project: SupabaseProject): typeof fetch {
  const direct = directUrl.replace(/\/+$/, '');
  const from = `${direct}/storage/v1/object/public/`;
  return async (input, init) => {
    const res = await fetch(input, init);
    const base = supabaseBaseUrl(direct, project);
    if (base === direct || !(res.headers.get('content-type') ?? '').includes('json')) return res;
    const text = await res.text();
    if (!text.includes(from)) return new Response(text, res);
    const headers = new Headers(res.headers);
    headers.delete('content-length');
    return new Response(text.split(from).join(`${base}/storage/v1/object/public/`), {
      status: res.status,
      statusText: res.statusText,
      headers,
    });
  };
}
