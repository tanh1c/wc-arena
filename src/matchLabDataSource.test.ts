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

function latestMigrationSourceContaining(needle: string) {
  const sources = readdirSync(migrationsDir)
    .filter((entry) => entry.endsWith('.sql'))
    .sort()
    .map((entry) => readFileSync(join(migrationsDir, entry), 'utf8'));
  const source = sources.reverse().find((content) => content.includes(needle));
  assert.ok(source, `missing migration containing ${needle}`);
  return source;
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

test('effective stats are database-derived and browser-read-only', () => {
  const source = migrationSource('add_player_card_effective_stats');

  assert.match(source, /effective_stats jsonb not null/i);
  assert.match(source, /private\.recompute_player_card_effective_stats/i);
  assert.match(source, /player_card_gameplay_profiles_effective_stats_after_raw_stats/i);
  assert.match(source, /player_cards_effective_stats_after_rarity/i);
  assert.match(source, /revoke execute on function private\.recompute_player_card_effective_stats\(\) from public, anon, authenticated/i);
  assert.doesNotMatch(source, /grant (insert|update|delete|all) on public\.player_card_gameplay_profiles to authenticated/i);
});

test('effective stats preserve archetypes inside explicit rarity power budgets', () => {
  const source = latestMigrationSourceContaining('private.recompute_player_card_effective_stats');

  assert.match(source, /when 'Common' then 50::numeric[\s\S]*when 'Common' then 60::numeric/i);
  assert.match(source, /when 'GOAT' then 98::numeric[\s\S]*when 'GOAT' then 100::numeric/i);
  assert.match(source, /when position = 'GK' then 'GK'/i);
  assert.match(source, /when stat\.key in \('Total Stats', 'Base Stats', 'TotalStats', 'total_stats'\) then false/i);
  assert.match(source, /'OVR', round\(least\(band\.maximum_value, greatest\(band\.minimum_value,/is);
  assert.doesNotMatch(source, /when 'GOAT' then 3\.5/i);
});

test('match lab uses persisted effective stats, enforces bot bands, and hides raw stats', () => {
  const source = readFileSync('agent-service/app/match_lab/service.py', 'utf8');

  assert.match(source, /player_card_gameplay_profiles\(raw_stats, effective_stats\)/);
  assert.match(source, /start_index=row\["hotspot_index"\]/);
  assert.match(source, /initial_timeline=row\["broadcast_timeline"\]/);
  assert.match(source, /"resolver_state": None/);
  assert.match(source, /\.eq\("id", row\["id"\]\)\.eq\("user_id", row\["user_id"\]\)/);
  assert.doesNotMatch(source, /_catalog_profiles\(access_token\)/);
  assert.match(source, /def _matches_ovr_band/);
  assert.match(source, /_matches_ovr_band\(_profile\(candidate, "effective_stats"\) or \{\}, recipe\["ovr_band"\]\)/);
  assert.match(source, /def sanitize_xi/);
  assert.match(source, /"player_xi": sanitize_xi\(state\["home_xi"\]\)/);
  assert.match(source, /"bot_xi": sanitize_xi\(state\["away_xi"\]\)/);
  assert.doesNotMatch(source, /"player_xi": player_xi/);
  assert.match(source, /"strengths": \{side:/);
  assert.match(source, /for key in \("slot_id", "card_id", "owned_card_id", "position", "rarity"\)/);
  assert.match(source, /def sanitize_bot_preview_xi/);
  assert.match(source, /sanitize_bot_preview_xi\(_bot_xi\(access_token, bot_id\)\)/);
  assert.match(source, /"name", "position", "rarity", "team", "league", "nation_region", "image_url"/);
  assert.doesNotMatch(source, /def sanitize_bot_preview_xi[^\n]*\n[^\n]*"effective_stats"/);
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

test('paused Match Lab resolver state is server-only', () => {
  const migration = migrationSource('match_lab_resume_state');
  const service = readFileSync('agent-service/app/match_lab/service.py', 'utf8');
  const access = latestMigrationSourceContaining('revoke select on public.match_lab_runs from authenticated');

  assert.match(migration, /add column resolver_state jsonb/i);
  assert.match(access, /revoke select on public\.match_lab_runs from authenticated/i);
  assert.match(access, /grant select \([\s\S]*completed_at[\s\S]*\) on public\.match_lab_runs to authenticated/i);
  assert.doesNotMatch(access, /resolver_state/i);
  assert.doesNotMatch(access, /\bseed\b/i);
  assert.match(service, /"resolver_state": \{"home_xi": home_xi, "away_xi": away_xi/);
  assert.match(service, /"resolver_state": None/);
  assert.doesNotMatch(service, /select\([^\n]*resolver_state/);
});
