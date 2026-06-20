import { supabase } from '../lib/supabaseClient';
import type { Database } from '../types/supabase';

export type RewardReviewRow = Database['public']['Tables']['reward_reviews']['Row'];
export type RewardEligibilityCheckRow = Database['public']['Tables']['reward_eligibility_checks']['Row'];
export type RewardTrustNoteRow = Database['public']['Tables']['reward_trust_notes']['Row'];

export async function listCurrentUserRewardReviews() {
  const { data, error } = await supabase
    .from('reward_reviews')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return data as RewardReviewRow[];
}

export async function listCurrentUserRewardEligibilityChecks() {
  const { data, error } = await supabase
    .from('reward_eligibility_checks')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('id', { ascending: true });

  if (error) throw error;
  return data as RewardEligibilityCheckRow[];
}

export async function listRewardTrustNotes() {
  const { data, error } = await supabase
    .from('reward_trust_notes')
    .select('*')
    .eq('is_public', true)
    .order('sort_order', { ascending: true })
    .order('id', { ascending: true });

  if (error) throw error;
  return data as RewardTrustNoteRow[];
}
