import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

test('manage_cards exposes admin-only player card upserts and deletes without removing user actions', () => {
  const source = readFileSync('supabase/functions/manage_cards/index.ts', 'utf8');

  assert.match(source, /requireAdminUser/);
  assert.match(source, /action: 'listAdminPlayerCards'/);
  assert.match(source, /action: 'upsertPlayerCards'; cards: AdminPlayerCardInput\[\]/);
  assert.match(source, /action: 'deletePlayerCard'; id: string/);
  assert.match(source, /body\.action === 'listAdminPlayerCards'/);
  assert.match(source, /body\.action === 'upsertPlayerCards'/);
  assert.match(source, /body\.action === 'deletePlayerCard'/);
  assert.match(source, /requireAdminUser\(req, corsHeaders\)/);
  assert.match(source, /listAdminPlayerCards\(adminAuth\.supabase\)/);
  assert.match(source, /upsertPlayerCards\(adminAuth\.supabase, body\.cards\)/);
  assert.match(source, /deletePlayerCard\(adminAuth\.supabase, body\.id\)/);
  assert.match(source, /\.from\('player_cards'\)\.upsert/);
  assert.match(source, /\.from\('player_cards'\)\.delete\(\)\.eq\('id', cardId\)/);
  assert.match(source, /body\.action === 'openCardPack'/);
  assert.match(source, /body\.action === 'setShowcaseCard'/);
});

test('manage_cards exposes authenticated card GIF upgrades through one RPC', () => {
  const source = readFileSync('supabase/functions/manage_cards/index.ts', 'utf8');

  assert.match(source, /action: 'upgradeCardToGif'; cardId: string/);
  assert.match(source, /body\.action === 'upgradeCardToGif'/);
  assert.match(source, /upgradeCardToGif\(supabase, user\.id, body\.cardId\)/);
  assert.match(source, /upgrade_card_to_gif_transaction/);
  assert.match(source, /p_user_id: userId/);
  assert.match(source, /p_card_id: cardId/);
  assert.match(source, /requireAuthenticatedUser\(req, corsHeaders\)[\s\S]*body\.action === 'upgradeCardToGif'/);
});

test('openCardPack commits coin spend, awarded cards, and opening log through one RPC', () => {
  const source = readFileSync('supabase/functions/manage_cards/index.ts', 'utf8');

  assert.match(source, /open_card_pack_transaction/);
  assert.match(source, /p_user_id: userId/);
  assert.match(source, /p_pack_type: packType/);
  assert.match(source, /p_card_ids: awardedCards\.map\(\(card\) => card\.id\)/);
  assert.match(source, /p_price_coins: pack\.priceCoins/);
  assert.match(source, /p_opened_on_utc: openedOnUtc/);
  assert.match(source, /p_expected_icon_miss_count/);
  assert.match(source, /PITY_STATE_CHANGED/);
  assert.match(source, /forceIcon/);
  assert.doesNotMatch(source, /setUserCoins\(supabase, userId, nextCoins\)/);
  assert.doesNotMatch(source, /\.from\('user_player_cards'\)\s*\.insert\(awardedCards/);
  assert.doesNotMatch(source, /\.from\('card_pack_openings'\)\.insert/);
});

test('manage_cards uses protected per-card drop weights for admin edits and pack draws', () => {
  const source = readFileSync('supabase/functions/manage_cards/index.ts', 'utf8');

  assert.match(source, /player_card_drop_weights/);
  assert.match(source, /normalizeDropWeight/);
  assert.match(source, /drop_weight/);
  assert.match(source, /pickWeightedCard/);
  assert.match(source, /weightsByCardId\.get\(card\.id\) \?\? 1/);
  assert.doesNotMatch(source, /Math\.floor\(Math\.random\(\) \* options\.length\)/);
});

test('manage_cards validates admin card import boundary input', () => {
  const source = readFileSync('supabase/functions/manage_cards/index.ts', 'utf8');

  assert.match(source, /const cardRarities = \['Common', 'Rare', 'Epic', 'Icon'\] as const/);
  assert.match(source, /Array\.isArray\(cards\)/);
  assert.match(source, /cards\.length === 0/);
  assert.match(source, /normalizeRequiredString\(card\.name, 'name'\)/);
  assert.match(source, /normalizeRequiredString\(card\.image_url, 'image_url'\)/);
  assert.match(source, /gif_url: normalizeOptionalString\(card\.gif_url\)/);
  assert.match(source, /cardRarities\.includes\(rarity\)/);
});
