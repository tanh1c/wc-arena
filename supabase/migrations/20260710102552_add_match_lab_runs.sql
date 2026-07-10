create table public.match_lab_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('running', 'paused', 'completed', 'abandoned')),
  formation text not null check (formation in ('4-3-3', '4-2-3-1', '3-5-2')),
  bot_id text not null check (bot_id in ('starter', 'pressing-academy', 'defensive-wall')),
  player_squad jsonb not null,
  bot_squad jsonb not null,
  seed text not null,
  hotspot_index smallint not null default 0 check (hotspot_index between 0 and 14),
  home_score smallint not null default 0 check (home_score >= 0),
  away_score smallint not null default 0 check (away_score >= 0),
  broadcast_timeline jsonb not null default '[]'::jsonb,
  final_report jsonb,
  fun_rating smallint check (fun_rating between 1 and 5),
  clarity_rating smallint check (clarity_rating between 1 and 5),
  fairness_rating smallint check (fairness_rating between 1 and 5),
  feedback_text text check (char_length(feedback_text) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  check (final_report is null or octet_length(final_report::text) <= 25600)
);

create index match_lab_runs_user_created_idx on public.match_lab_runs (user_id, created_at desc);

alter table public.match_lab_runs enable row level security;

create policy match_lab_runs_read_own
  on public.match_lab_runs
  for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.match_lab_runs from public, anon, authenticated;
grant select on public.match_lab_runs to authenticated;

create or replace function public.cleanup_old_operational_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_activity_deleted integer := 0;
  v_audit_deleted integer := 0;
  v_match_lab_deleted integer := 0;
begin
  delete from public.activity_events
  where created_at < now() - interval '90 days';
  get diagnostics v_activity_deleted = row_count;

  delete from public.admin_audit_logs
  where created_at < now() - interval '180 days';
  get diagnostics v_audit_deleted = row_count;

  delete from public.match_lab_runs
  where created_at < now() - interval '90 days';
  get diagnostics v_match_lab_deleted = row_count;

  return jsonb_build_object(
    'activity_deleted', v_activity_deleted,
    'audit_deleted', v_audit_deleted,
    'match_lab_deleted', v_match_lab_deleted
  );
end;
$$;

revoke all on function public.cleanup_old_operational_data() from public, anon, authenticated;
