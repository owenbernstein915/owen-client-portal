import test from 'node:test';
import assert from 'node:assert/strict';
import { makeHandler } from '../server/core.mjs';
import { pageViewFilters } from '../server/netlify-analytics.mjs';
import { analyticsRanges } from '../public/analytics-ranges.mjs';

const now = Date.parse('2026-11-14T21:34:30Z');
const end = Math.floor(now / 60000) * 60000;
const env = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'publishable', NETLIFY_API_TOKEN: 'server-only-secret', MEDIA_REMIXED_NETLIFY_SITE_ID: 'media-netlify-id', LITTLE_DAISY_NETLIFY_SITE_ID: 'daisy-netlify-id', PORTAL_ACCESS_JSON: JSON.stringify({ jamie: { role: 'viewer', sites: ['media-remixed'] }, jennifer: { role: 'editor', sites: ['little-daisy'] } }) };
const request = (site = 'media-remixed', token = 'jamie', suffix = '', action = 'analytics', method = 'GET') => new Request(`https://portal.test/api/portal?action=${action}&site=${site}${suffix}`, { method, headers: token ? { Authorization: `Bearer ${token}` } : {} });
const events = [[0,19],[10,2],[60,3],[61,5],[1440,7],[1441,11],[10080,13],[10081,17]].map(([ago,count]) => ({time:end-ago*60000,count}));

function setup({ status = 200, malformed = false, limited = false, retention = false, clock = () => now, historyStatus = 200, analyticsToken } = {}) {
  const calls = [];
  const handler = makeHandler({ env: {...env, ...(analyticsToken ? {NETLIFY_ANALYTICS_TOKEN:analyticsToken} : {})}, now: clock, fetcher: async (url, init) => {
    calls.push({ url, ...init });
    if (url.endsWith('/auth/v1/user')) { const id = init.headers.authorization.split(' ')[1]; return Response.json({ id, email: `${id}@example.com`, email_confirmed_at: '2026-11-14' }); }
    if (url.includes('/rest/v1/portal_analytics_imports?')) return Response.json([{source:'netlify',data:{pageViews:300}}], {status:historyStatus});
    if (!url.startsWith('https://api.netlify.com/api/v1/sites/')) throw new Error('Unexpected upstream request');
    if (status !== 200) return Response.json({error:'upstream unavailable'}, {status});
    const u = new URL(url), from = Number(u.searchParams.get('from_ts')), to = Number(u.searchParams.get('to_ts'));
    const type = u.pathname.split('/').at(-1);
    const selected = events.filter(row => row.time >= from && row.time <= to);
    const total = selected.reduce((n,row)=>n+row.count,0);
    const queries = JSON.parse(init.body).data[0].attributes.queries;
    const data = queries.map(query => {
      let attributes;
      if (type === 'counts') attributes = {items:[{key:query.name==='methods'?'GET':'200',count:query.name==='methods'?total+10:total}]};
      else if (type === 'timeseries') {
        const times=Array.from({length:Math.ceil((to-from+1)/60000)},(_,i)=>from+i*60000);
        attributes={series:[{group_tags:[]}],times,values:[times.map(t=>(selected.find(row=>row.time===t)?.count||0)*(query.name==='edge_requests_bandwidth'?1000:1))]};
        if (malformed) attributes.values[0][0] = 'unknown';
      } else attributes={items:[{key:query.name==='urls'?'https://mediaremixed.com/':query.name==='referrers'?'example.com':'US',count:total}]};
      return {type:`${query.name}_response`,attributes};
    });
    const clamped = retention && (from===end-10080*60000 || (retention==='advancing' && from===end-10079*60000));
    return Response.json({data,meta:{responses:queries.map(()=>({from:clamped?from+5000:from,to,limited,...(type==='timeseries'?{interval:60000}:{})}))}});
  } });
  return { handler, calls };
}

test('analytics authorizes the user and site before any Netlify query; secrets stay server-side', async () => {
  const {handler,calls}=setup();
  assert.equal((await handler(request('media-remixed',null))).status,401);
  assert.equal((await handler(request('little-daisy'))).status,403);
  assert.equal((await handler(request('media-remixed','jennifer'))).status,403);
  assert.equal(calls.filter(c=>c.url.includes('api.netlify')).length,0);
  const response=await handler(request()); assert.equal(response.status,200);
  const data=await response.json(); assert.equal(data.siteId,'media-remixed'); assert.equal(data.source,'netlify');
  assert.ok(!JSON.stringify(data).includes(env.NETLIFY_API_TOKEN));
  const netlify=calls.filter(c=>c.url.includes('api.netlify'));
  assert.equal(netlify.length,7);
  assert.ok(netlify.every(c=>c.url.includes('/sites/media-netlify-id/') && c.headers.authorization==='Bearer server-only-secret'));
  const imported=calls.at(-1); assert.equal(imported.headers.authorization,'Bearer jamie'); assert.ok(imported.url.includes('site_id=eq.media-remixed'));
  assert.ok(!calls.some(c=>c.url.includes('rpc/portal_analytics')));
});

