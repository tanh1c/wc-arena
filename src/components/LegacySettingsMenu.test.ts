import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('settings menus do not expose the retired Mac frame option', () => {
  const settingsSources = [
    readFileSync('src/components/LegacySettingsMenu.tsx', 'utf8'),
    readFileSync('src/components/layout/AppShell.tsx', 'utf8'),
  ].join('\n');

  assert.doesNotMatch(settingsSources, /settings\.macFrame/);
});
