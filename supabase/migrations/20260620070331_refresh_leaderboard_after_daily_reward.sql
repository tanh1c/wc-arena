create or replace function public.refresh_global_leaderboard_entries()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.leaderboard_entries (
    scope,
    league_id,
    user_id,
    rank,
    previous_rank,
    points,
    exact_scores,
    accuracy,
    streak,
    updated_at
  )
  select
    'global',
    null,
    ranked.id,
    ranked.next_rank,
    previous.rank,
    ranked.points,
    ranked.exact_scores,
    coalesce(ranked.accuracy, 0),
    ranked.current_streak,
    now()
  from (
    select
      profiles.id,
      profiles.points,
      profiles.exact_scores,
      profiles.accuracy,
      profiles.current_streak,
      row_number() over (
        order by profiles.points desc, profiles.exact_scores desc, coalesce(profiles.accuracy, 0) desc, profiles.created_at asc
      )::integer as next_rank
    from public.profiles
  ) ranked
  left join public.leaderboard_entries previous
    on previous.scope = 'global'
    and previous.league_id is null
    and previous.user_id = ranked.id
  on conflict (user_id) where scope = 'global' and league_id is null
  do update set
    rank = excluded.rank,
    previous_rank = excluded.previous_rank,
    points = excluded.points,
    exact_scores = excluded.exact_scores,
    accuracy = excluded.accuracy,
    streak = excluded.streak,
    updated_at = excluded.updated_at;
end;
$$;

revoke all on function public.refresh_global_leaderboard_entries() from public, anon, authenticated;
grant execute on function public.refresh_global_leaderboard_entries() to service_role;

create or replace function public.claim_daily_login_reward(target_user_id uuid)
returns table(
  claimed boolean,
  already_claimed boolean,
  points_awarded integer,
  reward_date date,
  week_start_date date,
  weekday integer,
  total_points integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  today date := (now() at time zone 'utc')::date;
  current_week_start date := today - (extract(isodow from today)::integer - 1);
  current_weekday integer := extract(isodow from today)::integer;
  inserted_points integer := extract(isodow from today)::integer;
  next_total integer;
begin
  insert into public.daily_login_rewards (user_id, reward_date, week_start_date, weekday, points_awarded)
  values (target_user_id, today, current_week_start, current_weekday, inserted_points)
  on conflict on constraint daily_login_rewards_user_id_reward_date_key do nothing;

  if not found then
    select points into next_total from public.profiles where id = target_user_id;
    return query select false, true, 0, today, current_week_start, current_weekday, coalesce(next_total, 0);
    return;
  end if;

  update public.profiles
  set points = points + inserted_points
  where id = target_user_id
  returning points into next_total;

  perform public.refresh_global_leaderboard_entries();

  insert into public.activity_events (type, title, description, user_id, href)
  values (
    'daily_login_reward',
    'Daily check-in complete',
    'You earned ' || inserted_points || ' points for day ' || current_weekday || ' of this week.',
    target_user_id,
    '/activity'
  );

  return query select true, false, inserted_points, today, current_week_start, current_weekday, next_total;
end;
$$;

revoke all on function public.claim_daily_login_reward(uuid) from public, anon, authenticated;
grant execute on function public.claim_daily_login_reward(uuid) to service_role;

select public.refresh_global_leaderboard_entries();
