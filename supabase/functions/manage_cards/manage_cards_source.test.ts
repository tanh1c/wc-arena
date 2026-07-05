import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

test('manage_cards exposes admin-only player card upserts and deletes without removing user actions', () => {
  const source = readFileSync('supabase/functions/manage_cards/index.ts', 'utf8');

  assert.match(source, /requireAdminUser/);
  assert.match(source, /action: 'upsertPlayerCards'; cards: AdminPlayerCardInput\[\]/);
  assert.match(source, /action: 'deletePlayerCard'; id: string/);
  assert.match(source, /body\.action === 'upsertPlayerCards'/);
  assert.match(source, /body\.action === 'deletePlayerCard'/);
  assert.match(source, /requireAdminUser\(req, corsHeaders\)/);
  assert.match(source, /upsertPlayerCards\(adminAuth\.supabase, body\.cards\)/);
  assert.match(source, /deletePlayerCard\(adminAuth\.supabase, body\.id\)/);
  assert.match(source, /\.from\('player_cards'\)\.upsert/);
  assert.match(source, /\.from\('player_cards'\)\.delete\(\)\.eq\('id', cardId\)/);
  assert.match(source, /body\.action === 'openCardPack'/);
  assert.match(source, /body\.action === 'setShowcaseCard'/);
});

test('manage_cards validates admin card import boundary input', () => {
  const source = readFileSync('supabase/functions/manage_cards/index.ts', 'utf8');

  assert.match(source, /const cardRarities = \['Common', 'Rare', 'Epic', 'Icon'\] as const/);
  assert.match(source, /Array\.isArray\(cards\)/);
  assert.match(source, /cards\.length === 0/);
  assert.match(source, /normalizeRequiredString\(card\.name, 'name'\)/);
  assert.match(source, /normalizeRequiredString\(card\.image_url, 'image_url'\)/);
  assert.match(source, /cardRarities\.includes\(rarity\)/);
});
