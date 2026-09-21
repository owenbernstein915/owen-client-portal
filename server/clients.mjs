import schema from './schema.mjs';

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
  liveUrl: '', // Set the actual live URL here if not using the Netlify API.
  draftUrl: '', // Optional verified Netlify branch-deploy URL.
  uploadPrefix: 'public/images/uploads/',
  schema,
}];
