(() => {
  'use strict';
  if (window.__mediaRemixedContentLoaded) return;
  window.__mediaRemixedContentLoaded = true;
  const PORTAL = 'https://owenbclientdashboard.netlify.app';
  const SITE = 'media-remixed';
  const preview = window.parent !== window && new URLSearchParams(location.search).get('portalEditor') === '1';
  let draftReceived = false;
  let imageOverrides = {};
  const platforms = [
    ['YouTube', 'youtube_url'], ['Instagram', 'instagram_url'], ['LinkedIn', 'linkedin_url'],
    ['TikTok', 'tiktok_url'], ['Spotify', 'spotify_url'], ['Apple Podcasts', 'apple_podcasts_url'], ['Substack', 'substack_url'],
  ];
  const icons = new Map();
  for (const [name] of platforms) {
    const node = [...document.querySelectorAll('.footer-platform')].find(el => (el.getAttribute('aria-label') || '').split(':')[0] === name);
    const svg = node?.querySelector('svg');
    if (svg) icons.set(name, svg.cloneNode(true));
  }
  const arrow = document.querySelector('.header-cta .direction-arrow')?.cloneNode(true);
  function safeUrl(value) {
    try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : ''; }
    catch { return ''; }
  }
  function imageUrl(path) {
    if (typeof path !== 'string' || !/^\/images\/[a-zA-Z0-9_./-]+$/.test(path) || path.includes('..')) return '';
    const override = imageOverrides[path];
    if (preview && typeof override === 'string' && override.length <= 2100000 && /^data:image\/webp;base64,[A-Za-z0-9+/]+=*$/.test(override)) return override;
    return PORTAL + path;
  }
  function bind(el, path) {
    if (el && preview) {
      el.dataset.portalPath = JSON.stringify(['website', ...path]);
      el.setAttribute('title', 'Click to edit');
    }
    return el;
  }
  function text(selector, value, path) {
    document.querySelectorAll(selector).forEach(el => {
      el.textContent = String(value ?? '');
      el.style.whiteSpace = 'pre-line';
      bind(el, path);
    });
  }
  function pending(name) {
    const dialog = document.querySelector('#info-dialog');
    if (!dialog) return;
    document.querySelector('#info-title').textContent = name + ' is coming soon.';
    document.querySelector('#info-copy').textContent = 'The show’s official link will be added here once it is confirmed.';
    dialog.showModal(); document.body.classList.add('dialog-open');
    document.dispatchEvent(new Event('mr:dialogchange'));
  }
  function platform(name, key, value, className, full) {
    const url = safeUrl(value);
    const el = document.createElement(url ? 'a' : 'button');
    el.className = className;
    if (url) { el.href = url; el.target = '_blank'; el.rel = 'noopener noreferrer'; }
    else { el.type = 'button'; el.addEventListener('click', () => pending(name)); }
    el.setAttribute('aria-label', name + (url ? '' : ': coming soon'));
    el.title = name + (url ? '' : ' — coming soon');
    if (icons.has(name)) el.append(icons.get(name).cloneNode(true));
    if (full) {
      const label = document.createElement('span'); label.className = 'platform-name'; label.textContent = name; el.append(label);
      if (url && arrow) el.append(arrow.cloneNode(true));
      else if (!url) { const soon = document.createElement('span'); soon.className = 'pending-tag'; soon.textContent = 'Soon'; el.append(soon); }
    }
    return bind(el, ['links', key]);
  }
  function episodes(data) {
    document.querySelectorAll('.episode-grid').forEach(grid => {
      const home = !!grid.closest('.episode-section');
      const entries = data.items.map((item, index) => ({ item, index })).filter(({item}) => item.available !== false);
      grid.replaceChildren(...(home ? entries.slice(0, 3) : entries).map(({item, index}) => {
        const card = document.createElement('article'); card.className = 'episode-card';
        const art = document.createElement('div'); art.className = 'episode-art';
        const src = imageUrl(item.image);
        if (src) {
          const img = document.createElement('img'); img.src = src; img.alt = item.image_alt || item.title; img.loading = 'lazy';
          Object.assign(img.style, {width:'100%', height:'100%', objectFit:'cover', position:'absolute', inset:'0', filter:'none'}); art.append(img);
        } else {
          const box = document.createElement('span'); box.className = 'boombox-crop'; box.setAttribute('aria-hidden', 'true');
          const img = document.createElement('img'); img.src = '/assets/boombox.png'; img.alt = ''; img.width = 1080; img.height = 1080; box.append(img); art.append(box);
          const number = document.createElement('span'); number.className = 'episode-art-number'; number.textContent = String(index + 1).padStart(2, '0'); number.setAttribute('aria-hidden', 'true'); art.append(number);
        }
        bind(art, ['episodes', 'items', index, 'image']);
        const heading = document.createElement(home ? 'h3' : 'h2'); heading.textContent = item.title; bind(heading, ['episodes', 'items', index, 'title']);
        const description = document.createElement('p'); description.textContent = item.description; bind(description, ['episodes', 'items', index, 'description']);
        card.append(art, heading, description);
        const url = safeUrl(item.url);
        if (url) { const link = document.createElement('a'); link.className = 'text-link'; link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = 'Listen / watch '; if (arrow) link.append(arrow.cloneNode(true)); bind(link, ['episodes', 'items', index, 'url']); card.append(link); }
        return card;
      }));
    });
  }
  function apply(data) {
    if (!data || !data.site || !data.hero || !data.about || !data.episodes || !Array.isArray(data.episodes.items) || !data.newsletter || !data.links || !data.listen) return;
    document.title = data.site.title;
    for (const selector of ['meta[name="description"]', 'meta[property="og:description"]']) document.querySelector(selector)?.setAttribute('content', data.site.description);
    document.querySelector('meta[property="og:title"]')?.setAttribute('content', data.site.title);
    text('.opening-kicker strong', data.hero.host_name, ['hero', 'host_name']);
    text('.show-intro h2', data.hero.intro_title, ['hero', 'intro_title']);
    text('.show-intro p', data.hero.intro_text, ['hero', 'intro_text']);
    const label = document.querySelector('.cinema-label');
    if (label) { const dot = label.querySelector('.signal-dot'); label.replaceChildren(...(dot ? [dot] : []), document.createTextNode(' ' + data.hero.trailer_label)); bind(label, ['hero', 'trailer_label']); }
    text('.cinema-heading p', data.hero.trailer_title, ['hero', 'trailer_title']);
    text('.cinema-status', data.hero.trailer_status, ['hero', 'trailer_status']);
    text('.host-copy .eyebrow', data.about.eyebrow, ['about', 'eyebrow']);
    text('.host-name', data.about.name, ['about', 'name']);
    text('.host-copy .large-copy', data.about.tagline, ['about', 'tagline']);
    text('.host-copy p:not(.large-copy)', data.about.biography, ['about', 'biography']);
    document.querySelectorAll('.host-portrait img').forEach(img => { const src = imageUrl(data.about.image); if (src) img.src = src; img.alt = data.about.image_alt; bind(img, ['about', 'image']); });
    const linkedin = document.querySelector('.host-copy .text-link');
    if (linkedin) { const url = safeUrl(data.links.linkedin_url); linkedin.hidden = !url; if (url) linkedin.href = url; bind(linkedin, ['links','linkedin_url']); }
    text('.about-show h2', data.about.show_title, ['about', 'show_title']);
    text('.about-show p', data.about.show_description, ['about', 'show_description']);
    text('.episode-section .section-heading h2, .page-episodes .page-hero h1', data.episodes.title, ['episodes', 'title']);
    text('.page-episodes .page-hero p', data.episodes.description, ['episodes', 'description']);
    episodes(data.episodes);
    text('.newsletter-hero .eyebrow', data.newsletter.eyebrow, ['newsletter', 'eyebrow']);
    text('.newsletter-title', data.newsletter.title, ['newsletter', 'title']);
    text('.newsletter-hero .large-copy', data.newsletter.tagline, ['newsletter', 'tagline']);
    text('.newsletter-hero > div:first-child > p:not(.large-copy)', data.newsletter.description, ['newsletter', 'description']);
    text('.signup-title', data.newsletter.signup_title, ['newsletter', 'signup_title']);
    const action = document.querySelector('.newsletter-signup .button');
    if (action) {
      const url = safeUrl(data.links.substack_url); action.hidden = !url;
      if (url) action.href = url;
      action.replaceChildren(document.createTextNode(data.newsletter.button_text + ' ')); if (arrow) action.append(arrow.cloneNode(true));
      bind(action, ['newsletter', 'button_text']);
    }
    const top = document.querySelector('.signup-top > span'); if (top) top.textContent = safeUrl(data.links.substack_url) ? 'Substack' : 'Coming soon on Substack';
    text('.page-listen .page-hero h1', data.listen.title, ['listen', 'title']);
    text('.page-listen .page-hero p', data.listen.description, ['listen', 'description']);
    const toolbar = document.querySelector('.toolbar-socials');
    if (toolbar) toolbar.replaceChildren(...platforms.slice(0, 4).filter(([,key]) => safeUrl(data.links[key])).map(([name,key]) => platform(name,key,data.links[key],'toolbar-social',false)));
    const footer = document.querySelector('.footer-platforms');
    if (footer) footer.replaceChildren(...platforms.map(([name,key]) => platform(name,key,data.links[key],'footer-platform',false)));
    const directory = document.querySelector('.platform-list');
    if (directory) directory.replaceChildren(...platforms.map(([name,key]) => platform(name,key,data.links[key],'platform-link',true)));
    const email = document.querySelector('.footer-email');
    if (email) { email.href = 'mailto:' + encodeURIComponent(data.site.email); email.setAttribute('aria-label','Email the show at ' + data.site.email); const span = email.querySelector('span'); if (span) span.textContent = data.site.email; bind(email, ['site','email']); }
  }
  if (preview) {
    document.addEventListener('click', event => {
      const target = event.target.closest('[data-portal-path]');
      if (target) { event.preventDefault(); event.stopImmediatePropagation(); window.parent.postMessage({type:'owen-portal:edit',siteId:SITE,path:JSON.parse(target.dataset.portalPath)}, PORTAL); }
      else {
        const link = event.target.closest('a');
        if (link && link.origin === location.origin && link.pathname !== location.pathname) { const url = new URL(link.href); url.searchParams.set('portalEditor','1'); link.href = url.href; }
      }
    }, true);
    window.addEventListener('message', event => {
      if (event.origin !== PORTAL || event.source !== window.parent) return;
      const message = event.data;
      if (!message || message.siteId !== SITE || !['owen-portal:init','owen-portal:update'].includes(message.type)) return;
      draftReceived = true; imageOverrides = message.imageOverrides || {}; apply(message.content?.website);
    });
    window.parent.postMessage({type:'owen-portal:ready',siteId:SITE}, PORTAL);
  }
  fetch(PORTAL + '/media-remixed-content.json', {cache:'no-store', credentials:'omit'})
    .then(response => { if (!response.ok) throw new Error('Content unavailable'); return response.json(); })
    .then(data => { if (!draftReceived) apply(data); })
    .catch(() => { /* Keep the complete static website if the content service is temporarily unavailable. */ });
})();
