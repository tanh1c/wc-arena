import { type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { jsonResponse as sharedJsonResponse, requireAdminUser } from '../_shared/authGuards.ts';
import { buildConfirmedBracketAdvancement, type BracketMatchRow, type BracketTeamRow } from '../_shared/bracketAdvancement.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type UpdateMatchResultBody = {
  matchId: string;
  homeScore: number;
  awayScore: number;
};

function jsonResponse(body: unknown, status = 200) {
  return sharedJsonResponse(corsHeaders, body, status);
}

async function advanceBracket(supabase: SupabaseClient) {
  const { data: matches, error: matchesError } = await supabase
    .from('matches')
    .select('id, home_team_id, away_team_id, stage, group_code, status, home_score, away_score, espn_home_winner, espn_away_winner')
    .like('id', 'wc2026-%')
    .order('kickoff_at', { ascending: true });
  const { data: teams, error: teamsError } = await supabase.from('teams').select('id, name, short_name, country_code, group_code');

  if (matchesError) throw matchesError;
  if (teamsError) throw teamsError;

  const teamMap = new Map(((teams ?? []) as BracketTeamRow[]).map((team) => [team.id, team]));
  const updates = buildConfirmedBracketAdvancement((matches ?? []) as BracketMatchRow[], teamMap);

  for (const update of updates) {
    const { matchId, ...values } = update;
    const { error } = await supabase.from('matches').update(values).eq('id', matchId);
    if (error) throw error;
  }

  return { advancedMatches: updates.length, advancedSlots: updates.reduce((sum, update) => sum + Number(Boolean(update.home_team_id)) + Number(Boolean(update.away_team_id)), 0) };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const auth = await requireAdminUser(req, corsHeaders);
  if (auth instanceof Response) return auth;
  const { supabase, user } = auth;

  let body: UpdateMatchResultBody;
  try {
    body = await req.json() as UpdateMatchResultBody;
  } catch {
    return jsonResponse({ error: 'Invalid JSON payload' }, 400);
  }

  if (!body.matchId || !Number.isInteger(body.homeScore) || !Number.isInteger(body.awayScore) || body.homeScore < 0 || body.awayScore < 0) {
    return jsonResponse({ error: 'Invalid match result payload' }, 400);
  }

  const { data: match, error: updateError } = await supabase
    .from('matches')
    .update({
      home_score: body.homeScore,
      away_score: body.awayScore,
      status: 'finished',
      result_updated_at: new Date().toISOString(),
    })
    .eq('id', body.matchId)
    .select('*')
    .single();

  if (updateError || !match) {
    return jsonResponse({ error: updateError?.message ?? 'Match not found' }, updateError ? 500 : 404);
  }

  const advancement = await advanceBracket(supabase);

  await supabase.from('admin_audit_logs').insert({
    actor_id: user.id,
    action: 'match_result_imported',
    entity_type: 'match',
    entity_id: body.matchId,
    description: `Updated result to ${body.homeScore}-${body.awayScore}; advanced ${advancement.advancedSlots} bracket slots.`,
    severity: 'info',
  });

  return jsonResponse({ match, ...advancement });
});
