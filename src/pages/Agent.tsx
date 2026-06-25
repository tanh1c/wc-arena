import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { Bot, Loader2, RotateCcw, Send, ShieldAlert, Trophy } from 'lucide-react';
import AppShell from '../components/layout/AppShell';
import { useAuth } from '../lib/auth';
import { listMatches, type MatchRow } from '../services/matches';
import { sendAgentMessage } from '../services/agent';
import { getTeamMap, type TeamRow } from '../services/teams';
import { getErrorMessage } from '../services/serviceTypes';
import { renderAgentMarkdown } from '../lib/agentMarkdown';
import { appendAgentPromptText, getAgentMatchSelectionPrompt } from '../lib/agentPrompt';
import type { ThemeControls } from '../App';

type AgentProps = {
  themeControls: ThemeControls;
};

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

function formatMatchOption(match: MatchRow, teams: Map<string, TeamRow>) {
  const home = teams.get(match.home_team_id)?.short_name ?? match.home_team_id;
  const away = teams.get(match.away_team_id)?.short_name ?? match.away_team_id;
  const date = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(match.kickoff_at));
  return `${home} vs ${away} - ${date}`;
}

function formatUpcomingMatch(match: MatchRow, teams: Map<string, TeamRow>, locale: string) {
  const home = teams.get(match.home_team_id)?.short_name ?? match.home_team_id;
  const away = teams.get(match.away_team_id)?.short_name ?? match.away_team_id;
  const date = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(match.kickoff_at));
  return { home, away, date };
}

function createMessage(role: ChatMessage['role'], content: string): ChatMessage {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    role,
    content,
  };
}

