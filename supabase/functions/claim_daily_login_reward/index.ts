import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type ClaimDailyLoginRewardRow = {
  claimed: boolean;
  already_claimed: boolean;
  points_awarded: number;
  reward_date: string;
  week_start_date: string;
  weekday: number;
  total_points: number;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function getProfileUsername(user: { id: string; email?: string; user_metadata?: Record<string, unknown> }) {
  const metadataUsername = user.user_metadata?.username;
  const requestedUsername = typeof metadataUsername === 'string' ? metadataUsername.trim() : '';
  const baseUsername = requestedUsername || user.email?.split('@')[0]?.trim() || 'player';
  return `${baseUsername}-${user.id.slice(0, 8)}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return jsonResponse({ error: 'Missing authorization header' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: 'Missing Supabase server config' }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const token = authHeader.replace('Bearer ', '');
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({
      id: userData.user.id,
      username: getProfileUsername(userData.user),
      email: userData.user.email,
      role: 'user',
    }, { onConflict: 'id', ignoreDuplicates: true });

  if (profileError) {
    return jsonResponse({ error: profileError.message }, 500);
  }

  const { data, error } = await supabase.rpc('claim_daily_login_reward', {
    target_user_id: userData.user.id,
  });

  if (error) {
    return jsonResponse({ error: error.message }, 500);
  }

  const reward = Array.isArray(data) ? data[0] as ClaimDailyLoginRewardRow | undefined : undefined;
  if (!reward) {
    return jsonResponse({ error: 'Daily check-in response was empty' }, 500);
  }

  return jsonResponse({
    claimed: reward.claimed,
    alreadyClaimed: reward.already_claimed,
    pointsAwarded: reward.points_awarded,
    rewardDate: reward.reward_date,
    weekStartDate: reward.week_start_date,
    weekday: reward.weekday,
    totalPoints: reward.total_points,
  });
});
