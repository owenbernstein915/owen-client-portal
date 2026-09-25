import { makeHandler } from '../../server/core.mjs';
export default request => {
  const keys = ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'GITHUB_TOKEN', 'PORTAL_ACCESS_JSON', 'PORTAL_SIGNUP_ALLOWLIST_JSON', 'LIBELULA_NETLIFY_SITE_ID', 'LITTLE_DAISY_NETLIFY_SITE_ID', 'NETLIFY_API_TOKEN'];
  const env = Object.fromEntries(keys.map(key => [key, Netlify.env.get(key)]));
  return makeHandler({ env })(request);
};