export default function Agent({ themeControls }: AgentProps) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const initialMatchId = searchParams.get('match_id') ?? '';
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [teams, setTeams] = useState<Map<string, TeamRow>>(new Map());
  const [selectedMatchId, setSelectedMatchId] = useState(initialMatchId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [loadingContext, setLoadingContext] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastUserMessage = useRef<string>('');
  const scrollAnchorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;
    setLoadingContext(true);
    Promise.all([listMatches(), getTeamMap()])
      .then(([nextMatches, nextTeams]) => {
        if (!active) return;
        setMatches(nextMatches);
        setTeams(nextTeams);
      })
      .catch((nextError) => {
        if (active) setError(getErrorMessage(nextError));
      })
      .finally(() => {
        if (active) setLoadingContext(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const selectedMatch = useMemo(
    () => matches.find((match) => match.id === selectedMatchId),
    [matches, selectedMatchId],
  );
  const upcomingMatches = useMemo(() => {
    const now = Date.now();
    return matches
      .filter((match) => match.status !== 'finished' && match.status !== 'cancelled' && match.status !== 'postponed' && new Date(match.kickoff_at).getTime() >= now)
      .slice(0, 4);
  }, [matches]);
  const locale = i18n.resolvedLanguage === 'vi' ? 'vi' : 'en';

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [error, loading, messages.length]);

  async function runTurn(message: string) {
    if (!message.trim() || loading) return;
    setLoading(true);
    setError(null);
    lastUserMessage.current = message;
    setMessages((current) => [...current, createMessage('user', message)]);

    try {
      const response = await sendAgentMessage({
        message,
        session_id: sessionId,
        match_id: selectedMatchId || undefined,
      });
      setSessionId(response.session_id);
      setMessages((current) => [
        ...current,
        createMessage('assistant', response.answer),
      ]);
    } catch (nextError) {
      setError(getErrorMessage(nextError));
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const message = input.trim();
    if (!message) return;
    setInput('');
    void runTurn(message);
  }

  function handleRetry() {
    if (!lastUserMessage.current) return;
    void runTurn(lastUserMessage.current);
  }

  function selectMatchForPrompt(matchId: string) {
    setSelectedMatchId(matchId);
    const match = matches.find((item) => item.id === matchId);
    if (!match) return;
    setInput((current) => appendAgentPromptText(current, getAgentMatchSelectionPrompt(match, teams)));
  }

  return (
    <AppShell themeControls={themeControls} fullHeight>
      <div className="h-[calc(100dvh-84px)] p-3 sm:p-4 lg:p-6">
        <div className="h-full border-4 border-main bg-card shadow-[6px_6px_0_var(--color-shadow)] flex flex-col overflow-hidden">
          <div className="bg-main text-inv px-4 py-3 border-b-4 border-main flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 border-2 border-main bg-c3 text-main flex items-center justify-center shadow-[2px_2px_0_var(--color-shadow)]">
                <Bot size={22} strokeWidth={3} />
              </div>
              <div className="min-w-0">
                <h1 className="font-black uppercase text-lg sm:text-2xl leading-none truncate">We Speak Football</h1>
                <div className="font-black uppercase text-[10px] text-c1 mt-1 truncate">{t('appPages.agent.subtitle')}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={selectedMatchId}
                onChange={(event) => {
                  const nextMatchId = event.target.value;
                  setSelectedMatchId(nextMatchId);
                  if (nextMatchId) selectMatchForPrompt(nextMatchId);
                }}
                disabled={loadingContext}
                className="max-w-full sm:w-[360px] border-2 border-main bg-card text-main px-3 py-2 font-black uppercase text-[10px] shadow-[2px_2px_0_var(--color-shadow)] outline-none"
              >
                <option value="">{t('appPages.agent.noMatchSelected')}</option>
                {matches.map((match) => (
                  <option key={match.id} value={match.id}>
                    {formatMatchOption(match, teams)}
                  </option>
                ))}
              </select>
              {selectedMatch && (
                <Link to={`/matches/${selectedMatch.id}`} className="h-10 w-10 shrink-0 border-2 border-main bg-c1 text-main flex items-center justify-center shadow-[2px_2px_0_var(--color-shadow)]" aria-label={t('appPages.agent.openMatch')}>
                  <Trophy size={18} strokeWidth={3} />
                </Link>
              )}
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto bg-page p-3 sm:p-4 flex flex-col gap-3">
            {!user && (
              <div className="border-4 border-main bg-c5 text-main p-4 font-black uppercase text-xs flex items-center gap-3">
                <ShieldAlert size={18} strokeWidth={3} />
                <span>{t('appPages.agent.signInRequired')}</span>
              </div>
            )}

            {messages.length === 0 && (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                  {[
                    { label: t('appPages.agent.quickStarts.matchPreview'), prompt: t('appPages.agent.quickPrompts.matchPreview') },
                    { label: t('appPages.agent.quickStarts.predictionHelp'), prompt: t('appPages.agent.quickPrompts.predictionHelp') },
                    { label: t('appPages.agent.quickStarts.teamContext'), prompt: t('appPages.agent.quickPrompts.teamContext') },
                  ].map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => setInput((current) => appendAgentPromptText(current, item.prompt))}
                      className="border-4 border-main bg-card hover:bg-muted p-4 text-left font-black uppercase shadow-[4px_4px_0_var(--color-shadow)]"
                    >
                      <span className="text-xs text-subtle block mb-2">{t('appPages.agent.start')}</span>
                      <span className="text-lg">{item.label}</span>
                    </button>
                  ))}
                </div>

                {upcomingMatches.length > 0 && (
                  <section className="border-[3px] border-main bg-card/70 opacity-80 shadow-[4px_4px_0_var(--color-shadow)]">
                    <div className="border-b-[3px] border-main bg-muted/80 px-3 py-2 font-black uppercase text-[10px] text-subtle flex items-center justify-between gap-3">
                      <span>{t('appPages.agent.upcomingFixtures')}</span>
                      <span>{t('appPages.agent.tapFixture')}</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
                      {upcomingMatches.map((match) => {
                        const fixture = formatUpcomingMatch(match, teams, locale);
                        return (
                          <button
                            key={match.id}
                            type="button"
                            onClick={() => {
                              selectMatchForPrompt(match.id);
                            }}
                            className="min-h-[78px] text-left p-3 border-b-2 md:border-r-2 xl:border-b-0 last:border-r-0 border-main bg-page/60 hover:bg-card transition-colors"
                          >
                            <div className="font-black uppercase text-xs text-main truncate">{fixture.home} vs {fixture.away}</div>
                            <div className="mt-1 font-bold uppercase text-[10px] text-subtle">{fixture.date}</div>
                            <div className="mt-2 font-black uppercase text-[9px] text-c2">{match.stage}{match.group_code ? ` - ${t('ui.groupLabel', { group: match.group_code })}` : ''}</div>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                )}
              </>
            )}

            {messages.map((message) => (
              <div key={message.id} className={`max-w-[900px] ${message.role === 'user' ? 'self-end' : 'self-start'} w-fit`}>
                {message.role === 'assistant' ? (
                  <div
                    className="agent-markdown border-[3px] border-main bg-card text-main p-3 sm:p-4 shadow-[4px_4px_0_var(--color-shadow)] font-bold text-sm leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: renderAgentMarkdown(message.content) }}
                  />
                ) : (
                  <div className="border-[3px] border-main p-3 sm:p-4 shadow-[4px_4px_0_var(--color-shadow)] font-bold text-sm leading-relaxed whitespace-pre-wrap bg-c2 text-inv">
                    {message.content}
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="self-start border-[3px] border-main bg-card p-3 font-black uppercase text-xs flex items-center gap-2 shadow-[4px_4px_0_var(--color-shadow)]">
                <Loader2 className="animate-spin" size={16} strokeWidth={3} />
                {t('appPages.agent.thinking')}
              </div>
            )}
            <div ref={scrollAnchorRef} aria-hidden="true" />
          </div>

          {error && (
            <div className="border-t-4 border-main bg-c5 text-main px-4 py-3 font-black uppercase text-xs flex items-center justify-between gap-3">
              <span>{error}</span>
              <button type="button" onClick={handleRetry} disabled={!lastUserMessage.current || loading} className="border-2 border-main bg-card px-3 py-2 shadow-[2px_2px_0_var(--color-shadow)] flex items-center gap-2 disabled:opacity-50">
                <RotateCcw size={14} strokeWidth={3} />
                {t('appPages.agent.retry')}
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="border-t-4 border-main bg-card p-3 sm:p-4 flex gap-3">
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              disabled={loading || !user}
              className="min-w-0 flex-1 border-[3px] border-main bg-page px-3 py-3 font-bold text-sm outline-none shadow-[3px_3px_0_var(--color-shadow)] disabled:bg-muted disabled:text-subtle"
              placeholder={t('appPages.agent.inputPlaceholder')}
            />
            <button type="submit" disabled={loading || !input.trim() || !user} className="w-12 sm:w-auto sm:px-5 border-[3px] border-main bg-c3 text-main font-black uppercase flex items-center justify-center gap-2 shadow-[3px_3px_0_var(--color-shadow)] disabled:bg-muted disabled:text-subtle">
              <Send size={18} strokeWidth={3} />
              <span className="hidden sm:inline">{t('appPages.agent.send')}</span>
            </button>
          </form>
        </div>
      </div>
    </AppShell>
  );
}
