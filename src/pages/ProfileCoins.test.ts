import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('header and profile separate rank XP from spendable Coins', () => {
  const appShellSource = readFileSync('src/components/layout/AppShell.tsx', 'utf8');
  const profileSource = readFileSync('src/pages/Profile.tsx', 'utf8');

  assert.match(appShellSource, /getCurrentUserCoinBalance/);
  assert.match(appShellSource, /coins/);
  assert.match(appShellSource, /ui\.coinsShort/);
  assert.doesNotMatch(appShellSource, /profile\.points\.toLocaleString\(\)\} PTS/);

  assert.match(profileSource, /getCurrentUserCoinBalance/);
  assert.match(profileSource, /ui\.coinsShort/);
  assert.match(profileSource, /XP/);
  assert.match(profileSource, /coins/);
});
