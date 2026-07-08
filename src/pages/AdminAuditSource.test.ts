import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

test('admin audit access check is stable across refreshed session objects for the same user', () => {
  const source = readFileSync('src/pages/AdminAudit.tsx', 'utf8');

  assert.match(source, /const userId = user\?\.id \?\? null/);
  assert.match(source, /getCurrentUserRole\(\)/);
  assert.match(source, /\}, \[userId\]\)/);
  assert.doesNotMatch(source, /\}, \[user\]\)/);
});
