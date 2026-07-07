import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = readFileSync('supabase/migrations/20260707031537_card_forge.sql', 'utf8');

test('card forge migration adds forge ownership source type', () => {
  assert.match(source, /drop constraint if exists user_player_cards_source_pack_type_check/);
  assert.match(source, /check \(source_pack_type in \([\s\S]*'forge'[\s\S]*\)\)/);
});

test('card forge RPC spends coins and consumes five spare base copies', () => {
  assert.match(source, /create or replace function public\.forge_card_transaction/);
  assert.match(source, /p_user_id uuid/);
  assert.match(source, /p_source_card_id uuid/);
  assert.match(source, /p_result_card_id uuid/);
  assert.match(source, /p_price_coins integer/);
  assert.match(source, /security definer/);
  assert.match(source, /source_rarity = 'Icon'/);
  assert.match(source, /for update(?: of user_player_cards)? skip locked/);
  assert.match(source, /row_number\(\) over/);
  assert.match(source, /copy_rank > 1/);
  assert.match(source, /is_gif_upgrade = false/);
  assert.match(source, /profile_card_showcases/);
  assert.match(source, /delete from public\.user_player_cards/);
  assert.match(source, /consumed_count < 5/);
  assert.match(source, /update public\.point_wallets/);
  assert.match(source, /source_pack_type, is_gif_upgrade/);
  assert.match(source, /'forge', false/);
  assert.match(source, /jsonb_build_object/);
});

test('card forge RPC is server-only', () => {
  assert.match(source, /revoke all on function public\.forge_card_transaction/);
  assert.match(source, /grant execute on function public\.forge_card_transaction[\s\S]*to service_role/);
  assert.doesNotMatch(source, /to authenticated/);
});
