import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

test('manage_cards exposes admin-managed pack catalog actions', () => {
  const source = readFileSync('supabase/functions/manage_cards/index.ts', 'utf8');

  assert.match(source, /action: 'listCardPackCatalog'/);
  assert.match(source, /action: 'upsertCardPackCatalog'; pack: CardPackCatalogInput/);
  assert.match(source, /body\.action === 'listCardPackCatalog'/);
  assert.match(source, /body\.action === 'upsertCardPackCatalog'/);
  assert.match(source, /listCardPackCatalog\(adminAuth\.supabase\)/);
  assert.match(source, /upsertCardPackCatalog\(adminAuth\.supabase, body\.pack\)/);
  assert.match(source, /getPackConfig\(supabase, packType\)/);
  assert.match(source, /drawCards\(supabase, pack\.card_count, pack\.rarity_weights/);
  assert.match(source, /pack\.price_coins/);
  assert.match(source, /pack\.once_per_utc_day/);
  assert.match(source, /\.from\('card_pack_catalog'\)\.upsert/);
});

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

test('manage_cards exposes authenticated bulk forge through one weighted RPC', () => {
  const source = readFileSync('supabase/functions/manage_cards/index.ts', 'utf8');

  assert.match(source, /action: 'bulkForgeCards'; rarity: CardRarity; userPlayerCardIds: string\[\]/);
  assert.match(source, /body\.action === 'bulkForgeCards'/);
  assert.match(source, /bulkForgeCards\(supabase, user\.id, body\.rarity, body\.userPlayerCardIds\)/);
  assert.match(source, /async function bulkForgeCards/);
  assert.match(source, /selectedIds\.length < CARD_FORGE_COPY_COUNT/);
  assert.match(source, /selectedIds\.length % CARD_FORGE_COPY_COUNT !== 0/);
  assert.match(source, /forgeCount = selectedIds\.length \/ CARD_FORGE_COPY_COUNT/);
  assert.match(source, /totalPrice = recipe\.priceCoins \* forgeCount/);
  assert.match(source, /drawCards\(supabase, forgeCount, recipe\.rarityWeights\)/);
  assert.match(source, /bulk_forge_card_transaction/);
  assert.match(source, /p_result_card_ids: awardedCards\.map\(\(card\) => card\.id\)/);
  assert.match(source, /typeof \(error as \{ message\?: unknown \}\)\.message === 'string'/);
  assert.match(source, /forgedCount: rows\.length/);
  assert.match(source, /consumedCount: selectedIds\.length/);
  assert.doesNotMatch(source, /for \([^)]*forgePlayerCard/);
});

test('manage_cards exposes authenticated selected-card forge through one weighted RPC', () => {
  const source = readFileSync('supabase/functions/manage_cards/index.ts', 'utf8');

  assert.match(source, /CARD_FORGE_RECIPES/);
  assert.match(source, /import \{[^}]*CARD_FORGE_COPY_COUNT[^}]*\} from '..\/..\/..\/src\/config\/cardPacks\.ts'/);
  assert.match(source, /action: 'forgeCard'; rarity: CardRarity; userPlayerCardIds: string\[\]/);
  assert.match(source, /body\.action === 'forgeCard'/);
  assert.match(source, /forgeCard\(supabase, user\.id, body\.rarity, body\.userPlayerCardIds\)/);
  assert.match(source, /CARD_RARITIES\.includes\(rarity\)/);
  assert.match(source, /rarity === 'GOAT'/);
  assert.doesNotMatch(source, /async function forgeCard[\s\S]*rarity === 'Icon'[\s\S]*async function getIconChasePityState/);
  assert.match(source, /selectedIds\.length !== CARD_FORGE_COPY_COUNT/);
  assert.match(source, /new Set\(selectedIds\)/);
  assert.match(source, /drawCards\(supabase, 1, recipe\.rarityWeights\)/);
  assert.match(source, /forge_card_transaction/);
  assert.match(source, /p_source_rarity: rarity/);
  assert.match(source, /p_source_owned_card_ids: selectedIds/);
  assert.match(source, /p_result_card_id: awardedCards\[0\]\.id/);
  assert.match(source, /p_price_coins: recipe\.priceCoins/);
  assert.match(source, /requireAuthenticatedUser\(req, corsHeaders\)[\s\S]*body\.action === 'forgeCard'/);
  assert.doesNotMatch(source, /p_source_card_id: cardId/);
  assert.doesNotMatch(source, /sourceCard\.rarity/);
});

