import test from 'node:test';
import assert from 'node:assert/strict';
import { makeHandler } from '../server/core.mjs';

const env = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'publishable', PORTAL_ACCESS_JSON: JSON.stringify({ jamie: { role: 'viewer', sites: ['media-remixed'] }, jennifer: { role: 'editor', sites: ['little-daisy'] } }) };
const request = (site = 'media-remixed', token = 'jamie', suffix = '', action = 'analytics', method = 'GET') => new Request(`https://portal.test/api/portal?action=${action}&site=${site}${suffix}`, { method, headers: token ? { Authorization: `Bearer ${token}` } : {} });
function setup(rpcStatus = 200) {
  const calls = [];
  const handler = makeHandler({ env, fetcher: async (url, init) => {
    calls.push({ url, ...init });
    if (url.endsWith('/auth/v1/user')) { const id = init.headers.authorization.split(' ')[1]; return Response.json({ id, email: `${id}@example.com`, email_confirmed_at: '2026-11-14' }); }
    if (url.endsWith('/rest/v1/rpc/portal_analytics')) return Response.json({ siteId: JSON.parse(init.body).p_site, pageViews: 12 }, { status: rpcStatus });
    throw new Error('Unexpected upstream request');
  } });
  return { handler, calls };
}
test('analytics enforces user/site ownership before querying data and forwards the user JWT, not a privileged key', async () => {
  const { handler, calls } = setup();
  assert.equal((await handler(request('media-remixed', null))).status, 401);
  assert.equal((await handler(request('little-daisy'))).status, 403);
  assert.equal((await handler(request('media-remixed','jennifer'))).status, 403);
  assert.equal(calls.filter(c=>c.url.includes('/rpc/')).length, 0);
  const response = await handler(request()); assert.equal(response.status,200); assert.equal((await response.json()).siteId,'media-remixed');
  const rpc = calls.at(-1); assert.equal(rpc.headers.authorization,'Bearer jamie'); assert.deepEqual(JSON.parse(rpc.body),{p_site:'media-remixed',p_days:30});
});
test('analytics range validation and upstream failures do not produce misleading zero traffic',async()=>{
  const {handler,calls}=setup(500);
  for(const value of ['-1','0','365','NaN','7.5']) assert.equal((await handler(request('media-remixed','jamie',`&days=${value}`))).status,400);
  assert.equal(calls.filter(c=>c.url.includes('/rpc/')).length,0);
  const response=await handler(request()); assert.equal(response.status,503); assert.ok((await response.json()).error);
});
test('Media Remixed viewer sees only its analytics client and cannot edit or publish',async()=>{
  const {handler,calls}=setup();
  const sites=await (await handler(request('media-remixed','jamie','','sites'))).json();
  assert.deepEqual(sites.sites.map(s=>[s.id,s.editable]),[['media-remixed',false]]);
  for(const [action,method] of [['content','GET'],['history','GET'],['draft','PUT'],['publish','POST']]) assert.equal((await handler(request('media-remixed','jamie','',action,method))).status,403);
  assert.ok(calls.every(c=>c.url.endsWith('/auth/v1/user')));
});
