import test from 'node:test';
import assert from 'node:assert/strict';
import { renderAgentMarkdown } from './agentMarkdown';

test('renders README-style markdown used by agent responses', () => {
  const html = renderAgentMarkdown([
    '# Match preview',
    '',
    '**Brazil** should control possession.',
    '',
    '- Press high',
    '- Protect the box',
    '',
    'Use `3-2` only with confidence.',
    '',
    '[Open match](https://example.com/match)',
  ].join('\n'));

  assert.match(html, /<h2>Match preview<\/h2>/);
  assert.match(html, /<strong>Brazil<\/strong>/);
  assert.match(html, /<ul><li>Press high<\/li><li>Protect the box<\/li><\/ul>/);
  assert.match(html, /<code>3-2<\/code>/);
  assert.match(html, /<a href="https:\/\/example\.com\/match" target="_blank" rel="noreferrer">Open match<\/a>/);
});

test('escapes unsafe html and rejects unsafe links', () => {
  const html = renderAgentMarkdown('<script>alert(1)</script>\n\n[bad](javascript:alert(1))');

  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>/);
  assert.doesNotMatch(html, /javascript:/);
  assert.match(html, />bad</);
});
