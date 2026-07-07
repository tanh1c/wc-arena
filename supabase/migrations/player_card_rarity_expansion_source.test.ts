import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

test('player card rarity constraint allows six rarity tiers', () => {
  const migrationSource = readdirSync('supabase/migrations')
    .filter((file) => file.endsWith('.sql'))
    .map((file) => readFileSync(join('supabase/migrations', file), 'utf8'))
    .join('\n');

  assert.match(migrationSource, /player_cards_rarity_check/);
  assert.match(migrationSource, /'Common'[\s\S]*'Uncommon'[\s\S]*'Rare'[\s\S]*'Epic'[\s\S]*'Legendary'[\s\S]*'Icon'/);
});
