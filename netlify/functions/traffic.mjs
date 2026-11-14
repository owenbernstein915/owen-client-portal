import { trackerSource } from '../../server/traffic.mjs';

export default () => {
  const url = Netlify.env.get('SUPABASE_URL');
  const key = Netlify.env.get('SUPABASE_PUBLISHABLE_KEY');
  if (!url || !key) return new Response('', { status: 503 });
  return new Response(trackerSource({ url, key }), {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      'X-Content-Type-Options': 'nosniff'
    }
  });
};
