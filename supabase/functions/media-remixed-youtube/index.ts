import { CHANNEL_ID, FEED_URL, parseFeed, mergeArchive } from './feed.mjs';

const url = Deno.env.get('SUPABASE_URL')!;
const secrets = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}');
const secret = secrets.default || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const publicKeys = Object.values(JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') || '{}'));
const legacyPublic = Deno.env.get('SUPABASE_ANON_KEY');
if (legacyPublic) publicKeys.push(legacyPublic);
const headers = {apikey:secret,...(secret.startsWith('eyJ') ? {Authorization:`Bearer ${secret}`} : {}),'Content-Type':'application/json'};
const endpoint = `${url}/rest/v1/portal_youtube_cache`;
async function db(path:string, options:RequestInit={}) {
  const response=await fetch(endpoint+path,{...options,headers:{...headers,...options.headers},signal:AbortSignal.timeout(6000)});
  if(!response.ok) throw new Error('Cache unavailable');
  const text=await response.text();
  return text ? JSON.parse(text) : null;
}
Deno.serve(async (req:Request) => {
  if(req.method!=='GET') return new Response(null,{status:405});
  // Public API key grants access to this fixed public feed, never arbitrary URLs or content writes.
  if(!publicKeys.includes(req.headers.get('apikey'))) return new Response(null,{status:401});
  let saved:any;
  const respond=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'public, max-age=300','X-Content-Type-Options':'nosniff'}});
  try {
    saved=(await db('?site_id=eq.media-remixed&select=videos,fetched_at'))[0];
    if(saved && Date.now()-Date.parse(saved.fetched_at)<300000) return respond({channelId:CHANNEL_ID,items:saved.videos,checkedAt:saved.fetched_at,stale:false});
    const response=await fetch(FEED_URL,{signal:AbortSignal.timeout(8000),redirect:'error'});
    if(!response.ok) throw new Error('YouTube unavailable');
    const reader=response.body!.getReader(); let size=0; const chunks:Uint8Array[]=[];
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>600000){await reader.cancel();throw new Error('Feed too large');}chunks.push(value);}
    const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
    const videos=mergeArchive(saved?.videos||[],parseFeed(new TextDecoder().decode(bytes))),checkedAt=new Date().toISOString();
    await db('?on_conflict=site_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({site_id:'media-remixed',videos,fetched_at:checkedAt})});
    return respond({channelId:CHANNEL_ID,items:videos,checkedAt,stale:false});
  } catch(error) {
    console.warn('YouTube synchronization failed',error instanceof Error ? error.message : 'Unknown failure');
    if(saved) return respond({channelId:CHANNEL_ID,items:saved.videos,checkedAt:saved.fetched_at,stale:true});
    return respond({error:'YouTube is temporarily unavailable. Saved website episodes are still available.'},503);
  }
});
