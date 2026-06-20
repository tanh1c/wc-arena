import { supabase } from '../lib/supabaseClient';
import type { Database } from '../types/supabase';

export type ActivityEventRow = Database['public']['Tables']['activity_events']['Row'];

export async function listCurrentUserActivity() {
  const { data, error } = await supabase
    .from('activity_events')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as ActivityEventRow[];
}

export async function listLeagueActivity(leagueId: string) {
  const { data, error } = await supabase
    .from('activity_events')
    .select('*')
    .eq('league_id', leagueId)
    .order('created_at', { ascending: false })
    .limit(6);

  if (error) throw error;
  return data as ActivityEventRow[];
}
