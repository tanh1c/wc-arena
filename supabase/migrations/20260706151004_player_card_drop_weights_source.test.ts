import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

test('player card drop weights are protected and backfilled for existing cards', () => {
  const source = readFileSync('supabase/migrations/20260706151004_player_card_drop_weights.sql', 'utf8');

  assert.match(source, /create table if not exists public\.player_card_drop_weights/);
  assert.match(source, /card_id uuid primary key references public\.player_cards\(id\) on delete cascade/);
  assert.match(source, /drop_weight numeric not null default 1/);
  assert.match(source, /check \(drop_weight >= 0 and drop_weight <= 1000000\)/);
  assert.match(source, /alter table public\.player_card_drop_weights enable row level security/);
  assert.match(source, /revoke all on public\.player_card_drop_weights from public, anon, authenticated/);
  assert.match(source, /grant select, insert, update, delete on public\.player_card_drop_weights to service_role/);
  assert.match(source, /select id, 1\s+from public\.player_cards/);
});
