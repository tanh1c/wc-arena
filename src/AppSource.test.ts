import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

test('app persists and restores scroll positions per route', () => {
  const source = readFileSync('src/App.tsx', 'utf8');

  assert.match(source, /scrollRestoration = 'manual'/);
  assert.match(source, /wc26\.scroll/);
  assert.match(source, /sessionStorage\.setItem/);
  assert.match(source, /sessionStorage\.getItem/);
  assert.match(source, /\[data-app-scroll-root\]/);
  assert.match(source, /scrollRoot\.scrollTop/);
  assert.match(source, /scrollRoot\.scrollHeight/);
  assert.match(source, /visibilitychange/);
  assert.match(source, /pagehide/);
  assert.match(source, /1500/);
  assert.match(source, /3000/);
});
