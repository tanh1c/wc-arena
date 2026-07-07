import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = readFileSync('supabase/migrations/20260707072334_add_heroes_goat_rarities.sql', 'utf8');

test('Heroes and GOAT migration expands rarity constraint and keeps GOAT terminal for forge', () => {
  assert.match(source, /player_cards_rarity_check/);
  assert.match(source, /'Common'[\s\S]*'Uncommon'[\s\S]*'Rare'[\s\S]*'Epic'[\s\S]*'Legendary'[\s\S]*'Heroes'[\s\S]*'Icon'[\s\S]*'GOAT'/);
  assert.match(source, /p_source_rarity not in \('Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Heroes', 'Icon'\)/);
  assert.doesNotMatch(source, /p_source_rarity not in \('Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'\)/);
  assert.match(source, /grant execute on function public\.forge_card_transaction\(uuid, text, uuid\[\], uuid, integer\) to service_role/);
  assert.doesNotMatch(source, /grant execute on function public\.forge_card_transaction\(uuid, text, uuid\[\], uuid, integer\) to authenticated/);
});
