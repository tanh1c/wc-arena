import { supabase } from '../lib/supabaseClient';
import type { Database } from '../types/supabase';
import { cached } from './cache';

export type TopScorerStatRow = Database['public']['Tables']['espn_player_tournament_stats']['Row'];
export type TeamTournamentStatRow = Database['public']['Tables']['espn_team_tournament_stats']['Row'];

export type StatisticsCoverage = {
  normalizedMatches: number;
};

export const TOP_SCORER_FIELDS = 'player_id, player_name, team_id, goals, assists, latest_match_id, latest_clock, updated_at';
export const TEAM_TOURNAMENT_STAT_FIELDS = 'team_id, stat_key, label, total_numeric, matches_sampled, average_numeric, updated_at';

const MATCH_COVERAGE_FIELDS = 'id, espn_stats_normalized_at';
const displayedTeamStatKeys = ['shots', 'shotsOnTarget', 'corners', 'saves', 'fouls', 'yellowCards'];

export async function listTopScorers(limit = 10) {
  return cached(`statistics:top-scorers:${limit}`, 300_000, async () => {
    const { data, error } = await supabase
      .from('espn_player_tournament_stats')
      .select(TOP_SCORER_FIELDS)
      .order('goals', { ascending: false })
      .order('assists', { ascending: false })
      .order('player_name', { ascending: true })
      .limit(limit);

    if (error) throw error;
    return data;
  });
}

export async function listTeamTournamentStats(limit = 12) {
  return cached(`statistics:team-tournament-stats:${limit}`, 300_000, async () => {
    const { data, error } = await supabase
      .from('espn_team_tournament_stats')
      .select(TEAM_TOURNAMENT_STAT_FIELDS)
      .in('stat_key', displayedTeamStatKeys)
      .order('total_numeric', { ascending: false })
      .order('label', { ascending: true })
      .limit(limit);

    if (error) throw error;
    return data;
  });
}

export async function getStatisticsCoverage(): Promise<StatisticsCoverage> {
  return cached('statistics:coverage', 300_000, async () => {
    const { data, error } = await supabase
      .from('matches')
      .select(MATCH_COVERAGE_FIELDS)
      .like('id', 'wc2026-%')
      .not('espn_stats_normalized_at', 'is', null)
      .limit(128);

    if (error) throw error;
    return { normalizedMatches: data.length };
  });
}
