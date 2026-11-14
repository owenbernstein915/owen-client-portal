import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {makeHandler} from '../server/core.mjs';

const content={website:JSON.parse(await readFile(new URL('../content/media-remixed.json',import.meta.url)))};
const env={SUPABASE_URL:'https://test.supabase.co',SUPABASE_PUBLISHABLE_KEY:'publishable',PORTAL_ACCESS_JSON:JSON.stringify({editor:{role:'editor',sites:['media-remixed']},other:{role:'editor',sites:['little-daisy']},viewer:{role:'viewer',sites:['media-remixed']}})};
const req=(action,body,token='editor',suffix='')=>new Request('https://portal.test/api/portal?action='+action+'&site=media-remixed'+suffix,{method:body?(action==='draft'?'PUT':'POST'):'GET',headers:token?{authorization:'Bearer '+token}:{},...(body?{body:JSON.stringify(body)}:{})});
function setup(){
 const calls=[];
 let state={content:structuredClone(content),mainSha:'a'.repeat(40),draftSha:null,baseMainSha:'a'.repeat(40),hasDraft:false,stale:false,uploads:[]};
 let live=structuredClone(content);
 const handler=makeHandler({env,fetcher:async(url,init={})=>{
   calls.push({url,init});
   const parsed=new URL(url);
   if(parsed.pathname==='/auth/v1/user'){const id=init.headers.authorization.slice(7);return Response.json({id,email:id+'@example.test',email_confirmed_at:'2026-11-14'});}
   if(url.endsWith('/rpc/portal_web_state'))return Response.json(state);
   if(url.endsWith('/rpc/portal_web_save_draft')){const b=JSON.parse(init.body);state={...state,content:b.p_content,draftSha:'b'.repeat(40),hasDraft:true,savedAt:'2026-11-14',uploads:b.p_upload_paths};return Response.json(state);}
   if(url.endsWith('/rpc/portal_web_publish')){live=state.content;state={...state,hasDraft:false,mainSha:state.draftSha,baseMainSha:state.draftSha};return Response.json({mainSha:state.mainSha,message:'Your changes are live.'});}
   if(parsed.pathname==='/rest/v1/portal_web_published')return Response.json([{content:live,revision:state.mainSha,updated_at:'2026-11-14'}]);
   if(parsed.pathname==='/rest/v1/portal_web_assets')return Response.json([]);
   if(parsed.pathname==='/functions/v1/media-remixed-youtube')return Response.json({items:[],stale:false});
   throw new Error('Unexpected upstream request: '+url);
 }});
 return {handler,calls};
}
test('Media Remixed uses the verified user JWT for drafts and publishing; public reads contain only published data',async()=>{
 const {handler,calls}=setup();
 const current=await (await handler(req('content'))).json();
 const draft=structuredClone(current.content);draft.website.about.biography='Private draft';
 const saved=await handler(req('draft',{content:draft,uploads:[],draftSha:current.draftSha,baseMainSha:current.baseMainSha}));
 assert.equal(saved.status,200,await saved.clone().text());
 const publicBefore=await handler(req('public-content',null,null));
 assert.equal((await publicBefore.json()).about.biography,content.website.about.biography);
 const published=await handler(req('publish',{draftSha:(await saved.json()).draftSha}));
 assert.equal(published.status,200);
 const publicAfter=await handler(req('public-content',null,null));
 assert.equal((await publicAfter.json()).about.biography,'Private draft');
 assert.equal(publicAfter.headers.get('access-control-allow-origin'),'*');
 for(const {url,init} of calls.filter(c=>c.url.includes('/rpc/')))assert.equal(init.headers.authorization,'Bearer editor',url);
 assert.ok(calls.every(c=>!c.url.includes('github.com')));
});
test('Other clients, viewers and unauthenticated requests cannot access or save Media Remixed drafts',async()=>{
 const {handler,calls}=setup();
 for(const token of ['other','viewer',null]){
  assert.equal((await handler(req('content',null,token))).status,token?403:401);
  assert.equal((await handler(req('draft',{content},token))).status,token?403:401);
 }
 assert.ok(calls.every(c=>c.url.endsWith('/auth/v1/user')));
});
test('Unsafe links, stale saves, and arbitrary image paths are rejected without writes',async()=>{
 const {handler,calls}=setup();
 const bad=structuredClone(content);bad.website.links.substack_url='javascript:alert(1)';
 assert.equal((await handler(req('draft',{content:bad,uploads:[],draftSha:null,baseMainSha:'a'.repeat(40)}))).status,400);
 assert.equal((await handler(req('draft',{content,uploads:[],draftSha:'c'.repeat(40),baseMainSha:'a'.repeat(40)}))).status,409);
 assert.equal((await handler(req('public-image',null,null,'&path=/images/../../private'))).status,400);
 assert.ok(calls.every(c=>!c.url.endsWith('/rpc/portal_web_save_draft')));
});
test('Media Remixed status identifies the published database revision and correct website',async()=>{
 const {handler}=setup();const result=await (await handler(req('status'))).json();
 assert.equal(result.state,'ready');assert.equal(result.commit,'a'.repeat(40));assert.equal(result.url,'https://mediaremixed.com/');
});
