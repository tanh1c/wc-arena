insert into public.badges (id, name, description, category, rarity, icon_path, progress_target)
values
  ('first-pick', 'First Pick', 'Submit your first match prediction.', 'skill', 'common', null, 1),
  ('outcome-master', 'Outcome Master', 'Call ten match outcomes correctly.', 'skill', 'rare', null, 10),
  ('group-stage', 'Group Stage Grinder', 'Submit predictions across the group stage.', 'event', 'common', null, 12),
  ('knockout', 'Knockout Specialist', 'Score points during the knockout rounds.', 'event', 'epic', null, 4),
  ('finals', 'Finals Oracle', 'Submit predictions for the final match window.', 'event', 'legendary', null, 1),
  ('top-ranker', 'Top Ranker', 'Reach a top leaderboard tier.', 'rank', 'legendary', null, 1),
  ('daily-return', 'Daily Return', 'Come back on multiple matchdays to keep predicting.', 'social', 'common', null, 7),
  ('league-player', 'League Player', 'Join a league and compete with other players.', 'social', 'rare', null, 1)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  category = excluded.category,
  rarity = excluded.rarity,
  icon_path = excluded.icon_path,
  progress_target = excluded.progress_target;
