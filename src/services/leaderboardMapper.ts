import type { Database } from '../types/supabase';
import type { LeaderboardEntryWithProfile } from './leaderboard';

export type PredictionEfficiencyLeaderboardRow = Database['public']['Functions']['get_prediction_efficiency_leaderboard']['Returns'][number];
export type PredictionEfficiencyLeaderboardEntry = LeaderboardEntryWithProfile & {
  average_points: number;
  predicted_matches: number;
  prediction_points: number;
};

export function mapPredictionEfficiencyRow(row: PredictionEfficiencyLeaderboardRow): PredictionEfficiencyLeaderboardEntry {
  return {
    id: `prediction-efficiency-${row.user_id}`,
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
    profiles: {
      username: row.username,
      display_name: row.display_name,
      avatar_url: row.avatar_url,
      avatar_bg_color: row.avatar_bg_color,
      country_code: row.country_code,
    },
  };
}
