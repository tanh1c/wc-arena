import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

test('admin dashboard renders tabbed admin sections with match management as default', () => {
  const source = readFileSync('src/pages/AdminDashboard.tsx', 'utf8');

  assert.match(source, /activeAdminTab, setActiveAdminTab/);
  assert.match(source, /useState<'matches' \| 'cards' \| 'packs'>\('matches'\)/);
  assert.match(source, /Match Management/);
  assert.match(source, /Player Cards/);
  assert.match(source, /Card Packs/);
  assert.match(source, /activeAdminTab === 'matches'/);
  assert.match(source, /activeAdminTab === 'cards'/);
  assert.match(source, /activeAdminTab === 'packs'/);
});

test('admin dashboard exposes player-card CRUD and CSV import only after the admin gate', () => {
  const source = readFileSync('src/pages/AdminDashboard.tsx', 'utf8');
  const panelIndex = source.lastIndexOf('Player Cards');
  const adminGateIndex = source.indexOf("role !== 'admin'");

  assert.notEqual(panelIndex, -1);
  assert.notEqual(adminGateIndex, -1);
  assert.ok(adminGateIndex < panelIndex);
  assert.match(source, /listAdminPlayerCards/);
  assert.match(source, /upsertPlayerCards/);
  assert.match(source, /deletePlayerCard/);
  assert.match(source, /parsePlayerCardCsv/);
  assert.match(source, /cardCsvImport/);
  assert.match(source, /csvImportRarity/);
  assert.match(source, /Import CSV/);
  assert.match(source, /PNG URL/);
  assert.match(source, /gif_url/);
  assert.match(source, /GIF URL/);
  assert.doesNotMatch(source, /Image URL/);
  assert.match(source, /Save card/);
  assert.match(source, /New card/);
});

test('admin player-card editor exposes per-card drop weight controls', () => {
  const source = readFileSync('src/pages/AdminDashboard.tsx', 'utf8');

  assert.match(source, /Drop Weight/);
  assert.match(source, /drop_weight/);
  assert.match(source, /inputMode="decimal"/);
  assert.match(source, /listAdminPlayerCards/);
});

test('admin player-card catalog exposes local search, rarity filter, and sort controls', () => {
  const source = readFileSync('src/pages/AdminDashboard.tsx', 'utf8');

  assert.match(source, /CARD_RARITIES/);
  assert.match(source, /cardSearchQuery/);
  assert.match(source, /setCardSearchQuery/);
  assert.match(source, /cardRarityFilter/);
  assert.match(source, /setCardRarityFilter/);
  assert.match(source, /cardCatalogSort/);
  assert.match(source, /visiblePlayerCards/);
  assert.match(source, /Search cards/);
  assert.match(source, /Rarity filter/);
  assert.match(source, /cardRarities\.map\(\(rarity\) => <option key=\{rarity\} value=\{rarity\}>\{rarity\}<\/option>\)/);
  assert.match(source, /Sort by/);
  assert.match(source, /Name A-Z/);
  assert.match(source, /Team A-Z/);
  assert.match(source, /Position A-Z/);
  assert.match(source, /No player cards match your search\./);
  assert.match(source, /max-h-\[70dvh\] overflow-auto/);
  assert.match(source, /<thead className="sticky top-0 z-10 bg-muted font-black uppercase">/);
  assert.match(source, /visiblePlayerCards\.map/);
});

test('admin dashboard exposes pack catalog editing with repo image selection', () => {
  const source = readFileSync('src/pages/AdminDashboard.tsx', 'utf8');

  assert.match(source, /PACK_IMAGE_OPTIONS/);
  assert.match(source, /listCardPackCatalog/);
  assert.match(source, /upsertCardPackCatalog/);
  assert.match(source, /emptyPackDraft/);
  assert.match(source, /Card Packs/);
  assert.match(source, /Pack type/);
  assert.match(source, /Card count/);
  assert.match(source, /Price Coins/);
  assert.match(source, /Image/);
  assert.match(source, /Pack preview/);
  assert.match(source, /Save pack/);
  assert.match(source, /Copy rarity rates/);
  assert.match(source, /copyPackRarityWeights/);
  assert.match(source, /packCatalog\.filter\(\(pack\) => pack\.pack_type !== packDraft\.pack_type\)/);
  assert.match(source, /rarity_weights: \{ \.\.\.sourcePack\.rarity_weights \}/);
  assert.match(source, /packDraft\.image_path/);
  assert.match(source, /PACK_IMAGE_OPTIONS\.map/);
});

test('admin dashboard derives pack pool selectors from player card database rows', () => {
  const source = readFileSync('src/pages/AdminDashboard.tsx', 'utf8');

  assert.match(source, /type CardPackPoolType/);
  assert.match(source, /poolTypeOptions/);
  assert.match(source, /packPoolOptions/);
  assert.match(source, /playerCards\.flatMap/);
  assert.match(source, /splitAlternatePositions/);
  assert.match(source, /Pool type/);
  assert.match(source, /Pool values/);
  assert.match(source, /packDraft\.pool_type/);
  assert.match(source, /packDraft\.pool_values/);
  assert.match(source, /setPackPoolType/);
  assert.match(source, /setPackPoolValues/);
  assert.match(source, /packPoolPickerOpen/);
  assert.match(source, /togglePackPoolValue/);
  assert.match(source, /packPoolSearchQuery/);
  assert.match(source, /setPackPoolSearchQuery/);
  assert.match(source, /packPoolPositionFilter/);
  assert.match(source, /packPoolNationFilter/);
  assert.match(source, /packPoolTeamFilter/);
  assert.match(source, /packPoolLeagueFilter/);
  assert.match(source, /packPoolSort/);
  assert.match(source, /visiblePoolPlayerCards/);
  assert.match(source, /Search player name/);
  assert.match(source, /Position filter/);
  assert.match(source, /Nation filter/);
  assert.match(source, /Team filter/);
  assert.match(source, /League filter/);
  assert.match(source, /Sort players/);
  assert.match(source, /Name A-Z/);
  assert.match(source, /Clear filters/);
  assert.match(source, /Manage pool values/);
  assert.match(source, /Clear pool/);
  assert.match(source, /Done/);
  assert.match(source, /fixed inset-0 z-\[100\]/);
  assert.match(source, /pt-16/);
  assert.match(source, /max-h-\[calc\(100dvh-5rem\)\]/);
  assert.match(source, /bg-black\/70/);
  assert.match(source, /border-4 border-main/);
  assert.match(source, /visiblePoolPlayerCards\.map\(\(card\) =>/);
  assert.match(source, /<img src=\{card\.image_url\}/);
  assert.doesNotMatch(source, /<select multiple value=\{packDraft\.pool_values\}/);
  assert.doesNotMatch(source, /placeholder="\{.*pool/s);
});

test('admin access check is stable across refreshed session objects for the same user', () => {
  const source = readFileSync('src/pages/AdminDashboard.tsx', 'utf8');

  assert.match(source, /const userId = user\?\.id \?\? null/);
  assert.match(source, /getCurrentUserRole\(userId\)/);
  assert.match(source, /\}, \[userId\]\)/);
  assert.doesNotMatch(source, /\}, \[user\]\)/);
});
