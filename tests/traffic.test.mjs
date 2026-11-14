import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { trackerSource } from '../server/traffic.mjs';

test('tracker records once without query strings, full referrers, or credentials', async () => {
  const requests = [];
  const window = {}; window.top = window; window.self = window;
  const context = vm.createContext({ window, navigator: {},
    location: { hostname: 'mediaremixed.com', pathname: '/episodes', search: '?private=value' },
    document: { visibilityState: 'visible', referrer: 'https://example.org/article?email=private', removeEventListener() {} },
    URL, crypto: { randomUUID: () => 'example-id' },
    fetch: async (...args) => { requests.push(args); }
  });
  const source = trackerSource({ url: 'https://example.supabase.co/', key: 'public-test-key' });
  vm.runInContext(source, context); vm.runInContext(source, context);
  assert.equal(requests.length, 1);
  const [url, options] = requests[0];
  assert.equal(url, 'https://example.supabase.co/functions/v1/portal-collect');
  assert.deepEqual(JSON.parse(options.body), { site: 'media-remixed', id: 'example-id', path: '/episodes', referrer: 'https://example.org' });
  assert.equal(options.credentials, 'omit');
  assert.equal(options.referrerPolicy, 'no-referrer');
});

test('tracker respects privacy opt-outs, unknown hosts, and embedded previews', () => {
  for (const override of [{ navigator: { doNotTrack: '1' } }, { navigator: { globalPrivacyControl: true } },
    { location: { hostname: 'preview.example.org' } }, { location: { search: '?portalEditor=1' } }, { embedded: true }]) {
    const window = {}; window.self = window; window.top = override.embedded ? {} : window;
    const context = vm.createContext({ window, navigator: override.navigator || {},
      location: { hostname: 'mediaremixed.com', pathname: '/', search: '', ...override.location },
      document: { visibilityState: 'visible' },
      fetch: () => { assert.fail('Opted-out visit must not be sent'); }
    });
    vm.runInContext(trackerSource({ url: 'https://example.supabase.co', key: 'public-test-key' }), context);
  }
});
