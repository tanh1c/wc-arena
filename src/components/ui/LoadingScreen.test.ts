import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import LoadingScreen from './LoadingScreen';

test('renders branded loading screen copy', () => {
  const html = renderToStaticMarkup(createElement(LoadingScreen, { label: 'Loading page...' }));

  assert.match(html, /We Know Ball/);
  assert.match(html, /Loading page/);
  assert.match(html, /role="status"/);
});

test('fills the viewport with a branded loading stage', () => {
  const html = renderToStaticMarkup(createElement(LoadingScreen, { label: 'Loading page...' }));

  assert.match(html, /fixed inset-0/);
  assert.match(html, /aria-label="Loading page\.\.\."/);
  assert.match(html, /MATCH IS LOADING/);
});
