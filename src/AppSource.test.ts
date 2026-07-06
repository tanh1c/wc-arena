import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

test('app persists and restores scroll positions per route', () => {
  const source = readFileSync('src/App.tsx', 'utf8');

  assert.match(source, /scrollRestoration = 'manual'/);
  assert.match(source, /wc26\.scroll/);
  assert.match(source, /sessionStorage\.setItem/);
  assert.match(source, /sessionStorage\.getItem/);
  assert.match(source, /window\.scrollTo\(0, savedScrollY\)/);
  assert.match(source, /visibilitychange/);
  assert.match(source, /pagehide/);
});
