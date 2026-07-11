import { supabase } from '../lib/supabaseClient';

const agentApiUrl = (import.meta.env.VITE_AGENT_API_URL as string | undefined)?.replace(/\/$/, '') || 'http://localhost:8000';

export type MatchLabBot = { id: 'starter' | 'pressing-academy' | 'defensive-wall'; formation: '4-3-3' | '4-2-3-1' | '3-5-2'; ovr_band: string; identity: string };
type Score = { home: number; away: number };
type TimelineEvent = { minute: number; type: string; side: string; score: Score; summary?: string };
export type MatchLabRun = { id: string; status: 'running' | 'paused' | 'completed' | 'abandoned'; formation: string; bot_id: string; hotspot_index: number; score: Score; timeline: TimelineEvent[]; fun_rating?: number | null; clarity_rating?: number | null; fairness_rating?: number | null; feedback_text?: string | null; debug?: { hotspots: number; action_sources: Record<string, number>; strengths: Record<string, Record<string, number>>; hotspot_summaries: Array<{ minute: number; side: string; coach_intent: string; local_actors: { carrier: string; support: string[]; opponents: string[] }; action: { type: string; target_slot: string; risk: number; source: string }; outcome: { type: string; score: Score }; latency_ms: number }> } | null };

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

export async function listMatchLabRuns() {
  return (await request<{ runs: Array<Record<string, unknown>> }>('/match-lab/runs')).runs.map((run) => ({
    id: String(run.id),
    status: run.status as MatchLabRun['status'],
    formation: String(run.formation),
    bot_id: String(run.bot_id),
    hotspot_index: Number(run.hotspot_index),
    score: { home: Number(run.home_score), away: Number(run.away_score) },
    timeline: Array.isArray(run.broadcast_timeline) ? run.broadcast_timeline as TimelineEvent[] : [],
    fun_rating: run.fun_rating as number | null,
    clarity_rating: run.clarity_rating as number | null,
    fairness_rating: run.fairness_rating as number | null,
    feedback_text: run.feedback_text as string | null,
  }));
}

export function runMatchLab(formation: string, botId: string, assignments: Record<string, string>, debug: boolean) {
  return request<MatchLabRun>('/match-lab/runs', {
    method: 'POST',
    body: JSON.stringify({ formation, bot_id: botId, xi: Object.entries(assignments).map(([slot_id, owned_card_id]) => ({ slot_id, owned_card_id })), debug }),
  });
}

export function resumeMatchLabRun(id: string, debug: boolean) {
  return request<MatchLabRun>(`/match-lab/runs/${id}/resume?debug=${debug}`, { method: 'POST' });
}

export function abandonMatchLabRun(id: string) {
  return request<{ id: string; status: 'abandoned' }>(`/match-lab/runs/${id}/abandon`, { method: 'POST' });
}

export function submitMatchLabFeedback(id: string, feedback: Pick<MatchLabRun, 'fun_rating' | 'clarity_rating' | 'fairness_rating' | 'feedback_text'>) {
  return request(`/match-lab/runs/${id}/feedback`, { method: 'POST', body: JSON.stringify(feedback) });
}
