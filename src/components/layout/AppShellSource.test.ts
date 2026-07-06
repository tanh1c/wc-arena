import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('mobile app header abbreviates the brand to WKB while desktop keeps the product name', () => {
  const appShellSource = readFileSync('src/components/layout/AppShell.tsx', 'utf8');

  assert.match(appShellSource, /<span className="md:hidden">WKB<\/span>/);
  assert.match(appShellSource, /<span className="hidden md:inline">\{t\('common\.product'\)\}<\/span>/);
  assert.match(appShellSource, /data-app-scroll-root/);
  assert.doesNotMatch(appShellSource, /<Link to="\/" className="text-xl md:text-3xl font-black uppercase tracking-tighter whitespace-nowrap hover:text-c2 transition-colors">\{t\('common\.product'\)\}<\/Link>/);
});
