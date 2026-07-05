import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

test('cards service sends admin player card upserts through manage_cards', () => {
  const source = readFileSync('src/services/cards.ts', 'utf8');

  assert.match(source, /export type AdminPlayerCardInput/);
  assert.match(source, /export async function upsertPlayerCards\(cards: AdminPlayerCardInput\[\]\)/);
  assert.match(source, /supabase\.functions\.invoke<\{ cards: PlayerCard\[\] \}>\('manage_cards'/);
  assert.match(source, /body: \{ action: 'upsertPlayerCards', cards \}/);
  assert.match(source, /getFunctionErrorMessage\(error\)/);
});
