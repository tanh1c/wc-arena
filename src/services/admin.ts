import { supabase } from '../lib/supabaseClient';
import type { Database } from '../types/supabase';

export type AdminAuditLogRow = Database['public']['Tables']['admin_audit_logs']['Row'];
export type AdminChecklistItemRow = Database['public']['Tables']['admin_checklist_items']['Row'];
export type UserTrustSignalRow = Database['public']['Tables']['user_trust_signals']['Row'];
export type RewardReviewRow = Database['public']['Tables']['reward_reviews']['Row'];
export type AdminPredictionRow = Database['public']['Tables']['predictions']['Row'] & {
  profiles: Pick<Database['public']['Tables']['profiles']['Row'], 'username' | 'display_name'> | null;
  matches: Database['public']['Tables']['matches']['Row'] | null;
};

export async function updateMatchResult(input: { matchId: string; homeScore: number; awayScore: number }) {
  const { data, error } = await supabase.functions.invoke('update_match_result', { body: input });
  if (error) throw error;
  return data;
}

export async function recalculateScores() {
  const { data, error } = await supabase.functions.invoke('recalculate_scores', { body: {} });
  if (error) throw error;
  return data;
}

export async function listAdminAuditLogs() {
  const { data, error } = await supabase
    .from('admin_audit_logs')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as AdminAuditLogRow[];
}

export async function listAdminChecklistItems() {
  const { data, error } = await supabase
    .from('admin_checklist_items')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('id', { ascending: true });

  if (error) throw error;
  return data as AdminChecklistItemRow[];
}

export async function listUserTrustSignalsForAdmin() {
  const { data, error } = await supabase
    .from('user_trust_signals')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as UserTrustSignalRow[];
}

export async function listRewardReviewsForAdmin() {
  const { data, error } = await supabase
    .from('reward_reviews')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return data as RewardReviewRow[];
}

export async function listRecentPredictionsForAdmin() {
  const { data, error } = await supabase
    .from('predictions')
    .select('*, profiles:user_id(username, display_name), matches(*)')
    .order('updated_at', { ascending: false })
    .limit(5);

  if (error) throw error;
  return data as AdminPredictionRow[];
}
