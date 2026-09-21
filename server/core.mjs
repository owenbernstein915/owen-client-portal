import { createHash, randomUUID } from 'node:crypto';
import { clients } from './clients.mjs';

export class PortalError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const fail = (status, message) => { throw new PortalError(status, message); };
const shaPattern = /^[a-f0-9]{40}$/;
const manifestPath = '.client-portal/draft.json';
const publishedPath = '.client-portal/published.json';
const jsonText = value => JSON.stringify(value, null, 2) + '\n';
const fingerprint = content => createHash('sha256').update(JSON.stringify(content)).digest('hex');
const encPath = value => value.split('/').map(encodeURIComponent).join('/');

export function accessFor(userId, env) {
  let entries;
  try { entries = JSON.parse(env.PORTAL_ACCESS_JSON || '{}'); }
  catch { fail(503, 'Account access needs to be configured by Owen.'); }
  const entry = Object.hasOwn(entries, userId) ? entries[userId] : null;
  if (!entry || !['admin', 'editor'].includes(entry.role) || !Array.isArray(entry.sites)) {
    fail(403, 'Your account has not been assigned a website. Please contact Owen.');
  }
  return { role: entry.role, sites: entry.role === 'admin' ? clients.map(c => c.id) : entry.sites };
}

export function clientFor(id, access) {
  const client = clients.find(c => c.id === id);
  if (!client || !access.sites.includes(id)) fail(403, 'You do not have access to this website.');
  return client;
}

