const app = document.querySelector('#app');
const notice = document.querySelector('#notice');
const S = { config: null, session: null, sites: [], client: null, data: null, content: null, section: 'hero', document: 'website', dirty: false, busy: false, uploads: [], previews: new Map(), loadedImages: new Map(), status: null, pendingCommit: null, recovery: false };
let notificationTimer, refreshPromise;
const icons = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  menu: '<path d="M4 5h16M4 12h16M4 19h16"/>',
  arrow: '<path d="M7 17 17 7M7 7h10v10"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
};
function icon(name) { const span = document.createElement('span'); span.className = 'icon'; span.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">${icons[name] || icons.grid}</svg>`; return span; }
function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key.startsWith('on')) node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (value !== undefined && value !== null && value !== false) node.setAttribute(key, value === true ? '' : value);
  }
  children.flat().filter(c => c !== null && c !== undefined && c !== false).forEach(c => node.append(c instanceof Node ? c : document.createTextNode(String(c))));
  return node;
}
const button = (text, onClick, cls = 'button', attrs = {}) => el('button', { type: 'button', class: cls, onClick, ...attrs }, text);
function toast(message, error = false) {
  clearTimeout(notificationTimer); notice.replaceChildren(el('div', { class: error ? 'toast error' : 'toast' }, message));
  notificationTimer = setTimeout(() => notice.replaceChildren(), error ? 12000 : 6500);
}
function setSession(data) {
  S.session = data ? { ...data, expires_at: data.expires_at || Math.floor(Date.now() / 1000) + (data.expires_in || 3600) } : null;
  if (S.session) sessionStorage.setItem('owen-portal-session', JSON.stringify(S.session));
  else sessionStorage.removeItem('owen-portal-session');
}
async function auth(path, body, method = 'POST', bearer) {
  const res = await fetch(`${S.config.supabaseUrl}/auth/v1/${path}`, { method, headers: { apikey: S.config.supabaseKey, 'content-type': 'application/json', ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.msg || data.error_description || data.message || 'Sign-in could not be completed.');
  return data;
}
async function accessToken() {
  if (!S.session) throw new Error('Please sign in.');
  if (S.session.expires_at < Date.now() / 1000 + 90) {
    if (!refreshPromise) refreshPromise = auth('token?grant_type=refresh_token', { refresh_token: S.session.refresh_token }).then(setSession).finally(() => { refreshPromise = null; });
    await refreshPromise;
  }
  return S.session.access_token;
}
async function api(action, options = {}) {
  const q = new URLSearchParams({ action, ...(S.client ? { site: S.client.id } : {}), ...options.query });
  const res = await fetch(`/api/portal?${q}`, { method: options.method || 'GET', headers: { Authorization: `Bearer ${await accessToken()}`, ...(options.body ? { 'content-type': 'application/json' } : {}) }, ...(options.body ? { body: JSON.stringify(options.body) } : {}) });
  if (res.status === 401) throw new Error('Your session has expired. Export unsaved changes, then sign out and back in.');
  if (!res.ok) { const data = await res.json().catch(() => ({})); throw new Error(data.error || 'This action could not be completed.'); }
  return options.blob ? res.blob() : res.json();
}
function branding() { return el('div', { class: 'brand' }, el('div', { class: 'brand-mark' }, el('img', { src: '/ob-logo-mark.png', alt: 'Owen B monogram' })), el('div', {}, el('strong', {}, 'Owen B'), el('small', {}, 'WEB DESIGN'))); }
async function requestSignup(email) {
  const response = await fetch('/api/portal?action=signup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email }) });
  if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error || 'Account setup is temporarily unavailable.'); }
}
function login(mode = 'signin', submittedEmail = '') {
  app.replaceChildren();
  const recover = mode === 'password'; const signup = mode === 'signup'; const sent = mode === 'sent';
  const email = el('input', { type: 'email', autocomplete: 'email', placeholder: 'you@yourbusiness.com', required: true, value: submittedEmail });
  const password = el('input', { type: 'password', autocomplete: recover ? 'new-password' : 'current-password', minlength: recover ? '12' : '1', required: true });
  const confirmPassword = el('input', { type: 'password', autocomplete: 'new-password', minlength: '12', required: true });
  const error = el('p', { class: 'form-error', role: 'alert' });
  const submit = el('button', { class: 'button primary wide', type: 'submit' }, recover ? 'Set password' : signup ? 'Send my setup link' : 'Sign in');
  const form = el('form', { onSubmit: async event => {
    event.preventDefault(); submit.disabled = true; error.textContent = '';
    try {
      if (signup) { await requestSignup(email.value.trim()); login('sent', email.value.trim()); return; }
      if (recover) {
        if (password.value !== confirmPassword.value) { error.textContent = 'The passwords do not match.'; return; }
        const token = await accessToken();
        const user = await auth('user', null, 'GET', token);
        await auth('user', { password: password.value }, 'PUT', token);
        try { setSession(await auth('token?grant_type=password', { email: user.email, password: password.value })); }
        catch { setSession(null); S.recovery = false; login(); toast('Password saved. Please sign in with your new password.'); return; }
        S.recovery = false;
      } else setSession(await auth('token?grant_type=password', { email: email.value.trim(), password: password.value }));
      await openWorkspace();
    } catch (e) { error.textContent = e.message; }
    finally { submit.disabled = false; }
  } },
  !recover && el('label', { class: 'field' }, 'Email address', email),
  !signup && el('label', { class: 'field' }, recover ? 'New password (at least 12 characters)' : 'Password', password),
  recover && el('label', { class: 'field' }, 'Confirm new password', confirmPassword), error, submit);
  const forgot = button('Forgot your password?', async () => {
    if (!email.reportValidity()) return;
    try { await auth(`recover?redirect_to=${encodeURIComponent(location.origin + '/')}`, { email: email.value.trim() }); toast('If your account exists, a password reset email is on its way.'); }
    catch (e) { toast(e.message, true); }
  }, 'text-button');
  const registration = button('Create your account', () => login('signup'), 'text-button');
  const signIn = button('Back to sign in', () => login(), 'text-button');
  const resend = button('Send another link', async () => {
    resend.disabled = true;
    try { await requestSignup(submittedEmail); toast('If this address is approved, another setup link is on its way.'); }
    catch (e) { toast(e.message, true); }
    finally { resend.disabled = false; }
  }, 'text-button');
  app.append(el('main', { class: 'login' }, el('section', { class: 'login-intro' }, branding(), el('div', {}, el('p', { class: 'eyebrow' }, 'OWEN B WEB DESIGN'), el('h1', {}, el('span', { class: 'outline-text' }, 'Your website.'), el('span', {}, 'In your hands.')), el('p', {}, 'Update your content. Share something new. Make it yours.')), el('p', { class: 'login-footer' }, 'Client portal · Owen B Web Design')),
    el('section', { class: 'login-panel' }, el('div', { class: 'login-form' }, el('p', { class: 'eyebrow' }, sent ? 'CHECK YOUR EMAIL' : signup ? 'ACCOUNT SETUP' : recover ? 'SECURE YOUR ACCOUNT' : 'WELCOME BACK'),
      el('h2', {}, sent ? 'Your setup link is on its way.' : signup ? 'Create your account.' : recover ? 'Choose your password' : 'Your website starts here.'),
      el('p', { class: 'muted' }, sent ? `If ${submittedEmail} is approved for a website, open the link we sent, then choose your password.` : signup ? 'Enter the email Owen approved for your website. We’ll send a secure link to finish setup.' : recover ? 'Use a password you do not use elsewhere.' : 'Sign in to edit your website.'),
      !sent && form, sent && el('div', { class: 'account-links' }, resend, signIn),
      !sent && !recover && !signup && el('div', { class: 'login-options' },
        forgot,
        S.config?.signupEnabled && el('div', { class: 'signup-prompt' }, el('span', {}, 'New to the portal?'), registration)),
      !sent && signup && S.config?.signupEnabled && el('div', { class: 'login-options' }, signIn),
      el('p', { class: 'help' }, 'Need access or no email arrived? Contact Owen to check your approved address.')))));
}
async function signOut() {
  if (S.dirty && !confirm('You have unsaved changes. Sign out and discard them?')) return;
  try { await auth('logout?scope=local', null, 'POST', await accessToken()); } catch {}
  setSession(null); S.dirty = false; S.client = null; S.content = null;
  clearPreviews(); login();
}
function clearPreviews() {
  for (const value of S.previews.values()) URL.revokeObjectURL(value);
  for (const value of S.loadedImages.values()) if (typeof value === 'string') URL.revokeObjectURL(value);
  S.previews.clear(); S.loadedImages.clear(); S.uploads = [];
}
async function openWorkspace() {
  const data = await api('sites'); S.sites = data.sites; S.role = data.role; S.email = data.email;
  if (!S.sites.length) throw new Error('No website is assigned to this account. Contact Owen.');
  S.client = S.sites[0]; await loadContent();
}
async function loadContent() {
  app.replaceChildren(el('div', { class: 'loading' }, 'Loading your website…'));
  const data = await api('content'); clearPreviews(); S.data = data; S.content = structuredClone(data.content); S.dirty = false; S.busy = false;
  S.document = data.schema.find(d => d.name === S.document)?.name || data.schema[0].name;
  const doc = data.schema.find(d => d.name === S.document);
  S.section = doc.fields.find(f => f.name === S.section)?.name || doc.fields[0]?.name;
  render(); refreshStatus();
}
function dirty() { S.dirty = true; updateControls(); }
function get(path) { return path.reduce((a, p) => a?.[p], S.content); }
function set(path, value) { let dest = S.content; for (const p of path.slice(0, -1)) dest = dest[p]; dest[path.at(-1)] = value; dirty(); }
function dateText(value) { return value ? new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value)) : ''; }
function updateControls() {
  const save = document.querySelector('#save'); const publish = document.querySelector('#publish');
  if (save) { save.disabled = S.busy || !S.dirty || S.data.stale; save.textContent = S.busy ? 'Working…' : 'Save draft'; }
  if (publish) publish.disabled = S.busy || S.dirty || !S.data.hasDraft || S.data.stale;
  const caption = document.querySelector('#save-status');
  if (caption) caption.textContent = S.dirty ? 'Unsaved changes' : S.data.hasDraft ? `Draft saved${S.data.savedAt ? ' · ' + dateText(S.data.savedAt) : ''}` : 'No unpublished changes';
}
async function save() {
  const form = document.querySelector('#editor');
  const invalid = [...form.querySelectorAll('input,textarea,select')].find(input => input.validity && !input.validity.valid);
  if (invalid) { let parent = invalid.parentElement; while (parent && parent !== form) { if (parent.tagName === 'DETAILS') parent.open = true; parent = parent.parentElement; } }
  if (!form.reportValidity()) return;
  S.busy = true; updateControls(); document.querySelector('#editor').inert = true;
  try {
    const result = await api('draft', { method: 'PUT', body: { content: S.content, uploads: S.uploads, draftSha: S.data.draftSha, baseMainSha: S.data.baseMainSha } });
    Object.assign(S.data, result); S.dirty = false; S.uploads = []; toast('Draft saved. Your live website has not changed.');
  } catch (e) { toast(e.message, true); }
  finally { S.busy = false; document.querySelector('#editor').inert = false; updateControls(); }
}
async function publish() {
  if (!confirm('Publish this saved draft to your live website?')) return;
  S.busy = true; updateControls(); document.querySelector('#editor').inert = true;
  try {
    const result = await api('publish', { method: 'POST', body: { draftSha: S.data.draftSha } });
    S.pendingCommit = result.mainSha; toast(result.message); await loadContent();
  } catch (e) { toast(e.message, true); }
  finally { S.busy = false; if (document.querySelector('#editor')) document.querySelector('#editor').inert = false; updateControls(); }
}
function exportDraft() {
  const blob = new Blob([JSON.stringify({ clientId: S.client.id, content: S.content, uploads: S.uploads }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob); const a = el('a', { href: url, download: `${S.client.id}-draft.json` }); a.click(); setTimeout(() => URL.revokeObjectURL(url), 3000);
}
async function importDraft(file) {
  try {
    if (file.size > 5000000) throw new Error('This draft file is too large.');
    const draft = JSON.parse(await file.text());
    if (draft.clientId !== S.client.id || !draft.content) throw new Error('Choose a draft exported from this website.');
    if (!confirm('Replace the content in this editor with the imported draft? Review it before saving.')) return;
    S.content = draft.content; S.uploads = draft.uploads || []; dirty(); render(); toast('Draft imported. Review every change before saving.');
  } catch (e) { toast(e.message, true); }
}
async function refreshStatus() {
  if (!S.session || !S.client || document.hidden) return;
  const id = S.client.id;
  try {
    const result = await api('status'); if (S.client?.id !== id) return; S.status = result;
    const node = document.querySelector('#deploy-status'); if (!node) return;
    let caption = !result.configured ? 'Build status not connected' : result.state === 'ready' ? 'Latest build is live' : result.state === 'error' ? 'Build failed · contact Owen' : result.state === 'unknown' ? 'Build status unavailable' : 'Waiting for website build';
    if (S.config.preview) caption = 'Design preview · Live services are not connected';
    else if (S.pendingCommit && result.commit !== S.pendingCommit) caption = 'Waiting for your new build';
    else if (S.pendingCommit && result.state === 'ready') { S.pendingCommit = null; caption = 'Your changes are live'; }
    node.textContent = caption;
    const link = document.querySelector('#live-link'); if (link && /^https?:\/\//.test(result.url || '')) { link.href = result.url; link.hidden = false; }
  } catch { const node = document.querySelector('#deploy-status'); if (node) node.textContent = 'Build status unavailable'; }
}
async function previewDraft() {
  try {
    const result = await api('status', { query: { mode: 'draft' } });
    if (result.url && /^https?:\/\//.test(result.url) && (!result.configured || (result.state === 'ready' && result.commit === S.data.draftSha))) {
      const link = el('a', { href: result.url, target: '_blank', rel: 'noopener noreferrer' }); link.click();
    } else toast(result.configured ? 'The draft preview is not ready yet. Ask Owen to enable the draft branch in Netlify, or wait for its build.' : 'Draft preview is not connected yet. Owen can enable it in the portal setup.', true);
  } catch (e) { toast(e.message, true); }
}
async function history() {
  try {
    const { versions } = await api('history');
    const dialog = el('dialog', {}, el('div', { class: 'dialog-title' }, el('h2', {}, 'Published versions'), button('Close', () => dialog.close(), 'text-button')),
      el('p', { class: 'muted' }, 'Restore an earlier version as a draft, then review it before publishing.'),
      ...versions.map(v => el('div', { class: 'version-row' }, el('span', {}, dateText(v.date)), button('Restore as draft', async () => {
        if (S.dirty && !confirm('Replace your unsaved changes with this version?')) return;
        try { const result = await api('version', { query: { sha: v.sha } }); clearPreviews(); S.content = result.content; dirty(); dialog.close(); render(); toast('Earlier content loaded. Review it, then save a new draft.'); }
        catch (e) { toast(e.message, true); }
      }))), !versions.length && el('p', {}, 'Versions will appear after the first publish from this portal.'));
    dialog.addEventListener('close', () => dialog.remove()); document.body.append(dialog); dialog.showModal();
  } catch (e) { toast(e.message, true); }
}
function render() {
  const doc = S.data.schema.find(d => d.name === S.document);
  const selected = doc.list ? doc : doc.fields.find(f => f.name === S.section) || doc.fields[0];
  const nav = S.data.schema.map(d => button([icon(d.list ? 'menu' : 'grid'), el('span', {}, d.list ? 'Menus' : 'Website content')], () => { S.document = d.name; S.section = d.fields[0]?.name; render(); }, `nav-button ${d.name === S.document ? 'active' : ''}`));
  const sitePicker = S.sites.length > 1 ? el('select', { 'aria-label': 'Website', onChange: async e => {
    if (S.dirty && !confirm('Discard unsaved changes and switch websites?')) { e.target.value = S.client.id; return; }
    S.client = S.sites.find(c => c.id === e.target.value); S.pendingCommit = null;
    try { await loadContent(); } catch (err) { toast(err.message, true); }
  } }, ...S.sites.map(c => el('option', { value: c.id, selected: c.id === S.client.id }, c.name))) : el('strong', {}, S.client.name);
  const sidebar = el('aside', { class: 'sidebar' }, branding(), el('div', { class: 'workspace-label' }, 'YOUR WORKSPACE'), el('div', { class: 'site-name' }, sitePicker, el('small', {}, S.client.location)),
    el('nav', { 'aria-label': 'Editor' }, nav),
    el('div', { class: 'sidebar-bottom' }, button('Version history', history, 'nav-button'), el('div', { class: 'account' }, el('span', { class: 'avatar' }, S.email[0].toUpperCase()), el('div', {}, el('strong', {}, S.role === 'admin' ? 'Administrator' : 'Website editor'), el('small', {}, S.email))), button('Sign out', signOut, 'text-button')));
  const sections = !doc.list && el('div', { class: 'section-picker' }, el('label', { for: 'section' }, 'Editing section'), el('select', { id: 'section', onChange: e => { S.section = e.target.value; render(); } }, ...doc.fields.map(f => el('option', { value: f.name, selected: selected.name === f.name }, f.label))));
  const editor = el('form', { id: 'editor', onSubmit: e => e.preventDefault() },
    doc.list && el('p', { class: 'editing-note' }, 'Menu changes update this website. Update Toast separately for online ordering prices and availability.'),
    selected.name === 'visit' && el('p', { class: 'editing-note' }, 'These hours appear on your website. Ask Owen to update the reservation time picker when your schedule changes.'),
    doc.list ? field(doc, [doc.name], true) : field(selected, [doc.name, selected.name], true));
  const tools = el('details', { class: 'draft-tools' }, el('summary', {}, 'Draft tools'), el('div', { class: 'draft-tool-buttons' }, button('Export draft', exportDraft), button('Reload saved content', async () => {
    if (S.dirty && !confirm('Discard your unsaved changes and reload?')) return;
    try { await loadContent(); } catch (e) { toast(e.message, true); }
  }), el('label', { class: 'button' }, 'Import draft', el('input', { type: 'file', accept: '.json', class: 'file-input', onChange: e => e.target.files[0] && importDraft(e.target.files[0]) }))));
  app.replaceChildren(el('div', { class: 'shell' }, sidebar, el('main', { class: 'main' },
    el('header', { class: 'topbar' }, el('div', {}, el('p', { class: 'eyebrow' }, 'CLIENT PORTAL'), el('h1', {}, 'Your website')),
      el('a', { id: 'live-link', class: 'button live-link', target: '_blank', rel: 'noopener noreferrer', hidden: true }, 'View live site', icon('arrow'))),
    el('div', { class: 'status-strip' }, el('span', { id: 'deploy-status' }, 'Checking build status…'), el('span', { class: 'muted' }, 'Only published changes appear on your website.')),
    S.data.stale && el('div', { class: 'warning', role: 'alert' }, 'The live website changed after this draft began. Export this draft and contact Owen to reconcile the changes before publishing.'),
    el('section', { class: 'editor-card' }, el('div', { class: 'editor-heading' }, el('div', {}, el('p', { class: 'eyebrow' }, doc.list ? 'FOOD & DRINK' : 'EDIT CONTENT'), el('h2', {}, doc.list ? 'Your menus' : selected.label)), sections), editor),
    tools, el('footer', { class: 'actionbar' }, el('div', {}, el('strong', { id: 'save-status' }), el('small', {}, 'Save a draft, then publish when you’re ready.')), el('div', { class: 'actions' }, button('Preview draft', previewDraft, 'button quiet'), button('Save draft', save, 'button', { id: 'save' }), button('Publish changes', publish, 'button primary', { id: 'publish' }))))));
  updateControls(); if (S.status) refreshStatus();
}
function defaultValue(f) {
  if (f.list) return [];
  if (f.type === 'object' || f.type === 'file') return Object.fromEntries((f.fields || []).map(child => [child.name, defaultValue(child)]));
  if (f.type === 'boolean') return true;
  if (f.name === 'id') return crypto.randomUUID();
  return '';
}
function field(f, path, root = false) {
  const value = get(path); const label = f.label || f.name;
  if (f.list) {
    const list = Array.isArray(value) ? value : [];
    const area = el('div', { class: root ? 'list-root' : 'list-field' });
    if (!root) area.append(el('h3', {}, label));
    list.forEach((item, index) => {
      const title = item.name || item.label || item.title || item.day || item.alt || item.source || `${label} ${index + 1}`;
      const min = f.name === 'menus' || f.name === 'sections' ? 1 : f.list.min || 0;
      const controls = el('div', { class: 'item-actions' }, button('Move up', () => { const copy = [...list]; [copy[index - 1], copy[index]] = [copy[index], copy[index - 1]]; set(path, copy); render(); }, 'text-button', { disabled: index === 0 }), button('Move down', () => { const copy = [...list]; [copy[index + 1], copy[index]] = [copy[index], copy[index + 1]]; set(path, copy); render(); }, 'text-button', { disabled: index === list.length - 1 }), button('Remove', () => { if (confirm(`Remove “${title}” from this draft?`)) { set(path, list.filter((_, i) => i !== index)); render(); } }, 'text-button danger', { disabled: list.length <= min }));
      area.append(el('details', { class: 'list-item', open: list.length === 1 }, el('summary', {}, el('span', { class: 'item-number' }, String(index + 1).padStart(2, '0')), el('span', {}, title), item.available === false && el('small', { class: 'muted' }, 'Hidden')), el('div', { class: 'list-item-body' }, field({ ...f, list: false }, [...path, index], true), controls)));
    });
    area.append(button(`+ Add ${f.name === 'menus' ? 'menu' : f.name === 'items' ? 'item' : f.name === 'sections' ? 'category' : 'entry'}`, () => { set(path, [...list, defaultValue({ ...f, list: false })]); render(); const all = document.querySelectorAll('.list-item'); all[all.length - 1]?.setAttribute('open', ''); }, 'button add-button', { disabled: list.length >= (f.list.max || 500) }));
    return area;
  }
  if (f.type === 'object' || f.type === 'file') return el('div', { class: 'field-grid' }, ...f.fields.filter(child => !child.readonly).map(child => field(child, [...path, child.name])));
  if (f.type === 'boolean') return el('label', { class: 'toggle-field' }, el('span', {}, label), el('input', { type: 'checkbox', role: 'switch', checked: value === true, onChange: e => set(path, e.target.checked) }));
  if (f.type === 'image') return imageField(f, path, value);
  if (f.type === 'select') {
    const values = f.options?.values || [];
    const input = el('select', { required: f.required, onChange: e => set(path, e.target.value) }, ...values.map(option => el('option', { value: option.name, selected: value === option.name }, option.label || option.name)));
    return el('label', { class: 'field' }, el('span', {}, label, f.required && el('span', { class: 'required' }, ' *')), input, f.description && el('small', { class: 'muted' }, f.description));
  }
  const multiline = f.type === 'text';
  const input = el(multiline ? 'textarea' : 'input', { ...(multiline ? { rows: 4 } : { type: f.name === 'email' ? 'email' : 'text' }), required: f.required, readonly: f.readonly, maxlength: multiline ? '15000' : '3000', onInput: e => set(path, e.target.value) });
  input.value = value || '';
  return el('label', { class: `field ${multiline ? 'span-full' : ''}` }, el('span', {}, label, f.required && el('span', { class: 'required' }, ' *')), input, f.description && el('small', { class: 'muted' }, f.description));
}
function imageField(f, path, value) {
  const image = el('img', { alt: 'Current website image', class: 'image-preview' });
  const caption = el('p', { class: 'muted image-caption' }, value ? 'Loading image…' : 'Choose a photo');
  if (value) {
    const sha = S.data.hasDraft ? S.data.draftSha : S.data.mainSha;
    const key = `${S.client.id}:${sha}:${value}`;
    if (/^https:\/\/images\.getbento\.com\//.test(value)) { image.src = value; caption.textContent = 'Current photo'; }
    else if (S.previews.has(value)) { image.src = S.previews.get(value); caption.textContent = 'New photo · save draft to keep it'; }
    else {
      if (!S.loadedImages.has(key)) S.loadedImages.set(key, api('image', { query: { path: value, sha }, blob: true }).then(blob => { const url = URL.createObjectURL(blob); S.loadedImages.set(key, url); return url; }).catch(() => { S.loadedImages.delete(key); return null; }));
      Promise.resolve(S.loadedImages.get(key)).then(url => { if (url) { image.src = url; caption.textContent = 'Current photo'; } else caption.textContent = 'Photo preview unavailable'; });
    }
  }
  const upload = el('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp,image/avif', class: 'file-input', onChange: async e => {
    const file = e.target.files[0]; if (!file) return;
    try {
      if (file.size > 20000000) throw new Error('Choose a photo smaller than 20 MB.');
      const bitmap = await createImageBitmap(file); const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas'); canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale); canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', 0.82));
      if (!blob || blob.size > 1500000) throw new Error('This photo is still too large. Try a smaller image.');
      const bytes = new Uint8Array(await blob.arrayBuffer()); let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte);
      const imagePath = `/images/uploads/${crypto.randomUUID()}.webp`;
      const previous = get(path);
      const remaining = S.uploads.filter(u => u.path !== `public${previous}`);
      if (remaining.reduce((sum, u) => sum + u.base64.length, 0) + binary.length * 1.34 > 3500000) throw new Error('Save your current draft before adding more photos.');
      S.uploads = [...remaining, { path: `public${imagePath}`, base64: btoa(binary) }];
      S.previews.set(imagePath, URL.createObjectURL(blob)); set(path, imagePath);
      image.src = S.previews.get(imagePath); caption.textContent = 'New photo · save draft to keep it';
    } catch (err) { toast(err.message, true); }
    e.target.value = '';
  } });
  return el('div', { class: 'image-field span-full' }, el('strong', {}, f.label), el('div', { class: 'image-row' }, image, el('div', {}, el('label', { class: 'button' }, 'Choose photo', upload), caption, el('small', { class: 'muted' }, 'JPG, PNG, WebP or AVIF. Large photos are resized automatically.'))));
}
window.addEventListener('beforeunload', e => { if (S.dirty) { e.preventDefault(); e.returnValue = ''; } });
setInterval(refreshStatus, 20000);
async function start() {
  try {
    S.config = await fetch('/api/portal?action=config').then(r => r.json());
    if (!S.config.configured) {
      app.replaceChildren(el('main', { class: 'setup' }, branding(), el('h1', {}, 'Your portal is almost ready.'), el('p', {}, 'Owen needs to finish connecting account access and website publishing before you can sign in.'), el('p', { class: 'muted' }, 'If you are setting up this portal, follow START-HERE.md in the download.'))); return;
    }
    const hash = new URLSearchParams(location.hash.slice(1));
    const linkError = hash.get('error_description') || (hash.has('error') ? 'This email link could not be used. Request a new link.' : '');
    if (hash.has('access_token')) {
      const token = Object.fromEntries(hash); S.recovery = ['recovery', 'invite', 'magiclink', 'signup'].includes(token.type); token.expires_in = Number(token.expires_in); token.expires_at = Number(token.expires_at) || undefined;
      window.history.replaceState(null, '', location.pathname + location.search); setSession(token);
    } else if (linkError) {
      window.history.replaceState(null, '', location.pathname + location.search);
    } else {
      try { S.session = JSON.parse(sessionStorage.getItem('owen-portal-session')); } catch { setSession(null); }
    }
    if (S.recovery) login('password');
    else if (S.session) { try { await openWorkspace(); } catch (e) { setSession(null); login(); toast(e.message, true); } }
    else login();
    if (linkError) toast(linkError, true);
  } catch { app.replaceChildren(el('main', { class: 'setup' }, branding(), el('h1', {}, 'Connection unavailable'), el('p', {}, 'The portal could not connect. Please try again.'), button('Try again', () => location.reload()))); }
}
start();
