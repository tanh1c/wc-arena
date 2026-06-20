import { supabase } from '../lib/supabaseClient';
import type { Database } from '../types/supabase';

export type LeagueRow = Database['public']['Tables']['leagues']['Row'];
export type LeagueMemberRow = Database['public']['Tables']['league_members']['Row'] & {
  profiles: Pick<Database['public']['Tables']['profiles']['Row'], 'username' | 'display_name' | 'points'> | null;
  leagues: LeagueRow | null;
};

export async function listLeagues() {
  const { data, error } = await supabase
    .from('leagues')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data;
}

export async function getLeague(leagueId: string) {
  const { data, error } = await supabase
    .from('leagues')
    .select('*')
    .eq('id', leagueId)
    .single();

  if (error) throw error;
  return data;
}

export async function listCurrentUserLeagueMemberships() {
  const { data, error } = await supabase
    .from('league_members')
    .select('*, leagues(*)')
    .order('joined_at', { ascending: false });

  if (error) throw error;
  return data as LeagueMemberRow[];
}

export async function listLeagueMembers(leagueId: string) {
  const { data, error } = await supabase
    .from('league_members')
    .select('*, profiles:user_id(username, display_name, points), leagues(*)')
    .eq('league_id', leagueId)
    .order('joined_at', { ascending: true })
    .limit(8);

  if (error) throw error;
  return data as LeagueMemberRow[];
}
