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
  assert.match(pageSource, /PLAYER_PAGE_SIZE = 12/);
  assert.match(pageSource, /type PositionFilter = 'all' \| string/);
  assert.match(pageSource, /type PlayerSort = 'position' \| 'rarity'/);
  assert.match(pageSource, /RARITY_ORDER/);
  assert.match(pageSource, /getRarityRank/);
  assert.match(pageSource, /POSITION_FILTERS/);
  assert.match(pageSource, /positionFilter/);
  assert.match(pageSource, /playerSort/);
  assert.match(pageSource, /player_cards\.position !== positionFilter/);
  assert.match(pageSource, /grid h-24 w-full grid-cols-\[64px_minmax\(0,1fr\)_44px\]/);
  assert.match(pageSource, /groupedOwnedCards/);
  assert.match(pageSource, /duplicateCount/);
  assert.match(pageSource, /paginatedOwnedCards/);
  assert.match(pageSource, /max-h-\[520px\].*overflow-y-auto/);
  assert.match(pageSource, /aspect-\[12\/13\]/);
  assert.match(pageSource, /min-h-\[620px\]/);
  assert.match(pageSource, /max-w-\[820px\]/);
  assert.match(pageSource, /w-\[96px\].*sm:w-\[132px\]/);
  assert.match(pageSource, /<div onClick=\{\(\) => setSelectedSlotId\(''\)\} className="bg-\[#0b5d3b\] p-3 sm:p-5">/);
  assert.match(pageSource, /event\.stopPropagation\(\)/);
  assert.match(pageSource, /setPositionFilter\(slot\.label\);/);
  assert.match(pageSource, /const selectedSlot = slots\.find\(\(slot\) => slot\.id === selectedSlotId\);/);
  assert.match(pageSource, /h-32 w-32.*sm:h-40 sm:w-40/);
  assert.match(pageSource, /drop-shadow-\[4px_4px_0_rgba\(0,0,0,0\.35\)\]/);
  assert.doesNotMatch(pageSource, /radial-gradient/);
  assert.doesNotMatch(pageSource, /rounded-full border-4 border-white\/70/);
  assert.doesNotMatch(pageSource, /block overflow-hidden border-4 border-main bg-card/);
  assert.doesNotMatch(pageSource, /flex h-20 items-end justify-center bg-muted/);
  assert.doesNotMatch(pageSource, /block border-t-2 border-main bg-card/);

  assert.match(resourcesSource, /squadBuilder: 'Squad Builder'/);
  assert.match(resourcesSource, /squadBuilderShort: 'Squad'/);
  assert.match(resourcesSource, /squadBuilder: 'Xếp đội hình'/);
});
