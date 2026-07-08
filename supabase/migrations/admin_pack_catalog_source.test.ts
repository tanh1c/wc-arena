import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

test('pack catalog migration exposes readable admin-managed packs', () => {
  const source = readFileSync('supabase/migrations/20260708040107_admin_pack_catalog.sql', 'utf8');

  assert.match(source, /create table if not exists public\.card_pack_catalog/);
  assert.match(source, /pack_type text primary key/);
  assert.match(source, /rarity_weights jsonb not null/);
  assert.match(source, /image_path text not null/);
  assert.match(source, /enabled boolean not null default true/);
  assert.match(source, /alter table public\.card_pack_catalog enable row level security/);
  assert.match(source, /create policy card_pack_catalog_read_all/);
  assert.match(source, /grant select on public\.card_pack_catalog to anon, authenticated/);
  assert.match(source, /grant select, insert, update on public\.card_pack_catalog to service_role/);
  assert.match(source, /daily[\s\S]*Starter\.png[\s\S]*premium[\s\S]*Icon\.png/);
});
