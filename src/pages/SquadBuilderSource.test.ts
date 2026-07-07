import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

test('squad builder is routed, navigable, and wired to owned cards', () => {
  const appSource = readFileSync('src/App.tsx', 'utf8');
  const navigationSource = readFileSync('src/config/navigation.ts', 'utf8');
  const pageSource = readFileSync('src/pages/SquadBuilder.tsx', 'utf8');
  const resourcesSource = readFileSync('src/i18n/resources.ts', 'utf8');

  assert.match(appSource, /lazy\(\(\) => import\('\.\/pages\/SquadBuilder'\)\)/);
  assert.match(appSource, /path="\/squad-builder"/);
  assert.match(navigationSource, /to: '\/squad-builder'/);
  assert.match(navigationSource, /nav\.items\.squadBuilder/);
  assert.match(navigationSource, /Shield/);

  assert.match(pageSource, /AppShell/);
  assert.match(pageSource, /listCurrentUserOwnedCards/);
  assert.match(pageSource, /getPlayerCardDisplayImageUrl/);
  assert.match(pageSource, /\.\.\/\.\.\/squadbuilder_empty_slot\.svg/);
  assert.match(pageSource, /assignCardToSlot/);
  assert.match(pageSource, /getAssignedOwnedCardIds/);
  assert.match(pageSource, /appPages\.squadBuilder/);

  assert.match(resourcesSource, /squadBuilder: 'Squad Builder'/);
  assert.match(resourcesSource, /squadBuilderShort: 'Squad'/);
  assert.match(resourcesSource, /squadBuilder: 'Xếp đội hình'/);
});
