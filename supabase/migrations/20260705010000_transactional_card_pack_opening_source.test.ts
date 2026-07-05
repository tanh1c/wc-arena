import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = readFileSync('supabase/migrations/20260705010000_transactional_card_pack_opening.sql', 'utf8');

test('card pack opening RPC wraps wallet, cards, and opening log in one database transaction', () => {
  assert.match(source, /create or replace function public\.open_card_pack_transaction/);
  assert.match(source, /p_user_id uuid/);
  assert.match(source, /p_pack_type text/);
  assert.match(source, /p_card_ids uuid\[\]/);
  assert.match(source, /p_price_coins integer/);
  assert.match(source, /p_opened_on_utc date/);
  assert.match(source, /returns table \(/);
  assert.match(source, /owned_card jsonb/);
  assert.match(source, /next_coins integer/);

  assert.match(source, /select coalesce\(balance, 0\)[\s\S]*for update/);
  assert.match(source, /raise exception 'Not enough Coins/);
  assert.match(source, /insert into public\.user_player_cards/);
  assert.match(source, /insert into public\.card_pack_openings/);
  assert.match(source, /update public\.point_wallets/);
  assert.match(source, /jsonb_build_object/);
});

test('card pack opening RPC is server-only', () => {
  assert.match(source, /security definer/);
  assert.match(source, /revoke all on function public\.open_card_pack_transaction/);
  assert.match(source, /grant execute on function public\.open_card_pack_transaction[\s\S]*to service_role/);
  assert.doesNotMatch(source, /to authenticated/);
});
