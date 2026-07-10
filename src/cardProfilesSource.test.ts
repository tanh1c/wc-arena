import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = readFileSync('supabase/functions/manage_cards/index.ts', 'utf8');

test('admin profile import resolves cards by exact source image URL', () => {
  assert.match(source, /action: 'importPlayerCardGameplayProfiles'/);
  assert.match(source, /requireAdminUser/);
  assert.match(source, /source_image_url/);
  assert.match(source, /\.eq\('image_url', profile\.source_image_url\)/);
  assert.match(source, /Player card source image URL is ambiguous or missing/);
  assert.match(source, /raw_stats/);
  assert.match(source, /required gameplay stat/);
});
