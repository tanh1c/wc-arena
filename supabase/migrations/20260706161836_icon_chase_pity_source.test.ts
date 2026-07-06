import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

test('Icon Chase pity state is protected and enforced transactionally', () => {
  const source = readFileSync('supabase/migrations/20260706161836_icon_chase_pity.sql', 'utf8');

  assert.match(source, /create table if not exists public\.icon_chase_pity_states/);
  assert.match(source, /user_id uuid primary key references auth\.users\(id\) on delete cascade/);
  assert.match(source, /icon_miss_count integer not null default 0/);
  assert.match(source, /check \(icon_miss_count >= 0 and icon_miss_count <= 9\)/);
  assert.match(source, /alter table public\.icon_chase_pity_states enable row level security/);
  assert.match(source, /revoke all on public\.icon_chase_pity_states from public, anon, authenticated/);
  assert.match(source, /grant select, insert, update on public\.icon_chase_pity_states to service_role/);
  assert.match(source, /p_expected_icon_miss_count integer/);
  assert.match(source, /for update/);
  assert.match(source, /PITY_STATE_CHANGED/);
  assert.match(source, /Icon pity guarantee required\./);
  assert.match(source, /update public\.icon_chase_pity_states/);
});