export function validateContent(content, client) {
  if (!content || typeof content !== 'object' || Array.isArray(content)) fail(400, 'Invalid content.');
  const names = client.schema.map(s => s.name);
  if (Object.keys(content).some(k => !names.includes(k))) fail(400, 'Unrecognized content section.');
  const validate = (field, value, label) => {
    if (value === undefined || value === null) {
      if (field.required || field.type === 'object' || field.type === 'file' || field.list) fail(400, `${label} is required.`);
      return;
    }
    if (field.list) {
      const minimum = ['menus', 'sections'].includes(field.name) ? 1 : field.list.min || 0;
      if (!Array.isArray(value) || value.length > (field.list.max || 500) || value.length < minimum) fail(400, `Check the number of entries in ${label}.`);
      value.forEach((item, index) => validate({ ...field, list: false }, item, `${label} ${index + 1}`));
    } else if (field.type === 'object' || field.type === 'file') {
      if (typeof value !== 'object' || Array.isArray(value)) fail(400, `${label} must be an object.`);
      // Preserve existing extra data; only configured fields are shown in the editor.
      for (const child of field.fields || []) validate(child, value[child.name], `${label}: ${child.label || child.name}`);
    } else if (field.type === 'boolean') {
      if (typeof value !== 'boolean') fail(400, `${label} must be on or off.`);
    } else {
      if (typeof value !== 'string' || value.length > (field.type === 'text' ? 15000 : 3000)) fail(400, `${label} must be valid text.`);
      if (field.required && !value.trim()) fail(400, `${label} is required.`);
      if (field.type === 'image' && value) {
        const localImage = /^\/images\/[a-zA-Z0-9_./-]+$/.test(value) && !value.includes('..');
        const existingBentoImage = /^https:\/\/images\.getbento\.com\/[a-zA-Z0-9_./?=&,%+-]+$/.test(value);
        if (!localImage && !existingBentoImage) fail(400, `${label} must use a website image.`);
      }
      if ((/url$/i.test(field.name) || ['reservations', 'orderOnline', 'instagram', 'facebook'].includes(field.name)) && value) {
        if (!/^(https?:\/\/|mailto:|tel:|\/(?!\/)|#)/i.test(value) || /[\x00-\x20\\]/.test(value)) fail(400, `${label} needs a valid website, phone, email, or page link.`);
      }
    }
  };
  for (const document of client.schema) validate(document, content[document.name], document.label);
  if (Buffer.byteLength(JSON.stringify(content)) > 750000) fail(413, 'This update is too large.');
}

export function validateUpload(upload, client) {
  if (!upload || typeof upload.path !== 'string' || !upload.path.startsWith(client.uploadPrefix)) fail(400, 'Invalid image location.');
  const name = upload.path.slice(client.uploadPrefix.length);
  if (!/^[a-f0-9-]{36}\.webp$/.test(name)) fail(400, 'Invalid image filename.');
  if (typeof upload.base64 !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(upload.base64)) fail(400, 'Invalid image.');
  const bytes = Buffer.from(upload.base64, 'base64');
  if (bytes.length > 1500000 || bytes.length < 12 || bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WEBP') fail(400, 'Upload a supported image under 1.5 MB after processing.');
  return bytes;
}

async function readBody(request) {
  if (Number(request.headers.get('content-length') || 0) > 4500000) fail(413, 'Please save fewer photos at a time.');
  const reader = request.body?.getReader();
  const chunks = []; let size = 0;
  if (reader) while (true) {
    const { value, done } = await reader.read(); if (done) break;
    size += value.length;
    if (size > 4500000) { await reader.cancel(); fail(413, 'Please save fewer photos at a time.'); }
    chunks.push(Buffer.from(value));
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { fail(400, 'The update could not be read.'); }
}

export function makeHandler({ env = process.env, fetcher = fetch } = {}) {
  const respond = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });
  async function external(url, init = {}) {
    try { return await fetcher(url, { ...init, signal: AbortSignal.timeout(12000) }); }
    catch { fail(502, 'A connected service did not respond. Please try again.'); }
  }
  async function gh(client, path, method = 'GET', body) {
    if (!env.GITHUB_TOKEN) fail(503, 'The website connection needs to be configured by Owen.');
    const response = await external(`https://api.github.com/repos/${client.owner}/${client.repo}${path}`, {
      method, headers: { 'authorization': `Bearer ${env.GITHUB_TOKEN}`, 'accept': 'application/vnd.github+json', 'content-type': 'application/json', 'x-github-api-version': '2022-11-28' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (response.status === 404) throw new PortalError(404, 'The requested website file was not found.');
    if ([409, 422].includes(response.status)) fail(409, 'This website changed while you were editing. Reload before trying again; export your unsaved changes first.');
    if (!response.ok) fail(502, 'The website connection could not complete this action. Ask Owen to check repository access and branch rules.');
    return response.status === 204 ? null : response.json();
  }
  async function maybe(action) { try { return await action(); } catch (e) { if (e.status === 404) return null; throw e; } }
  const ref = (client, branch) => gh(client, `/git/ref/heads/${encPath(branch)}`);
  async function readJson(client, path, sha) {
    const file = await gh(client, `/contents/${encPath(path)}?ref=${encodeURIComponent(sha)}`);
    if (file.type !== 'file' || !file.content || file.encoding !== 'base64' || file.size > 1000000) fail(422, 'A website content file has an unsupported format.');
    try { return JSON.parse(Buffer.from(file.content, 'base64').toString('utf8')); }
    catch { fail(422, 'A website content file is not valid JSON.'); }
  }
  async function readContent(client, sha) {
    const docs = await Promise.all(client.schema.map(async s => [s.name, await readJson(client, s.path, sha)]));
    return Object.fromEntries(docs);
  }
  async function state(client) {
    const [mainRef, draftRef] = await Promise.all([ref(client, client.branch), maybe(() => ref(client, client.draftBranch))]);
    const mainSha = mainRef.object.sha; const draftSha = draftRef?.object.sha || null;
    const [live, published, manifest] = await Promise.all([
      readContent(client, mainSha), maybe(() => readJson(client, publishedPath, mainSha)),
      draftSha ? maybe(() => readJson(client, manifestPath, draftSha)) : null,
    ]);
    const hasDraft = !!manifest && manifest.fingerprint !== published?.fingerprint;
    return {
      content: hasDraft ? await readContent(client, draftSha) : live,
      mainSha, draftSha, hasDraft,
      baseMainSha: hasDraft ? manifest.baseMainSha : mainSha,
      savedAt: hasDraft ? manifest.savedAt : null,
      stale: hasDraft && manifest.baseMainSha !== mainSha,
      uploads: hasDraft ? manifest.uploads || [] : [],
    };
  }
  async function commit(client, baseTreeSha, parentSha, entries, message, branch, create = false) {
    const tree = await gh(client, '/git/trees', 'POST', { base_tree: baseTreeSha, tree: entries });
    const newCommit = await gh(client, '/git/commits', 'POST', { message, tree: tree.sha, parents: [parentSha] });
    if (create) await gh(client, '/git/refs', 'POST', { ref: `refs/heads/${branch}`, sha: newCommit.sha });
    else await gh(client, `/git/refs/heads/${encPath(branch)}`, 'PATCH', { sha: newCommit.sha, force: false });
    return newCommit.sha;
  }
  const docEntries = (client, content) => client.schema.map(s => ({ path: s.path, mode: '100644', type: 'blob', content: jsonText(content[s.name]) }));
  async function saveDraft(client, body) {
    validateContent(body.content, client);
    const current = await state(client);
    if (body.draftSha !== current.draftSha || body.baseMainSha !== current.baseMainSha || current.stale) fail(409, 'The saved draft or live website has changed. Export your changes, then reload and review them with Owen.');
    const uploads = body.uploads || [];
    if (!Array.isArray(uploads) || uploads.length > 8) fail(400, 'Save up to eight photos at a time.');
    uploads.forEach(u => validateUpload(u, client));
    const baseSha = current.hasDraft ? current.draftSha : current.mainSha;
    const baseCommit = await gh(client, `/git/commits/${baseSha}`);
    const entries = docEntries(client, body.content);
    const uploadPaths = [...current.uploads];
    for (const upload of uploads) {
      const blob = await gh(client, '/git/blobs', 'POST', { content: upload.base64, encoding: 'base64' });
      entries.push({ path: upload.path, mode: '100644', type: 'blob', sha: blob.sha });
      if (!uploadPaths.includes(upload.path)) uploadPaths.push(upload.path);
    }
    entries.push({ path: manifestPath, mode: '100644', type: 'blob', content: jsonText({ version: 1, baseMainSha: current.baseMainSha, fingerprint: fingerprint(body.content), savedAt: new Date().toISOString(), uploads: uploadPaths }) });
    const draftSha = await commit(client, baseCommit.tree.sha, current.draftSha || current.mainSha, entries, 'Save website draft', client.draftBranch, !current.draftSha);
    return { draftSha, baseMainSha: current.baseMainSha, savedAt: new Date().toISOString(), hasDraft: true };
  }
  async function publish(client, body) {
    const current = await state(client);
    if (!current.hasDraft) fail(400, 'Save a draft before publishing.');
    if (body.draftSha !== current.draftSha || current.stale) fail(409, 'The draft or live website changed. Reload and review the latest version before publishing.');
    validateContent(current.content, client);
    const mainCommit = await gh(client, `/git/commits/${current.mainSha}`);
    const entries = docEntries(client, current.content);
    for (const path of current.uploads) {
      if (!path.startsWith(client.uploadPrefix) || path.includes('..')) fail(400, 'Invalid draft image path.');
      const file = await gh(client, `/contents/${encPath(path)}?ref=${current.draftSha}`);
      entries.push({ path, mode: '100644', type: 'blob', sha: file.sha });
    }
    entries.push({ path: publishedPath, mode: '100644', type: 'blob', content: jsonText({ fingerprint: fingerprint(current.content), publishedAt: new Date().toISOString() }) });
    const mainSha = await commit(client, mainCommit.tree.sha, current.mainSha, entries, 'Publish website content from client portal', client.branch);
    return { mainSha, message: 'Changes sent for publishing. The website updates when its build finishes.' };
  }
  async function netlify(client, mode) {
    const siteId = env[client.netlifySiteIdEnv];
    if (!siteId || !env.NETLIFY_API_TOKEN) return { configured: false, url: mode === 'draft' ? client.draftUrl : client.liveUrl };
    const headers = { authorization: `Bearer ${env.NETLIFY_API_TOKEN}` };
    const response = await external(`https://api.netlify.com/api/v1/sites/${encodeURIComponent(siteId)}/deploys?per_page=30`, { headers });
    if (!response.ok) return { configured: true, state: 'unknown', message: 'Deployment status is unavailable. Check Netlify.' };
    const deploys = await response.json();
    const desiredBranch = mode === 'draft' ? client.draftBranch : client.branch;
    const deploy = deploys.find(d => d.branch === desiredBranch && (mode === 'draft' ? d.context === 'branch-deploy' : d.context === 'production'));
    if (!deploy) return { configured: true, state: 'waiting', url: mode === 'draft' ? client.draftUrl : client.liveUrl };
    return { configured: true, state: deploy.state, commit: deploy.commit_ref, url: mode === 'draft' ? (deploy.deploy_ssl_url || deploy.deploy_url) : (deploy.ssl_url || deploy.url), updatedAt: deploy.updated_at };
  }

  return async function handler(request) {
    try {
      const url = new URL(request.url); const action = url.searchParams.get('action') || 'config';
      const methods = { config: 'GET', sites: 'GET', content: 'GET', draft: 'PUT', publish: 'POST', status: 'GET', image: 'GET', history: 'GET', version: 'GET' };
      if (!methods[action]) fail(404, 'Unknown action.');
      if (request.method !== methods[action]) fail(405, 'Method not allowed.');
      if (action === 'config') return respond({ configured: !!(env.SUPABASE_URL && env.SUPABASE_PUBLISHABLE_KEY && env.GITHUB_TOKEN && env.PORTAL_ACCESS_JSON), supabaseUrl: env.SUPABASE_URL || '', supabaseKey: env.SUPABASE_PUBLISHABLE_KEY || '' });
      const auth = request.headers.get('authorization') || '';
      if (!/^Bearer [A-Za-z0-9._-]+$/.test(auth)) fail(401, 'Please sign in to continue.');
      if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) fail(503, 'Login is not configured yet.');
      const userResponse = await external(`${env.SUPABASE_URL.replace(/\/$/, '')}/auth/v1/user`, { headers: { authorization: auth, apikey: env.SUPABASE_PUBLISHABLE_KEY } });
      if (!userResponse.ok) fail(401, 'Your session expired. Please sign in again.');
      const user = await userResponse.json();
      if (!user.id || !user.email_confirmed_at) fail(403, 'Please verify your email address before editing.');
      const access = accessFor(user.id, env);
      if (action === 'sites') return respond({ role: access.role, email: user.email, sites: clients.filter(c => access.sites.includes(c.id)).map(c => ({ id: c.id, name: c.name, location: c.location })) });
      const client = clientFor(url.searchParams.get('site'), access);
      if (action === 'content') return respond({ ...await state(client), schema: client.schema });
      if (action === 'draft') return respond(await saveDraft(client, await readBody(request)));
      if (action === 'publish') return respond(await publish(client, await readBody(request)));
      if (action === 'status') return respond(await netlify(client, url.searchParams.get('mode')));
      if (action === 'history') {
        const commits = await gh(client, `/commits?sha=${encodeURIComponent(client.branch)}&path=${encodeURIComponent(publishedPath)}&per_page=12`);
        return respond({ versions: commits.map(c => ({ sha: c.sha, date: c.commit.committer.date, message: c.commit.message.split('\n')[0] })) });
      }
      if (action === 'version') {
        const sha = url.searchParams.get('sha'); if (!shaPattern.test(sha || '')) fail(400, 'Invalid version.');
        return respond({ content: await readContent(client, sha) });
      }
      if (action === 'image') {
        const path = url.searchParams.get('path') || ''; const sha = url.searchParams.get('sha');
        if (!/^\/images\/[a-zA-Z0-9_./-]+\.(png|jpe?g|webp|avif)$/i.test(path) || path.includes('..') || !shaPattern.test(sha || '')) fail(400, 'Invalid image.');
        const response = await external(`https://api.github.com/repos/${client.owner}/${client.repo}/contents/public${encPath(path)}?ref=${sha}`, { headers: { authorization: `Bearer ${env.GITHUB_TOKEN}`, accept: 'application/vnd.github.raw+json', 'x-github-api-version': '2022-11-28' } });
        if (!response.ok) fail(404, 'Image unavailable.');
        const bytes = await response.arrayBuffer(); if (bytes.byteLength > 12000000) fail(413, 'Image too large to preview.');
        const ext = path.split('.').pop().toLowerCase();
        return new Response(bytes, { headers: { 'content-type': `image/${['jpg', 'jpeg'].includes(ext) ? 'jpeg' : ext}`, 'cache-control': 'private, max-age=300', 'x-content-type-options': 'nosniff' } });
      }
    } catch (error) {
      return respond({ error: error instanceof PortalError ? error.message : 'Something went wrong. Please try again.' }, error instanceof PortalError ? error.status : 500);
    }
  };
}
