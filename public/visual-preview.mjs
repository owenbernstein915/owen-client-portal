export function createVisualRefreshUrl(currentUrl, expectedOrigin, cacheBuster) {
  const url = new URL(currentUrl);
  if (url.protocol !== 'https:' || url.origin !== expectedOrigin) {
    throw new TypeError('Visual preview origin is not trusted.');
  }
  url.searchParams.set('portalEditor', '1');
  url.searchParams.set('portalRefresh', String(cacheBuster));
  return url.href;
}
