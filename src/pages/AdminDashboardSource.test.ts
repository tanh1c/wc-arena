import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

test('admin dashboard renders tabbed admin sections with match management as default', () => {
  const source = readFileSync('src/pages/AdminDashboard.tsx', 'utf8');

  assert.match(source, /activeAdminTab, setActiveAdminTab/);
  assert.match(source, /useState<'matches' \| 'cards'>\('matches'\)/);
  assert.match(source, /Match Management/);
  assert.match(source, /Player Cards/);
  assert.match(source, /activeAdminTab === 'matches'/);
  assert.match(source, /activeAdminTab === 'cards'/);
});

test('admin dashboard exposes player-card CRUD and CSV import only after the admin gate', () => {
  const source = readFileSync('src/pages/AdminDashboard.tsx', 'utf8');
  const panelIndex = source.lastIndexOf('Player Cards');
  const adminGateIndex = source.indexOf("role !== 'admin'");

  assert.notEqual(panelIndex, -1);
  assert.notEqual(adminGateIndex, -1);
  assert.ok(adminGateIndex < panelIndex);
  assert.match(source, /listPlayerCards/);
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

test('admin player-card catalog exposes local search and sort controls', () => {
  const source = readFileSync('src/pages/AdminDashboard.tsx', 'utf8');

  assert.match(source, /cardSearchQuery/);
  assert.match(source, /setCardSearchQuery/);
  assert.match(source, /cardCatalogSort/);
  assert.match(source, /visiblePlayerCards/);
  assert.match(source, /Search cards/);
  assert.match(source, /Sort by/);
  assert.match(source, /Name A-Z/);
  assert.match(source, /Team A-Z/);
  assert.match(source, /Position A-Z/);
  assert.match(source, /No player cards match your search\./);
  assert.match(source, /visiblePlayerCards\.map/);
});
