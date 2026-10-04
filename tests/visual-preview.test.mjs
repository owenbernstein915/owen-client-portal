import test from 'node:test';
import assert from 'node:assert/strict';
import { createVisualRefreshUrl } from '../public/visual-preview.mjs';

test('refresh URL reloads the trusted live build and preserves editor mode', () => {
  const result = new URL(createVisualRefreshUrl(
    'https://littledaisybakeshop.com/?portalEditor=1&campaign=summer',
    'https://littledaisybakeshop.com',
    1728000000000,
  ));
  assert.equal(result.origin, 'https://littledaisybakeshop.com');
  assert.equal(result.pathname, '/');
  assert.equal(result.searchParams.get('portalEditor'), '1');
  assert.equal(result.searchParams.get('campaign'), 'summer');
  assert.equal(result.searchParams.get('portalRefresh'), '1728000000000');
});

test('refresh URL refuses an unexpected host or insecure protocol', () => {
  assert.throws(() => createVisualRefreshUrl('https://attacker.example/', 'https://littledaisybakeshop.com', 1), /not trusted/);
  assert.throws(() => createVisualRefreshUrl('http://littledaisybakeshop.com/', 'https://littledaisybakeshop.com', 1), /not trusted/);
});
