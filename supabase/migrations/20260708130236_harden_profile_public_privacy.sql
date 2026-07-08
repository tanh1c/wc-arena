drop policy if exists profiles_public_read on public.profiles;

create policy profiles_read_public_fields on public.profiles
  for select to anon, authenticated using (true);

revoke select on public.profiles from anon, authenticated;

grant select (id, username, display_name, avatar_url, avatar_bg_color, country_code, fan_club_team_id, points, rank, accuracy, exact_scores, current_streak, best_streak, created_at) on public.profiles to anon, authenticated;
