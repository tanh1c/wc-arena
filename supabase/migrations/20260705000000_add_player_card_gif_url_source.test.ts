import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

test('player cards migration adds optional GIF URL storage', () => {
  const source = readFileSync('supabase/migrations/20260705000000_add_player_card_gif_url.sql', 'utf8');

  assert.match(source, /alter table public\.player_cards/);
  assert.match(source, /add column if not exists gif_url text/);
});
