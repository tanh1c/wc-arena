revoke select on public.match_lab_runs from authenticated;

grant select (
  id,
  user_id,
  status,
  formation,
  bot_id,
  player_squad,
  bot_squad,
  hotspot_index,
  home_score,
  away_score,
  broadcast_timeline,
  final_report,
  fun_rating,
  clarity_rating,
  fairness_rating,
  feedback_text,
  created_at,
  updated_at,
  completed_at
) on public.match_lab_runs to authenticated;
