import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { makeHandler, accessFor, validateContent, validateUpload, clientFor } from '../server/core.mjs';
import { clients } from '../server/clients.mjs';
const initial = { website: JSON.parse(await readFile(new URL('./fixtures/site.json', import.meta.url))), menus: JSON.parse(await readFile(new URL('./fixtures/menu.json', import.meta.url))) };
const hash = x => createHash('sha1').update(JSON.stringify(x)).digest('hex');
const env = { SUPABASE_URL: 'https://test.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'public-key', GITHUB_TOKEN: 'server-only', PORTAL_ACCESS_JSON: JSON.stringify({ editor: { role: 'editor', sites: ['libelula'] }, outsider: { role: 'editor', sites: [] }, admin: { role: 'admin', sites: [] } }) };
function fakeRepo() {
  const blobs = new Map(), trees = new Map(), commits = new Map(), refs = new Map();
  const writes = []; let sequence = 0;
  const blob = content => { const id = hash(content); blobs.set(id, content); return id; };
  const initialTree = Object.fromEntries(clients[0].schema.map(s => [s.path, blob(JSON.stringify(initial[s.name], null, 2) + '\n')]));
  const treeId = hash(initialTree); trees.set(treeId, initialTree);
  const initialSha = hash('initial'); commits.set(initialSha, { sha: initialSha, tree: { sha: treeId }, parents: [] }); refs.set('main', initialSha);
  const output = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
  async function fetcher(input, init = {}) {
    const url = new URL(input); const method = init.method || 'GET'; const body = init.body ? JSON.parse(init.body) : undefined;
    if (url.hostname === 'test.supabase.co') {
      const id = init.headers.authorization?.slice(7);
      return ['editor', 'outsider', 'admin'].includes(id) ? output({ id, email: id+'@example.com', email_confirmed_at: '2026-01-01' }) : output({}, 401);
    }
    const path = decodeURIComponent(url.pathname.replace('/repos/owenbernstein915/libelula-pages-cms', ''));
    if (method !== 'GET') writes.push({ path, method, body });
    if (path.startsWith('/git/ref/heads/')) { const sha = refs.get(path.slice('/git/ref/heads/'.length)); return sha ? output({ object: { sha } }) : output({}, 404); }
    if (path.startsWith('/contents/')) { const commit = commits.get(url.searchParams.get('ref')); const id = commit && trees.get(commit.tree.sha)[path.slice('/contents/'.length)]; return id ? output({ type: 'file', encoding: 'base64', content: Buffer.from(blobs.get(id)).toString('base64'), size: Buffer.byteLength(blobs.get(id)), sha: id }) : output({}, 404); }
    if (path.startsWith('/git/commits/') && method === 'GET') return output(commits.get(path.split('/').at(-1)));
    if (path === '/git/trees') { const data = { ...trees.get(body.base_tree) }; for (const e of body.tree) data[e.path] = e.sha || blob(e.content); const sha = hash(data); trees.set(sha, data); return output({ sha }, 201); }
    if (path === '/git/commits') { const sha = hash([body, sequence++]); commits.set(sha, { sha, tree: { sha: body.tree }, parents: body.parents }); return output({ sha }, 201); }
    if (path === '/git/blobs') return output({ sha: blob(Buffer.from(body.content, 'base64')) }, 201);
    if (path === '/git/refs') { const branch = body.ref.replace('refs/heads/', ''); if (refs.has(branch)) return output({}, 422); refs.set(branch, body.sha); return output({ object: { sha: body.sha } }, 201); }
    if (path.startsWith('/git/refs/heads/')) { const branch = path.slice('/git/refs/heads/'.length); if (body.force || !commits.get(body.sha).parents.includes(refs.get(branch))) return output({}, 422); refs.set(branch, body.sha); return output({ object: { sha: body.sha } }); }
    throw new Error('Unexpected fake API route '+method+' '+path);
  }
  return { fetcher, writes, refs, initialSha };
}
function request(action, options = {}) {
  const q = new URLSearchParams({ action, site: options.site || 'libelula' });
  return new Request('https://portal.example/api/portal?'+q, { method: options.method || 'GET', headers: options.token === null ? {} : { authorization: 'Bearer '+(options.token || 'editor') }, ...(options.body ? { body: JSON.stringify(options.body) } : {}) });
}
test('existing Libélula content validates; malicious links and empty menus are rejected', () => {
  validateContent(initial, clients[0]);
  const content = structuredClone(initial); content.website.hero.buttonUrl = 'javascript:alert(1)';
  assert.throws(() => validateContent(content, clients[0]), /valid website/);
  assert.throws(() => validateContent({ ...initial, menus: [] }, clients[0]), /number of entries/);
  assert.throws(() => validateContent({ menus: initial.menus }, clients[0]), /required/);
});
test('client authorization is server-owned and denies unknown users and websites', () => {
  assert.throws(() => accessFor('unknown', env), /not been assigned/);
  assert.throws(() => clientFor('libelula', accessFor('outsider', env)), /do not have access/);
  assert.equal(clientFor('libelula', accessFor('admin', env)).id, 'libelula');
});
test('image uploads reject traversal and disguised non-image files', () => {
  assert.throws(() => validateUpload({ path: 'public/images/uploads/../../app.js', base64: 'YWJj' }, clients[0]), /filename/);
  assert.throws(() => validateUpload({ path: 'public/images/uploads/00000000-0000-0000-0000-000000000000.webp', base64: Buffer.from('<script>alert(1)</script>').toString('base64') }, clients[0]), /supported image/);
});
test('API verifies the session and isolates accounts before contacting GitHub', async () => {
  const repo = fakeRepo(); const handler = makeHandler({ env, fetcher: repo.fetcher });
  for (const [token, expected] of [[null, 401], ['forged', 401], ['outsider', 403]]) {
    const res = await handler(request('content', { token })); assert.equal(res.status, expected);
  }
  const config = await (await handler(request('config'))).json();
  assert.equal(config.configured, true); assert.equal(JSON.stringify(config).includes('server-only'), false);
  assert.equal(repo.writes.length, 0);
});
test('draft saves leave main unchanged; publish writes only content and marker without force', async () => {
  const repo = fakeRepo(); const handler = makeHandler({ env, fetcher: repo.fetcher });
  const state = await (await handler(request('content'))).json(); assert.equal(state.hasDraft, false);
  const content = structuredClone(state.content); content.website.announcement.enabled = true; content.website.announcement.text = 'Holiday hours';
  const saved = await handler(request('draft', { method: 'PUT', body: { content, uploads: [], draftSha: state.draftSha, baseMainSha: state.baseMainSha } }));
  assert.equal(saved.status, 200, await saved.clone().text()); const draft = await saved.json();
  assert.equal(repo.refs.get('main'), repo.initialSha); assert.notEqual(repo.refs.get('client-portal-draft'), repo.initialSha);
  const published = await handler(request('publish', { method: 'POST', body: { draftSha: draft.draftSha } }));
  assert.equal(published.status, 200, await published.clone().text());
  const next = await (await handler(request('content'))).json(); assert.equal(next.hasDraft, false); assert.equal(next.content.website.announcement.text, 'Holiday hours');
  const publishTree = repo.writes.filter(w => w.path === '/git/trees').at(-1);
  assert.deepEqual(publishTree.body.tree.map(e => e.path).sort(), ['.client-portal/published.json', 'src/content/menu.json', 'src/content/site.json']);
  assert.ok(repo.writes.filter(w => w.method === 'PATCH').every(w => w.body.force === false));
  const second = await handler(request('draft', { method: 'PUT', body: { content: { ...next.content, website: { ...next.content.website, announcement: { enabled: false, text: 'Later' } } }, draftSha: next.draftSha, baseMainSha: next.baseMainSha } }));
  assert.equal(second.status, 200, await second.clone().text());
});
test('stale draft revisions are rejected without writes', async () => {
  const repo = fakeRepo(); const handler = makeHandler({ env, fetcher: repo.fetcher });
  const before = await (await handler(request('content'))).json();
  const body = { content: initial, draftSha: before.draftSha, baseMainSha: before.baseMainSha };
  assert.equal((await handler(request('draft', { method: 'PUT', body }))).status, 200);
  const writeCount = repo.writes.length;
  assert.equal((await handler(request('draft', { method: 'PUT', body }))).status, 409);
  assert.equal(repo.writes.length, writeCount);
  assert.equal((await handler(request('publish', { method: 'POST', body: { draftSha: 'a'.repeat(40) } }))).status, 409);
});
