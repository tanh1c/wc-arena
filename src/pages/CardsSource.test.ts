import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('cards page is routed from Play navigation and includes MVP card collection copy', () => {
  const appSource = readFileSync('src/App.tsx', 'utf8');
  const navigationSource = readFileSync('src/config/navigation.ts', 'utf8');
  const cardsSource = readFileSync('src/pages/Cards.tsx', 'utf8');
  const resourcesSource = readFileSync('src/i18n/resources.ts', 'utf8');

  assert.match(appSource, /lazy\(\(\) => import\('\.\/pages\/Cards'\)\)/);
  assert.match(appSource, /path="\/cards"/);

  assert.match(navigationSource, /to: '\/cards'/);
  assert.match(navigationSource, /nav\.items\.cards/);
  const headerNavigationBlock = navigationSource.slice(
    navigationSource.indexOf('export const headerNavigation'),
    navigationSource.indexOf('export const appNavigationGroups'),
  );
  assert.doesNotMatch(headerNavigationBlock, /to: '\/cards'/);

  assert.match(cardsSource, /appPages\.cards\.dailyPack/);
  assert.match(cardsSource, /appPages\.cards\.premiumPack/);
  assert.match(cardsSource, /appPages\.cards\.collection/);
  assert.match(cardsSource, /appPages\.cards\.showcase/);
  assert.match(cardsSource, /ui\.coinsShort/);

  assert.match(resourcesSource, /cards: 'Cards'/);
  assert.match(resourcesSource, /cardsShort: 'Cards'/);
  assert.match(resourcesSource, /dailyPack: 'Daily Pack'/);
  assert.match(resourcesSource, /premiumPack: 'Premium Pack'/);
});

test('card migration seeds the provided real card list instead of placeholders', () => {
  const migrationSource = readFileSync('supabase/migrations/20260703000000_gacha_card_collection.sql', 'utf8');

  assert.doesNotMatch(migrationSource, /Sample Striker|Sample Defender|example\.com/);
  assert.match(migrationSource, /'Beckham'[\s\S]*'Icon'/);
  assert.match(migrationSource, /'C\. Ronaldo'[\s\S]*'Icon'/);
  assert.match(migrationSource, /'Mbappé'[\s\S]*'Icon'/);
  assert.match(migrationSource, /'https:\/\/s6\.imgcdn\.dev\/YqjcNo\.png'/);
});

test('manage_cards uses deployable shared Supabase auth helpers', () => {
  const functionSource = readFileSync('supabase/functions/manage_cards/index.ts', 'utf8');

  assert.match(functionSource, /\.\.\/_shared\/authGuards\.ts/);
  assert.doesNotMatch(functionSource, /\.\.\/_shared\/(auth|http)\.ts/);
});

