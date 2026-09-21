import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { basename } from 'node:path';
import schema from '../server/schema.mjs';
const content = { website: JSON.parse(await readFile('tests/fixtures/site.json')), menus: JSON.parse(await readFile('tests/fixtures/menu.json')) };
await mkdir('preview', { recursive: true });
await copyFile('public/ob-logo-mark.png', 'preview/ob-logo-mark.png');
const imagePaths = [...new Set(JSON.stringify(content).match(/\/images\/[\w./-]+\.(?:jpe?g|png|webp|avif)/g) || [])];
const sources = [];
for (const path of imagePaths) {
  try { await copyFile('../libelula-pages-cms/public'+path, 'preview/'+basename(path)); sources.push([path, './'+basename(path)]); } catch {}
}
const css = await readFile('public/styles.css', 'utf8') + '\n' + await readFile('public/brand.css', 'utf8');
let js = await readFile('public/app.js', 'utf8');
js = js.replace("src: '/ob-logo-mark.png'", "src: './ob-logo-mark.png'");
js = js.replace(/start\(\);\s*$/, `
S.config = { preview: true }; S.session = { access_token: 'local-preview', expires_at: 9999999999 };
S.role = 'editor'; S.email = 'client@example.com'; S.sites = [{ id: 'libelula', name: 'Libélula Bakery + Kitchen', location: 'Montclair, New Jersey' }]; S.client = S.sites[0];
S.data = ${JSON.stringify({content,schema,mainSha:'a'.repeat(40),draftSha:null,hasDraft:false,baseMainSha:'a'.repeat(40),savedAt:null,stale:false})};
S.content = structuredClone(S.data.content);
for (const [key, value] of ${JSON.stringify(sources)}) S.previews.set(key, value);
api = async (action, options = {}) => {
  if (action === 'sites') return { role: S.role, email: S.email, sites: S.sites };
  if (action === 'content') return S.data;
  if (action === 'status') return { configured: false };
  if (action === 'history') return { versions: [] };
  if (action === 'draft') { S.data.content = structuredClone(options.body.content); return { draftSha: 'b'.repeat(40), baseMainSha: S.data.baseMainSha, savedAt: new Date().toISOString(), hasDraft: true }; }
  if (action === 'publish') throw new Error('Design preview only. Nothing is connected to the live website.');
  throw new Error('This action is available after the portal is connected.');
};
auth = async () => { throw new Error('This is a design preview. Sign-in is available after setup.'); };
if (new URLSearchParams(location.search).get('view') === 'login') login(); else { render(); refreshStatus(); }
`);
await writeFile('preview/index.html', `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Owen B Client Portal · Design preview</title><style>${css}</style><body><div id="app"></div><div id="notice" role="status" aria-live="polite"></div><script>${js.replace(/<\/script/gi, '<\\/script')}</script></body></html>`);
console.log('Created an offline design preview with the real UI and fixture content.');
