import type { Database } from '../types/supabase';
import type { LeaderboardEntryWithProfile } from './leaderboard';

export type PredictionLeaderboardRow = Database['public']['Functions']['get_prediction_leaderboard']['Returns'][number];
export type PredictionLeaderboardEntry = LeaderboardEntryWithProfile & {
  average_points: number;
  predicted_matches: number;
  prediction_points: number;
  stage: string;
  metric: string;
};

export type PredictionEfficiencyLeaderboardRow = Database['public']['Functions']['get_prediction_efficiency_leaderboard']['Returns'][number];
export type PredictionEfficiencyLeaderboardEntry = PredictionLeaderboardEntry;

type PredictionRow = PredictionLeaderboardRow | (PredictionEfficiencyLeaderboardRow & { stage?: string; metric?: string });

function mapPredictionRow(row: PredictionRow, stage: string, metric: string): PredictionLeaderboardEntry {
  return {
    id: `prediction-${metric}-${stage}-${row.user_id}`,
    scope: 'prediction_efficiency',
    league_id: null,
    user_id: row.user_id,
    rank: row.rank,
    previous_rank: null,
    points: row.prediction_points,
    exact_scores: row.exact_scores,
    accuracy: row.accuracy,
    streak: row.streak,
    updated_at: row.last_scored_at,
    average_points: row.average_points,
    predicted_matches: row.predicted_matches,
    prediction_points: row.prediction_points,
    stage,
    metric,
    profiles: {
      username: row.username,
      display_name: row.display_name,
      avatar_url: row.avatar_url,
      avatar_bg_color: row.avatar_bg_color,
      country_code: row.country_code,
    },
  };
}

export function mapPredictionLeaderboardRow(row: PredictionLeaderboardRow): PredictionLeaderboardEntry {
  return mapPredictionRow(row, row.stage, row.metric);
}

export function mapPredictionEfficiencyRow(row: PredictionEfficiencyLeaderboardRow): PredictionEfficiencyLeaderboardEntry {
  return mapPredictionRow(row, 'all', 'efficiency');
}
