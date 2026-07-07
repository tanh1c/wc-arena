import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const source = readdirSync('supabase/migrations')
  .filter((file) => file.endsWith('.sql'))
  .map((file) => readFileSync(join('supabase/migrations', file), 'utf8'))
  .join('\n');

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
