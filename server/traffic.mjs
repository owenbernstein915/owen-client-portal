function collectTraffic(config) {
  if (window.__owenAnalytics || navigator.doNotTrack === '1' || navigator.globalPrivacyControl || location.search.includes('portalEditor')) return;
  const sites = {
    'libelulamontclair.com': 'libelula', 'www.libelulamontclair.com': 'libelula',
    'thelittledaisybakeshop.com': 'little-daisy', 'www.thelittledaisybakeshop.com': 'little-daisy',
    'littledaisybakeshop.com': 'little-daisy', 'www.littledaisybakeshop.com': 'little-daisy',
    'mediaremixed.com': 'media-remixed', 'www.mediaremixed.com': 'media-remixed'
  };
  const site = sites[location.hostname]; if (!site || window.top !== window.self) return;
  window.__owenAnalytics = true;
  const send = () => {
    if (document.visibilityState !== 'visible') return;
    document.removeEventListener('visibilitychange', send);
    let referrer = ''; try { referrer = document.referrer ? new URL(document.referrer).origin : ''; } catch {}
    fetch(config.endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json', apikey: config.key },
      body: JSON.stringify({ site, id: crypto.randomUUID(), path: location.pathname, referrer }),
      keepalive: true, credentials: 'omit', referrerPolicy: 'no-referrer'
    }).catch(() => {});
  };
  if (document.visibilityState === 'visible') send(); else document.addEventListener('visibilitychange', send);
}

export function trackerSource({ url, key }) {
  return `(${collectTraffic.toString()})(${JSON.stringify({ endpoint: `${url.replace(/\/$/, '')}/functions/v1/portal-collect`, key })});`;
}
