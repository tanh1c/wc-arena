import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const migrationsDir = 'supabase/migrations';

function migrationSource(name: string) {
  const file = readdirSync(migrationsDir).find((entry) => entry.endsWith(`_${name}.sql`));
  assert.ok(file, `missing ${name} migration`);
  return readFileSync(join(migrationsDir, file), 'utf8');
}

test('gameplay profiles preserve source stats behind read-only RLS', () => {
  const source = migrationSource('add_player_card_gameplay_profiles');

  assert.match(source, /create table public\.player_card_gameplay_profiles/i);
  assert.match(source, /raw_stats jsonb not null/i);
  assert.match(source, /playstyles text\[\]/i);
  assert.match(source, /traits text\[\]/i);
  assert.match(source, /source_image_url text not null/i);
  assert.match(source, /enable row level security/i);
  assert.match(source, /for select to authenticated/i);
  assert.match(source, /grant select on public\.player_card_gameplay_profiles to authenticated/i);
  assert.doesNotMatch(source, /grant (insert|update|delete|all) on public\.player_card_gameplay_profiles to authenticated/i);
});

test('match lab service normalizes catalog stats, enforces bot bands, and hides raw stats', () => {
  const source = readFileSync('agent-service/app/match_lab/service.py', 'utf8');

  assert.match(source, /def _catalog_profiles/);
  assert.match(source, /resolve_match\(seed, player_xi, bot_xi, 12, _catalog_profiles\(access_token\)\)/);
  assert.match(source, /def _matches_ovr_band/);
  assert.match(source, /_matches_ovr_band\(profile, recipe\["ovr_band"\]\)/);
  assert.match(source, /def sanitize_xi/);
  assert.match(source, /"player_xi": sanitize_xi\(player_xi\)/);
  assert.match(source, /"bot_xi": sanitize_xi\(bot_xi\)/);
  assert.doesNotMatch(source, /"player_xi": player_xi/);
  assert.match(source, /"strengths": \{side:/);
  assert.match(source, /for key in \("slot_id", "card_id", "owned_card_id", "position", "rarity"\)/);
});

test('match lab reports are owner-readable, compact, and expire after ninety days', () => {
  const source = migrationSource('add_match_lab_runs');

  assert.match(source, /create table public\.match_lab_runs/i);
  assert.match(source, /user_id uuid not null references auth\.users/i);
  assert.match(source, /status text not null check/i);
  assert.match(source, /octet_length\(final_report::text\) <= 25600/i);
  assert.match(source, /enable row level security/i);
  assert.match(source, /for select to authenticated/i);
  assert.doesNotMatch(source, /for (insert|update|delete) to authenticated/i);
  assert.match(source, /match_lab_runs.*interval '90 days'/is);
  assert.doesNotMatch(source, /grant (insert|update|delete|all) on public\.match_lab_runs to authenticated/i);
});
