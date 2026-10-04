import libelulaSchema from './schema.mjs';
import littleDaisySchema from './little-daisy-schema.mjs';

// Add one entry per client. Repository paths are controlled by you, never by
// request parameters. Do not put tokens or passwords in this file.
export const clients = [{
  id: 'libelula',
  name: 'Libélula Bakery + Kitchen',
  location: 'Montclair, New Jersey',
  owner: 'owenbernstein915',
  repo: 'libelula-pages-cms',
  branch: 'main',
  draftBranch: 'client-portal-draft',
  netlifySiteIdEnv: 'LIBELULA_NETLIFY_SITE_ID',
  liveUrl: 'https://libelulamontclair.com/',
  draftUrl: '', // Optional verified Netlify branch-deploy URL.
  uploadPrefix: 'public/images/uploads/',
  schema: libelulaSchema,
}, {
  id: 'little-daisy',
  name: 'Little Daisy Bake Shop',
  location: 'Upper Montclair, New Jersey',
  owner: 'owenbernstein915',
  repo: 'little-daisy-bake-shop',
  branch: 'main',
  draftBranch: 'client-portal-draft',
  netlifySiteIdEnv: 'LITTLE_DAISY_NETLIFY_SITE_ID',
  liveUrl: 'https://littledaisybakeshop.com/',
  draftUrl: '',
  uploadPrefix: 'public/images/uploads/',
  schema: littleDaisySchema,
}];