test('card image URLs use the direct s6 image host format', () => {
  const cardListSource = readFileSync('Card_list.txt', 'utf8');
  const migrationSource = readFileSync('supabase/migrations/20260703000000_gacha_card_collection.sql', 'utf8');

  assert.doesNotMatch(cardListSource, /https:\/\/imgcdn\.dev\/i\//);
  assert.doesNotMatch(migrationSource, /https:\/\/imgcdn\.dev\/i\//);
  assert.match(cardListSource, /https:\/\/s6\.imgcdn\.dev\/YquayN\.png/);
  assert.match(migrationSource, /https:\/\/s6\.imgcdn\.dev\/YquayN\.png/);
});

test('card art renders at a capped width instead of stretching low-resolution images', () => {
  const cardsSource = readFileSync('src/pages/Cards.tsx', 'utf8');
  const profileSource = readFileSync('src/pages/Profile.tsx', 'utf8');

  assert.match(cardsSource, /max-w-\[180px\]/);
  assert.match(cardsSource, /mx-auto/);
  assert.doesNotMatch(cardsSource, /aspect-\[3\/4\] w-full object-cover/);
  assert.match(profileSource, /max-w-\[120px\]/);
});

test('cards page follows the squad gallery attached layout contract', () => {
  const cardsSource = readFileSync('src/pages/Cards.tsx', 'utf8');

  assert.match(cardsSource, /relative z-10 flex flex-col p-3 sm:p-4 lg:p-6 gap-3 lg:gap-6 min-h-0/);
  assert.match(cardsSource, /bg-card border-4 border-main p-3 sm:p-4 lg:p-6 flex flex-col gap-3 lg:gap-6 shadow-\[6px_6px_0_0_var\(--color-shadow\)\] lg:shadow-\[8px_8px_0_0_var\(--color-shadow\)\] rounded-sm/);
  assert.match(cardsSource, /min-h-\[560px\]/);
  assert.match(cardsSource, /grid grid-cols-2 xl:grid-cols-4 border-b-4 border-main/);
  assert.match(cardsSource, /bg-main text-inv border-b-4 border-main/);
  assert.match(cardsSource, /grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5/);
  assert.doesNotMatch(cardsSource, /rounded-sm min-h-0/);
});

test('cards page separates pack opening from gallery browsing with tabs', () => {
  const cardsSource = readFileSync('src/pages/Cards.tsx', 'utf8');

  assert.match(cardsSource, /activeTab/);
  assert.match(cardsSource, /openPacks/);
  assert.match(cardsSource, /gallery/);
  assert.match(cardsSource, /Open Packs/);
  assert.match(cardsSource, /Gallery/);
  assert.match(cardsSource, /setActiveTab/);
});

test('card art panels use bold rarity-specific graphic backgrounds', () => {
  const cardsSource = readFileSync('src/pages/Cards.tsx', 'utf8');

  assert.match(cardsSource, /getRarityCardArtClass/);
  assert.match(cardsSource, /Common: 'bg-\[repeating-linear-gradient\(135deg,#7fbf5f_0_12px,#d8ff65_12px_24px\)/);
  assert.match(cardsSource, /Rare: 'bg-\[linear-gradient\(#0088ff_3px,transparent_3px\)/);
  assert.match(cardsSource, /Epic: 'bg-\[linear-gradient\(135deg,transparent_0_34%,#ff2bd6_34%_44%/);
  assert.match(cardsSource, /Icon: 'bg-\[repeating-conic-gradient/);
  assert.match(cardsSource, /getRarityCardArtClass\(card\.rarity\)/);
});

test('card PNG art keeps CDN rendering unblended inside rarity panels', () => {
  const cardsSource = readFileSync('src/pages/Cards.tsx', 'utf8');

  assert.doesNotMatch(cardsSource, /mix-blend-multiply/);
  assert.doesNotMatch(cardsSource, /getRarityInnerBackdrop/);
});

test('card tiles use rarity-specific animated frame effects', () => {
  const cardsSource = readFileSync('src/pages/Cards.tsx', 'utf8');
  const cssSource = readFileSync('src/index.css', 'utf8');

  assert.match(cardsSource, /getRarityCardFrameClass/);
  assert.match(cardsSource, /Common: 'wc-card-frame-common'/);
  assert.match(cardsSource, /Rare: 'wc-card-frame-rare'/);
  assert.match(cardsSource, /Epic: 'wc-card-frame-epic'/);
  assert.match(cardsSource, /Icon: 'wc-card-frame-icon'/);
  assert.match(cardsSource, /getRarityCardFrameClass\(card\.rarity\)/);
  assert.match(cssSource, /@keyframes wc-card-rare-scan/);
  assert.match(cssSource, /@keyframes wc-card-epic-pulse/);
  assert.match(cssSource, /@keyframes wc-card-icon-shimmer/);
});

test('card rarity badges use rarity colors and clipped rounded cards', () => {
  const cardsSource = readFileSync('src/pages/Cards.tsx', 'utf8');

  assert.match(cardsSource, /getRarityBadgeClass/);
  assert.match(cardsSource, /Common: 'bg-\[#d8ff65\] text-main/);
  assert.match(cardsSource, /Rare: 'bg-\[#00d4ff\] text-main/);
  assert.match(cardsSource, /Epic: 'bg-\[#ff2bd6\] text-white/);
  assert.match(cardsSource, /Icon: 'bg-\[#fff0b8\] text-main/);
  assert.match(cardsSource, /getRarityBadgeClass\(card\.rarity\)/);
  assert.match(cardsSource, /min-w-0 overflow-hidden/);
});

test('card metadata centers names and uses colored position and flag badges', () => {
  const cardsSource = readFileSync('src/pages/Cards.tsx', 'utf8');

  assert.match(cardsSource, /\.\.\/utils\/teamFlags/);
  assert.match(cardsSource, /getTeamFlag/);
  assert.match(cardsSource, /getNationFlag/);
  assert.match(cardsSource, /text-center/);
  assert.match(cardsSource, /bg-c1 text-main/);
  assert.match(cardsSource, /bg-card text-main/);
  assert.match(cardsSource, /Flag && <Flag/);
  assert.doesNotMatch(cardsSource, /<Star size=\{12\}/);
});

test('open pack panels render pack artwork with an opening effect', () => {
  const cardsSource = readFileSync('src/pages/Cards.tsx', 'utf8');
  const cssSource = readFileSync('src/index.css', 'utf8');

  assert.match(cardsSource, /\.\.\/\.\.\/Daily\.png/);
  assert.match(cardsSource, /\.\.\/\.\.\/Premium\.png/);
  assert.match(cardsSource, /pack\.image/);
  assert.match(cardsSource, /wc-pack-opening/);
  assert.match(cardsSource, /openingPack === packType/);
  assert.match(cssSource, /@keyframes wc-pack-opening/);
});

test('daily pack already-opened state is shown inside the pack panel', () => {
  const cardsSource = readFileSync('src/pages/Cards.tsx', 'utf8');

  assert.match(cardsSource, /dailyPackOpenedToday/);
  assert.match(cardsSource, /getCurrentUserDailyPackOpenedToday/);
  assert.match(cardsSource, /Daily pack already opened today\./);
  assert.match(cardsSource, /appPages\.cards\.dailyPackOpenedToday/);
  assert.match(cardsSource, /isOpenedToday \? t\('appPages\.cards\.dailyPackOpenedToday'\)/);
  assert.match(cardsSource, /disabled=\{openingPack !== null \|\| isOpenedToday\}/);
});