test('all three rolling ranges fetch different exact windows and Netlify totals; end minute is excluded', async () => {
  assert.deepEqual(Object.values(analyticsRanges).map(r=>r.label),['Last Hour','Last 24 Hours','Last 7 Days']);
  for (const [range,minutes,expected] of [['1h',60,5],['24h',1440,17],['7d',10080,41]]) {
    const {handler,calls}=setup(); const response=await handler(request('media-remixed','jamie',`&range=${range}`));
    assert.equal(response.status,200); const data=await response.json();
    assert.equal(Date.parse(data.to)-Date.parse(data.from),minutes*60000);
    assert.equal(data.pageViews,expected); assert.equal(data.requests,expected+10); assert.equal(data.bandwidthBytes,expected*1000);
    assert.equal(data.buckets.reduce((n,b)=>n+b.views,0),expected); assert.equal(data.chartPending,false);
    for(const key of ['pages','sources','locations']) assert.equal(data[key][0].views,expected);
    for(const call of calls.filter(c=>c.url.includes('api.netlify'))) {
      const url=new URL(call.url); assert.equal(Number(url.searchParams.get('from_ts')),end-minutes*60000); assert.equal(Number(url.searchParams.get('to_ts')),end-1);
      const queries=JSON.parse(call.body).data[0].attributes.queries;
      for(const q of queries.filter(q=>!['methods','edge_requests_bandwidth'].includes(q.name))) assert.deepEqual(q.filters,pageViewFilters);
    }
  }
});

test('refresh advances the real source window and obtains fresh Netlify numbers instead of a cached report',async()=>{
  let clock=now; const {handler,calls}=setup({clock:()=>clock});
  const first=await (await handler(request('media-remixed','jamie','&range=1h'))).json();
  clock+=120000;
  const second=await (await handler(request('media-remixed','jamie','&range=1h'))).json();
  assert.equal(Date.parse(second.from)-Date.parse(first.from),120000);
  assert.equal(first.pageViews,5); assert.equal(second.pageViews,21);
  assert.equal(calls.filter(c=>c.url.includes('api.netlify')).length,14);
});

test('retention clamping re-queries every metric for one consistent available window',async()=>{
  const {handler,calls}=setup({retention:true});
  const response=await handler(request('media-remixed','jamie','&range=7d')); assert.equal(response.status,200);
  const data=await response.json(); assert.equal(data.coverageLimited,true);
  assert.equal(Date.parse(data.from),end-10079*60000); assert.equal(data.pageViews,28);
  assert.equal(calls.filter(c=>c.url.includes('api.netlify')).length,14);
});

test('seven-day retention can advance across another minute while source queries complete',async()=>{
  const {handler,calls}=setup({retention:'advancing'});
  const response=await handler(request('media-remixed','jamie','&range=7d')); assert.equal(response.status,200);
  const data=await response.json(); assert.equal(data.coverageLimited,true);
  assert.equal(Date.parse(data.from),end-10078*60000);
  assert.equal(data.pageViews,data.buckets.reduce((total,row)=>total+row.views,0));
  const sourceCalls=calls.filter(c=>c.url.includes('api.netlify'));
  assert.equal(sourceCalls.length,21);
  assert.ok(sourceCalls.slice(-7).every(c=>Number(new URL(c.url).searchParams.get('from_ts'))===Date.parse(data.from)));
});

test('invalid ranges, upstream failures and incomplete source data never turn into misleading zero traffic',async()=>{
  const {handler,calls}=setup();
  for(const suffix of ['&range=30d','&range=7','&range=__proto__','&days=30']) assert.equal((await handler(request('media-remixed','jamie',suffix))).status,400);
  assert.equal(calls.filter(c=>c.url.includes('api.netlify')).length,0);
  for(const options of [{status:403},{status:500},{malformed:true},{limited:true}]) {
    const result=await setup(options).handler(request()); assert.equal(result.status,503); const body=await result.json(); assert.ok(body.error); assert.equal(body.pageViews,undefined); assert.equal(body.historical.data.pageViews,300);
  }
  const result=await setup({historyStatus:500}).handler(request()); assert.equal(result.status,200); const data=await result.json(); assert.equal(data.pageViews,17); assert.ok(data.historyError);
});

test('Media Remixed viewer sees only its assigned analytics and cannot edit or publish',async()=>{
  const {handler,calls}=setup();
  const sites=await (await handler(request('media-remixed','jamie','','sites'))).json();
  assert.deepEqual(sites.sites.map(s=>[s.id,s.editable]),[['media-remixed',false]]);
  for(const [action,method] of [['content','GET'],['history','GET'],['draft','PUT'],['publish','POST']]) assert.equal((await handler(request('media-remixed','jamie','',action,method))).status,403);
  assert.ok(calls.every(c=>c.url.endsWith('/auth/v1/user')));
});


test('a dedicated analytics token is used only on the server and does not replace the deployment credential',async()=>{
  const {handler,calls}=setup({analyticsToken:'dedicated-analytics-secret'});
  const response=await handler(request()); assert.equal(response.status,200);
  assert.ok(!JSON.stringify(await response.json()).includes('dedicated-analytics-secret'));
  assert.ok(calls.filter(c=>c.url.includes('api.netlify')).every(c=>c.headers.authorization==='Bearer dedicated-analytics-secret'));
  assert.equal(env.NETLIFY_API_TOKEN,'server-only-secret');
});
