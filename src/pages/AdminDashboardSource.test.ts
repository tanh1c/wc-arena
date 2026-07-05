import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

test('admin dashboard exposes a compact JSON player card import panel', () => {
  const source = readFileSync('src/pages/AdminDashboard.tsx', 'utf8');

  assert.match(source, /upsertPlayerCards/);
  assert.match(source, /cardImportJson/);
  assert.match(source, /JSON\.parse\(cardImportJson\)/);
  assert.match(source, /Array\.isArray\(parsedCards\)/);
  assert.match(source, /Player cards JSON/);
  assert.match(source, /Import \/ update cards/);
});

test('admin dashboard keeps card import behind the existing admin screen gate', () => {
  const source = readFileSync('src/pages/AdminDashboard.tsx', 'utf8');
  const panelIndex = source.lastIndexOf('Player cards JSON');
  const adminGateIndex = source.indexOf("role !== 'admin'");

  assert.notEqual(panelIndex, -1);
  assert.notEqual(adminGateIndex, -1);
  assert.ok(adminGateIndex < panelIndex);
});
