import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = readFileSync('supabase/migrations/20260705020000_card_gif_upgrades.sql', 'utf8');

test('card GIF upgrade migration tracks upgraded ownership and source type', () => {
  assert.match(source, /alter table public\.user_player_cards[\s\S]*add column if not exists is_gif_upgrade boolean not null default false/);
  assert.match(source, /check \(source_pack_type in \([\s\S]*'upgrade'[\s\S]*\)\)/);
  assert.match(source, /create index if not exists user_player_cards_user_card_gif_idx/);
  assert.match(source, /create unique index if not exists user_player_cards_one_gif_upgrade_idx/);
  assert.match(source, /where is_gif_upgrade/);
});

test('card GIF upgrade RPC consumes five unlocked base copies and returns one upgraded card', () => {
  assert.match(source, /create or replace function public\.upgrade_card_to_gif_transaction/);
  assert.match(source, /p_user_id uuid/);
  assert.match(source, /p_card_id uuid/);
  assert.match(source, /security definer/);
  assert.match(source, /target_gif_url is null or btrim\(target_gif_url\) = ''/);
  assert.match(source, /already has GIF upgrade/i);
  assert.match(source, /for update skip locked/);
  assert.match(source, /profile_card_showcases/);
  assert.match(source, /count\(\*\) into consumed_count/);
  assert.match(source, /consumed_count < 5/);
  assert.match(source, /delete from public\.user_player_cards/);
  assert.match(source, /source_pack_type, is_gif_upgrade/);
  assert.match(source, /'upgrade', true/);
  assert.match(source, /jsonb_build_object/);
});

test('card GIF upgrade RPC is server-only', () => {
  assert.match(source, /revoke all on function public\.upgrade_card_to_gif_transaction/);
  assert.match(source, /grant execute on function public\.upgrade_card_to_gif_transaction[\s\S]*to service_role/);
  assert.doesNotMatch(source, /to authenticated/);
});
