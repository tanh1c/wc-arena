import { supabase } from '../lib/supabaseClient';
import { AGENT_UNAVAILABLE_MESSAGE } from './agentMessages';

const agentApiUrl = (import.meta.env.VITE_AGENT_API_URL as string | undefined)?.replace(/\/$/, '') || 'http://localhost:8000';

export type AgentIntent = 'match_preview' | 'prediction_help' | 'team_context' | 'rules_help' | 'general_chat';

export type AgentChatPayload = {
  message: string;
  session_id?: string;
  match_id?: string;
  metadata?: {
    timezone?: string;
    locale?: string;
  };
};

export type AgentChatResponse = {
  answer: string;
  session_id: string;
  intent: AgentIntent;
  used_tools: string[];
};

async function getAccessToken() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const token = data.session?.access_token;
  if (!token) throw new Error('Sign in to use We Speak Football.');
  return token;
}

export async function sendAgentMessage(payload: AgentChatPayload): Promise<AgentChatResponse> {
  const token = await getAccessToken();

  let response: Response;
  try {
    response = await fetch(`${agentApiUrl}/agent/chat`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    throw new Error(AGENT_UNAVAILABLE_MESSAGE);
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = typeof data?.detail === 'string' ? data.detail : 'Agent request failed.';
    throw new Error(detail);
  }

  return data as AgentChatResponse;
}
