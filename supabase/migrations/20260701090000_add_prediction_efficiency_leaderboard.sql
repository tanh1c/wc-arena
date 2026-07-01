create or replace function public.get_prediction_efficiency_leaderboard()
returns table (
  rank integer,
  user_id uuid,
  prediction_points integer,
  predicted_matches integer,
  average_points numeric,
  exact_scores integer,
  accuracy numeric,
  streak integer,
  last_scored_at timestamptz,
  username text,
  display_name text,
  avatar_url text,
  avatar_bg_color text,
  country_code text
)
language sql
stable
security definer
set search_path = public
as $$
  with user_scores as (
    select
      p.user_id,
      sum(ps.total)::integer as prediction_points,
      count(*)::integer as predicted_matches,
      count(*) filter (where ps.exact_score > 0)::integer as exact_scores,
      round((count(*) filter (where ps.outcome in ('exact', 'correct'))::numeric / count(*)) * 100, 0) as accuracy,
      max(pr.current_streak)::integer as streak,
      max(ps.calculated_at) as last_scored_at,
      min(p.created_at) as first_prediction_at
    from public.prediction_scores ps
    join public.predictions p on p.id = ps.prediction_id
    join public.matches m on m.id = p.match_id
    join public.profiles pr on pr.id = p.user_id
    where ps.calculated_at is not null
      and p.status <> 'void'
      and m.status = 'finished'
      and m.home_score is not null
      and m.away_score is not null
    group by p.user_id
    having count(*) >= 5
  ),
  ranked as (
    select
      row_number() over (
        order by
          (prediction_points::numeric / predicted_matches) desc,
          prediction_points desc,
          exact_scores desc,
          predicted_matches desc,
          first_prediction_at asc,
          user_id asc
      )::integer as rank,
      *
    from user_scores
  )
  select
    ranked.rank,
    ranked.user_id,
    ranked.prediction_points,
    ranked.predicted_matches,
    round(ranked.prediction_points::numeric / ranked.predicted_matches, 2) as average_points,
    ranked.exact_scores,
    coalesce(ranked.accuracy, 0) as accuracy,
    coalesce(ranked.streak, 0) as streak,
    ranked.last_scored_at,
    pr.username,
    pr.display_name,
    pr.avatar_url,
    pr.avatar_bg_color,
    pr.country_code
  from ranked
  join public.profiles pr on pr.id = ranked.user_id
  order by ranked.rank
  limit 100;
$$;

revoke all on function public.get_prediction_efficiency_leaderboard() from public;
grant execute on function public.get_prediction_efficiency_leaderboard() to anon, authenticated;
