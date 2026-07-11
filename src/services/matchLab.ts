import { supabase } from '../lib/supabaseClient';

const agentApiUrl = (import.meta.env.VITE_AGENT_API_URL as string | undefined)?.replace(/\/$/, '') || 'http://localhost:8000';

export type MatchLabBot = { id: 'starter' | 'pressing-academy' | 'defensive-wall'; formation: '4-3-3' | '4-2-3-1' | '3-5-2'; ovr_band: string; identity: string };
export type MatchLabRun = { status: string; formation: string; bot_id: string; score: { home: number; away: number }; timeline: Array<{ minute: number; type: string; side: string; score: { home: number; away: number }; summary?: string }>; debug?: { hotspots: number; action_sources: Record<string, number>; strengths: Record<string, Record<string, number>>; hotspot_summaries: Array<{ minute: number; side: string; coach_intent: string; local_actors: { carrier: string; support: string[]; opponents: string[] }; action: { type: string; target_slot: string; risk: number; source: string }; outcome: { type: string; score: { home: number; away: number } }; latency_ms: number }> } | null };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!data.session?.access_token) throw new Error('Sign in to use Match Lab.');
  const response = await fetch(`${agentApiUrl}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${data.session.access_token}`, 'Content-Type': 'application/json', ...init?.headers },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(typeof body?.detail === 'string' ? body.detail : 'Match Lab request failed.');
  return body as T;
}

export async function listMatchLabBots() {
  return (await request<{ bots: MatchLabBot[] }>('/match-lab/bots')).bots;
}

export function runMatchLab(formation: string, botId: string, assignments: Record<string, string>, debug: boolean) {
  return request<MatchLabRun>('/match-lab/runs', {
    method: 'POST',
    body: JSON.stringify({ formation, bot_id: botId, xi: Object.entries(assignments).map(([slot_id, owned_card_id]) => ({ slot_id, owned_card_id })), debug }),
  });
}
