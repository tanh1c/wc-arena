import { supabase } from '../lib/supabaseClient';
import type { Database } from '../types/supabase';
import { cached } from './cache';
import { mapPredictionEfficiencyRow, mapPredictionLeaderboardRow } from './leaderboardMapper';
import type { PredictionEfficiencyLeaderboardEntry, PredictionEfficiencyLeaderboardRow, PredictionLeaderboardEntry, PredictionLeaderboardRow } from './leaderboardMapper';

export { mapPredictionEfficiencyRow, mapPredictionLeaderboardRow, type PredictionEfficiencyLeaderboardEntry, type PredictionEfficiencyLeaderboardRow, type PredictionLeaderboardEntry, type PredictionLeaderboardRow } from './leaderboardMapper';

export type LeaderboardEntryRow = Database['public']['Tables']['leaderboard_entries']['Row'];
export type LeaderboardProfile = Pick<Database['public']['Tables']['profiles']['Row'], 'username' | 'display_name' | 'avatar_url' | 'avatar_bg_color' | 'country_code'>;
export type LeaderboardEntryWithProfile = LeaderboardEntryRow & {
  profiles: LeaderboardProfile | null;
};
export type PredictionLeaderboardStage = 'all' | 'group' | 'round32' | 'round16' | 'quarter' | 'semi' | 'final';
export type PredictionLeaderboardMetric = 'total' | 'efficiency';

const LEADERBOARD_ENTRY_FIELDS = 'id, scope, league_id, user_id, rank, previous_rank, points, exact_scores, accuracy, streak, updated_at';
const LEADERBOARD_WITH_PROFILE_FIELDS = `${LEADERBOARD_ENTRY_FIELDS}, profiles:user_id(username, display_name, avatar_url, avatar_bg_color, country_code)`;

export async function listGlobalLeaderboard() {
  return cached('leaderboard:global', 60_000, async () => {
    const { data, error } = await supabase
      .from('leaderboard_entries')
      .select(LEADERBOARD_WITH_PROFILE_FIELDS)
      .eq('scope', 'global')
      .order('rank', { ascending: true })
      .limit(100);

    if (error) throw error;
    return data as LeaderboardEntryWithProfile[];
  });
}

export async function listLeagueLeaderboard(leagueId: string) {
  return cached(`leaderboard:league:${leagueId}`, 60_000, async () => {
    const { data, error } = await supabase
      .from('leaderboard_entries')
      .select(LEADERBOARD_WITH_PROFILE_FIELDS)
      .eq('scope', 'league')
      .eq('league_id', leagueId)
      .order('rank', { ascending: true })
      .limit(100);

    if (error) throw error;
    return data as LeaderboardEntryWithProfile[];
  });
}

export async function listPredictionEfficiencyLeaderboard() {
  return cached('leaderboard:prediction-efficiency', 60_000, async () => {
    const { data, error } = await supabase.rpc('get_prediction_efficiency_leaderboard');

    if (error) throw error;
    return (data ?? []).map(mapPredictionEfficiencyRow);
  });
}

export async function listPredictionLeaderboard(stage: PredictionLeaderboardStage, metric: PredictionLeaderboardMetric) {
  return cached(`leaderboard:prediction:${stage}:${metric}`, 60_000, async () => {
    const { data, error } = await supabase.rpc('get_prediction_leaderboard', {
      target_stage: stage === 'all' ? null : stage,
      target_metric: metric,
    });

    if (error) throw error;
    return (data ?? []).map(mapPredictionLeaderboardRow);
  });
}
