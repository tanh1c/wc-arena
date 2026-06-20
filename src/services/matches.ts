import { supabase } from '../lib/supabaseClient';
import type { Database } from '../types/supabase';

export type MatchRow = Database['public']['Tables']['matches']['Row'];
export type EffectiveMatchStatus = MatchRow['status'];

export function getEffectiveMatchStatus(match: MatchRow, now = new Date()): EffectiveMatchStatus {
  if (['finished', 'live', 'postponed', 'cancelled'].includes(match.status)) return match.status;
  if (new Date(match.lock_at) <= now) return 'locked';
  return match.status;
}

export function isMatchPredictionOpen(match: MatchRow, now = new Date()) {
  return getEffectiveMatchStatus(match, now) === 'open';
}

export async function listMatches() {
  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .like('id', 'wc2026-%')
    .order('kickoff_at', { ascending: true });

  if (error) throw error;
  return data;
}

export async function getMatch(matchId: string) {
  const query = supabase
    .from('matches')
    .select('*')
    .eq('id', matchId);

  const { data, error } = await query.single();

  if (error) throw error;
  return data;
}