test('openCardPack commits coin spend, awarded cards, and opening log through one RPC', () => {
  const source = readFileSync('supabase/functions/manage_cards/index.ts', 'utf8');

  assert.match(source, /open_card_pack_transaction/);
  assert.match(source, /p_user_id: userId/);
  assert.match(source, /p_pack_type: packType/);
  assert.match(source, /p_card_ids: awardedCards\.map\(\(card\) => card\.id\)/);
  assert.match(source, /p_price_coins: pack\.price_coins/);
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

test('manage_cards filters pack draws by admin-configured card pools', () => {
  const source = readFileSync('supabase/functions/manage_cards/index.ts', 'utf8');

  assert.match(source, /type CardPackPoolType = 'all' \| 'manual' \| 'team' \| 'nation_region' \| 'league' \| 'position'/);
  assert.match(source, /pool_type: CardPackPoolType/);
  assert.match(source, /pool_values: string\[\]/);
  assert.match(source, /poolType: pack\.pool_type/);
  assert.match(source, /poolValues: pack\.pool_values/);
  assert.match(source, /normalizePoolType/);
  assert.match(source, /normalizePoolValues/);
  assert.match(source, /cardMatchesPackPool/);
  assert.match(source, /poolType === 'manual'/);
  assert.match(source, /poolType === 'team'/);
  assert.match(source, /poolType === 'nation_region'/);
  assert.match(source, /poolType === 'league'/);
  assert.match(source, /poolType === 'position'/);
  assert.match(source, /splitAlternatePositions/);
});

test('manage_cards patches core gameplay stats without replacing imported raw stats', () => {
  const source = readFileSync('supabase/functions/manage_cards/index.ts', 'utf8');

  assert.match(source, /action: 'updatePlayerCardGameplayProfileCore'/);
  assert.match(source, /body\.action === 'updatePlayerCardGameplayProfileCore'/);
  assert.match(source, /requireAdminUser\(req, corsHeaders\)/);
  assert.match(source, /updatePlayerCardGameplayProfileCore\(adminAuth\.supabase, body\.cardId, body\.rawStats, body\.playstyles, body\.traits\)/);
  assert.match(source, /from\('player_card_gameplay_profiles'\)[\s\S]*select\('raw_stats, source_image_url'\)/);
  assert.match(source, /existingStats/);
  assert.match(source, /REQUIRED_GAMEPLAY_STATS/);
  assert.match(source, /source_image_url: profile\.source_image_url/);
  assert.match(source, /\.from\('player_card_gameplay_profiles'\)\.upsert/);
});

test('manage_cards lets admins replace a complete gameplay stat map without trusting image URLs', () => {
  const source = readFileSync('supabase/functions/manage_cards/index.ts', 'utf8');

  assert.match(source, /action: 'replacePlayerCardGameplayProfileRawStats'/);
  assert.match(source, /body\.action === 'replacePlayerCardGameplayProfileRawStats'/);
  assert.match(source, /replacePlayerCardGameplayProfileRawStats\(adminAuth\.supabase, body\.cardId, body\.rawStats, body\.playstyles, body\.traits\)/);
  assert.match(source, /async function replacePlayerCardGameplayProfileRawStats/);
  assert.match(source, /raw_stats: normalizeRawStats\(rawStats\)/);
  assert.match(source, /source_image_url: profile\.source_image_url/);
  assert.match(source, /requireAdminUser\(req, corsHeaders\)/);
});

test('manage_cards validates admin card import boundary input', () => {
  const source = readFileSync('supabase/functions/manage_cards/index.ts', 'utf8');

  assert.match(source, /CARD_RARITIES/);
  assert.doesNotMatch(source, /const cardRarities = \['Common', 'Rare', 'Epic', 'Icon'\] as const/);
  assert.match(source, /Array\.isArray\(cards\)/);
  assert.match(source, /cards\.length === 0/);
  assert.match(source, /normalizeRequiredString\(card\.name, 'name'\)/);
  assert.match(source, /normalizeRequiredString\(card\.image_url, 'image_url'\)/);
  assert.match(source, /gif_url: normalizeOptionalString\(card\.gif_url\)/);
  assert.match(source, /CARD_RARITIES\.includes\(rarity\)/);
});
