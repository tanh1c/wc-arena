import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const source = readdirSync('supabase/migrations')
  .filter((file) => file.endsWith('.sql'))
  .map((file) => readFileSync(join('supabase/migrations', file), 'utf8'))
  .join('\n');

test('bulk forge RPC consumes selected spare base cards in one safe transaction', () => {
  assert.match(source, /create or replace function public\.bulk_forge_card_transaction/);
  assert.match(source, /p_source_owned_card_ids uuid\[\]/);
  assert.match(source, /p_result_card_ids uuid\[\]/);
  assert.match(source, /p_total_price_coins integer/);
  assert.match(source, /from unnest\(p_result_card_ids\) as result_card_id/);
  assert.match(source, /left join public\.player_cards on player_cards\.id = result_card_id/);
  assert.match(source, /where player_cards\.id is null/);
  assert.match(source, /array_length\(p_source_owned_card_ids, 1\) <> array_length\(p_result_card_ids, 1\) \* 5/);
  assert.match(source, /for update/);
  assert.match(source, /user_player_cards\.is_gif_upgrade = false/);
  assert.match(source, /profile_card_showcases\.user_player_card_id is null/);
  assert.match(source, /base_count <= selected_count/);
  assert.match(source, /delete from public\.user_player_cards/);
  assert.match(source, /insert into public\.user_player_cards \(user_id, card_id, source_pack_type, is_gif_upgrade\)/);
  assert.match(source, /grant execute on function public\.bulk_forge_card_transaction\(uuid, text, uuid\[\], uuid\[\], integer\) to service_role/);
  assert.doesNotMatch(source, /grant execute on function public\.bulk_forge_card_transaction\(uuid, text, uuid\[\], uuid\[\], integer\) to authenticated/);
});

test('selected-card forge RPC consumes exactly five chosen spare base cards safely', () => {
  assert.match(source, /drop function if exists public\.forge_card_transaction\(uuid, uuid, uuid, integer\)/);
  assert.match(source, /p_source_rarity text/);
  assert.match(source, /p_source_owned_card_ids uuid\[\]/);
  assert.match(source, /array_length\(p_source_owned_card_ids, 1\) <> 5/);
  assert.match(source, /count\(distinct selected_id\) <> 5/);
  assert.match(source, /player_cards\.rarity = p_source_rarity/);
  assert.match(source, /is_gif_upgrade = false/);
  assert.match(source, /profile_card_showcases/);
  assert.match(source, /base_count <= selected_count/);
  assert.match(source, /for update/);
  assert.match(source, /delete from public\.user_player_cards/);
  assert.match(source, /grant execute on function public\.forge_card_transaction\(uuid, text, uuid\[\], uuid, integer\) to service_role/);
  assert.doesNotMatch(source, /grant execute on function public\.forge_card_transaction\(uuid, text, uuid\[\], uuid, integer\) to authenticated/);
});
