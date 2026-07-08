import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';

test('profile privacy migration removes public email and role reads', () => {
  const migration = readdirSync('supabase/migrations')
    .filter((file) => file.endsWith('_harden_profile_public_privacy.sql'))
    .sort()
    .at(-1);

  assert.ok(migration);
  const source = readFileSync(`supabase/migrations/${migration}`, 'utf8');

  assert.match(source, /drop policy if exists profiles_public_read on public\.profiles/);
  assert.match(source, /revoke select on public\.profiles from anon, authenticated/);
  assert.match(source, /grant select \(id, username, display_name, avatar_url, avatar_bg_color, country_code, fan_club_team_id, points, rank, accuracy, exact_scores, current_streak, best_streak, created_at\) on public\.profiles to anon, authenticated/);
  assert.doesNotMatch(source, /grant select \([^)]*email[^)]*\) on public\.profiles to anon/);
  assert.doesNotMatch(source, /grant select \([^)]*email[^)]*\) on public\.profiles to authenticated/);
  assert.doesNotMatch(source, /grant select \([^)]*role[^)]*\) on public\.profiles to anon/);
  assert.doesNotMatch(source, /grant select \([^)]*role[^)]*\) on public\.profiles to authenticated/);
});

test('admin role lookup uses an authenticated function instead of direct profile role select', () => {
  const profileService = readFileSync('src/services/profile.ts', 'utf8');
  const guardSource = readFileSync('supabase/functions/_shared/authGuards.ts', 'utf8');

  assert.match(profileService, /functions\.invoke<\{ role: 'user' \| 'admin' \}>\('get_current_user_role'/);
  assert.doesNotMatch(profileService, /\.from\('profiles'\)[\s\S]*?\.select\('role'\)/);
  assert.match(guardSource, /export async function getCurrentUserRole/);
  assert.match(guardSource, /requireAuthenticatedUser\(req, corsHeaders\)/);
  assert.match(guardSource, /select\('role'\)/);
});

test('admin RLS policies use a private helper after role column reads are revoked', () => {
  const migration = readdirSync('supabase/migrations')
    .filter((file) => file.endsWith('_fix_admin_rls_after_profile_privacy.sql'))
    .sort()
    .at(-1);

  assert.ok(migration);
  const source = readFileSync(`supabase/migrations/${migration}`, 'utf8');

  assert.match(source, /create or replace function private\.current_user_is_admin\(\)/);
  assert.match(source, /security definer/);
  assert.match(source, /grant execute on function private\.current_user_is_admin\(\) to authenticated/);
  assert.match(source, /admin_audit_logs_admin_read[\s\S]*private\.current_user_is_admin\(\)/);
  assert.match(source, /user_trust_signals_admin_read[\s\S]*private\.current_user_is_admin\(\)/);
  assert.match(source, /reward_reviews_read[\s\S]*private\.current_user_is_admin\(\)/);
  assert.doesNotMatch(source.split('create policy').slice(1).join('create policy'), /\b(profile|p)\.role\s*=\s*'admin'/);
});
