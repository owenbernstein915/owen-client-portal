export function makeDatabaseContentHandler({ env, external, respond, fail, validateContent, validateUpload, mergeContent }) {
  const imagePattern = /^\/images\/uploads\/[a-f0-9-]{36}\.webp$/;
  const revisionPattern = /^[a-f0-9]{40}$/;
  async function db(path, auth, method = 'GET', body) {
    const response = await external(env.SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/' + path, {
      method, headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, ...(auth ? { authorization: auth } : {}), 'content-type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      if (response.status === 409 || error.code === '40001') fail(409, 'The draft or live website changed. Reload and review the latest content before trying again.');
      if ([401,403].includes(response.status) || error.code === '42501') fail(403, 'Your account does not have editing access to this website.');
      if (error.code === '22023') fail(400, 'Check your content and photos, then try again.');
      fail(502, 'Website content could not be loaded or saved. Please try again.');
    }
    return response.json();
  }
  const state = (client, auth) => db('rpc/portal_web_state', auth, 'POST', {p_site:client.id});
  const published = async (client, auth) => (await db('portal_web_published?site_id=eq.' + client.id + '&select=content,revision,updated_at', auth))[0];
  const version = async (client, auth, revision) => {
    if (!revisionPattern.test(revision || '')) fail(400, 'Invalid version.');
    const rows = await db('portal_web_history?site_id=eq.' + client.id + '&revision=eq.' + revision + '&select=content',auth);
    if (!rows.length) fail(404, 'This saved version was not found.');
    return rows[0].content;
  };
  function uploadPaths(value, paths = new Set()) {
    if (typeof value === 'string' && imagePattern.test(value)) paths.add('public' + value);
    else if (Array.isArray(value)) value.forEach(item => uploadPaths(item, paths));
    else if (value && typeof value === 'object') Object.values(value).forEach(item => uploadPaths(item, paths));
    return [...paths];
  }
  return async ({action,client,auth,url,body}) => {
    if (action === 'public-content') {
      const row = await published(client, '');
      if (!row) fail(404,'Website content not found.');
      return new Response(JSON.stringify(row.content.website),{headers:{'content-type':'application/json','cache-control':'no-store','access-control-allow-origin':'*','x-content-type-options':'nosniff'}});
    }
    if (action === 'public-image' || action === 'image' && imagePattern.test(url.searchParams.get('path') || '')) {
      const path = url.searchParams.get('path') || '';
      if (!imagePattern.test(path)) fail(400,'Invalid photo.');
      const rows = await db('portal_web_assets?site_id=eq.' + client.id + '&path=eq.' + encodeURIComponent('public' + path) + '&select=body_base64',action === 'public-image' ? '' : auth);
      if (!rows.length) fail(404,'Photo unavailable.');
      return new Response(Buffer.from(rows[0].body_base64,'base64'),{headers:{'content-type':'image/webp','cache-control':action === 'public-image' ? 'public, max-age=31536000, immutable' : 'private, max-age=300','x-content-type-options':'nosniff'}});
    }
    if(action==='image') {
      if(url.searchParams.get('path')!=='/images/media-remixed/jamie-stenziano.jpg') fail(400,'Invalid photo.');
      const response=await external('https://owenbclientdashboard.netlify.app/images/media-remixed/jamie-stenziano.jpg');
      if(!response.ok) fail(404,'Photo unavailable.');
      return new Response(await response.arrayBuffer(),{headers:{'content-type':'image/jpeg','cache-control':'private, max-age=300','x-content-type-options':'nosniff'}});
    }
    if (action === 'content') return respond({...await state(client,auth),schema:client.schema});
    if (action === 'draft') {
      validateContent(body.content,client);
      const current = await state(client,auth);
      if (body.draftSha !== current.draftSha || body.baseMainSha !== current.baseMainSha) fail(409,'The saved draft changed. Reload before saving again.');
      const uploads=body.uploads||[];
      if (!Array.isArray(uploads) || uploads.length>8) fail(400,'Save up to eight photos at a time.');
      uploads.forEach(upload=>validateUpload(upload,client));
      let content=body.content;
      if(current.stale){
        const [base,live]=await Promise.all([version(client,auth,current.baseMainSha),published(client,auth)]);
        const merged=mergeContent(base,content,live.content);
        if(merged.conflicts.length) fail(409,'The same fields changed in the saved draft and live site. Export your draft and reload before continuing.');
        content=merged.content; validateContent(content,client);
      }
      const result=await db('rpc/portal_web_save_draft',auth,'POST',{p_site:client.id,p_content:content,p_draft_revision:current.draftSha,p_base_revision:current.mainSha,p_assets:uploads,p_upload_paths:uploadPaths(content)});
      return respond({...result,merged:current.stale});
    }
    if (action === 'publish') {
      const current=await state(client,auth);
      if(!current.hasDraft) fail(400,'Save a draft before publishing.');
      if(body.draftSha!==current.draftSha || current.stale) fail(409,'The draft or live website changed. Reload before publishing.');
      validateContent(current.content,client);
      return respond(await db('rpc/portal_web_publish',auth,'POST',{p_site:client.id,p_draft_revision:body.draftSha}));
    }
    if (action === 'status') { const row=await published(client,auth); return respond({configured:true,state:'ready',commit:row.revision,url:client.liveUrl,updatedAt:row.updated_at}); }
    if (action === 'history') { const rows=await db('portal_web_history?site_id=eq.'+client.id+'&select=revision,published_at&order=published_at.desc&limit=12',auth); return respond({versions:rows.map(row=>({sha:row.revision,date:row.published_at,message:'Published website content'}))}); }
    if (action === 'version') return respond({content:await version(client,auth,url.searchParams.get('sha'))});
    return null;
  };
}
