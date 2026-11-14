// Public, write-only website counter. Reads remain protected by Supabase Auth/RLS.
const sites: Record<string, string[]> = {
  'libelula': ['https://libelulamontclair.com', 'https://www.libelulamontclair.com'],
  'little-daisy': ['https://thelittledaisybakeshop.com', 'https://www.thelittledaisybakeshop.com', 'https://littledaisybakeshop.com', 'https://www.littledaisybakeshop.com'],
  'media-remixed': ['https://mediaremixed.com', 'https://www.mediaremixed.com'],
};
const origins = new Set(Object.values(sites).flat());
const url = Deno.env.get('SUPABASE_URL')!;
const secrets = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}');
const secret = secrets.default || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const publicKeys = Object.values(JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') || '{}'));
const legacyPublic = Deno.env.get('SUPABASE_ANON_KEY');
if (legacyPublic) publicKeys.push(legacyPublic);
const hmacKey = crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin') || '';
  if (!origins.has(origin)) return new Response(null, { status: 403 });
  const headers = { 'Access-Control-Allow-Origin': origin, 'Vary': 'Origin', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'apikey, content-type', 'Cache-Control': 'no-store' };
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (req.method !== 'POST') return new Response(null, { status: 405, headers });
  // The publishable key grants ingestion only, never analytics reads or admin access.
  if (!publicKeys.includes(req.headers.get('apikey'))) return new Response(null, { status: 401, headers });
  if (req.headers.get('dnt') === '1' || req.headers.get('sec-gpc') === '1') return new Response(null, { status: 204, headers });
  const ua = req.headers.get('user-agent') || '';
  if (/bot|crawler|spider|headless|lighthouse|preview/i.test(ua)) return new Response(null, { status: 204, headers });
  try {
    if (Number(req.headers.get('content-length')) > 2048) return new Response(null, { status: 413, headers });
    const reader = req.body?.getReader(); let size = 0; const chunks: Uint8Array[] = [];
    if (reader) while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > 2048) { await reader.cancel(); return new Response(null, { status: 413, headers }); } chunks.push(value); }
    const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    const body = JSON.parse(new TextDecoder().decode(bytes));
    if (!sites[body.site]?.includes(origin) || !/^[a-f0-9-]{36}$/i.test(body.id || '')) return new Response(null, { status: 400, headers });
    if (typeof body.path !== 'string' || !body.path.startsWith('/') || body.path.startsWith('//') || body.path.length > 256 || /[?#@\x00-\x20]/.test(body.path)) return new Response(null, { status: 400, headers });
    let referrer = 'Direct / unknown';
    if (typeof body.referrer === 'string' && body.referrer) {
      try { const ref = new URL(body.referrer); if (['http:', 'https:'].includes(ref.protocol) && !sites[body.site].includes(ref.origin)) referrer = ref.hostname.slice(0, 253); } catch { /* no referrer */ }
    }
    const device = /ipad|tablet/i.test(ua) ? 'Tablet' : /mobi|android|iphone/i.test(ua) ? 'Mobile' : 'Desktop';
    const day = new Date().toISOString().slice(0,10);
    const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim();
    const digest = await crypto.subtle.sign('HMAC', await hmacKey, new TextEncoder().encode(`${day}|${body.site}|${ip}|${ua}`));
    const visitor = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
    const response = await fetch(`${url}/rest/v1/rpc/portal_record_view`, {
      method: 'POST', headers: { apikey: secret, ...(secret.startsWith('eyJ') ? { Authorization: `Bearer ${secret}` } : {}), 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_id: body.id, p_site: body.site, p_path: body.path, p_referrer: referrer, p_device: device, p_visitor: visitor }), signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) { console.error('Analytics storage failed', response.status); return new Response(null, { status: 503, headers }); }
    return new Response(null, { status: 204, headers });
  } catch { return new Response(null, { status: 400, headers }); }
});
