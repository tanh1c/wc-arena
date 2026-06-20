alter table public.predictions
  add column if not exists prediction_type text not null default 'exact_score';

alter table public.predictions
  alter column home_score drop not null,
  alter column away_score drop not null;

alter table public.predictions
  drop constraint if exists predictions_prediction_type_check,
  add constraint predictions_prediction_type_check
  check (prediction_type in ('exact_score', 'outcome_only'));

alter table public.predictions
  drop constraint if exists predictions_prediction_type_scores_check,
  add constraint predictions_prediction_type_scores_check
  check (
    (
      prediction_type = 'exact_score'
      and home_score is not null
      and away_score is not null
    )
    or (
      prediction_type = 'outcome_only'
      and home_score is null
      and away_score is null
    )
  );

alter table public.prediction_scores
  add column if not exists goal_difference_bonus integer not null default 0,
  add column if not exists team_score_bonus integer not null default 0;
