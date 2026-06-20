create table public.daily_login_rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  reward_date date not null,
  points_awarded integer not null default 1 check (points_awarded > 0),
  created_at timestamptz not null default now(),
  unique (user_id, reward_date)
);

alter table public.daily_login_rewards enable row level security;

create policy daily_login_rewards_read_own
on public.daily_login_rewards
for select
to authenticated
using ((select auth.uid()) = user_id);

alter table public.activity_events drop constraint if exists activity_events_type_check;
alter table public.activity_events add constraint activity_events_type_check check (
  type in (
    'prediction_locked',
    'score_calculated',
    'badge_unlocked',
    'rank_changed',
    'league_joined',
    'daily_login_reward'
  )
);

create or replace function public.claim_daily_login_reward(target_user_id uuid)
returns table (
  claimed boolean,
  points_awarded integer,
  reward_date date,
  total_points integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  today date := (now() at time zone 'utc')::date;
  inserted_points integer := 1;
  next_total integer;
begin
  insert into public.daily_login_rewards (user_id, reward_date, points_awarded)
  values (target_user_id, today, inserted_points)
  on conflict (user_id, reward_date) do nothing;

  if not found then
    select points into next_total from public.profiles where id = target_user_id;
    return query select false, 0, today, coalesce(next_total, 0);
    return;
  end if;

  update public.profiles
  set points = points + inserted_points
  where id = target_user_id
  returning points into next_total;

  insert into public.activity_events (type, title, description, user_id, href)
  values (
    'daily_login_reward',
    'Daily check-in complete',
    'You earned 1 point for visiting today.',
    target_user_id,
    '/activity'
  );

  return query select true, inserted_points, today, next_total;
end;
$$;

revoke all on function public.claim_daily_login_reward(uuid) from public, anon, authenticated;
grant execute on function public.claim_daily_login_reward(uuid) to service_role;
