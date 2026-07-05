import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { AlertTriangle, ClipboardCheck, Radar, ShieldCheck, Trophy } from 'lucide-react';
import AppShell from '../components/layout/AppShell';
import { useAuth } from '../lib/auth';
import { listAdminAuditLogs, listRecentPredictionsForAdmin, listRewardReviewsForAdmin, listUserTrustSignalsForAdmin, recalculateScores, updateMatchResult, type AdminAuditLogRow, type AdminPredictionRow, type RewardReviewRow, type UserTrustSignalRow } from '../services/admin';
import { upsertPlayerCards, type AdminPlayerCardInput, type PlayerCard } from '../services/cards';
import { listGlobalLeaderboard, type LeaderboardEntryWithProfile } from '../services/leaderboard';
import { listMatches, type MatchRow } from '../services/matches';
import { getCurrentUserRole } from '../services/profile';
import { getErrorMessage } from '../services/serviceTypes';
import { getTeamMap, type TeamRow } from '../services/teams';
import { getPublicDisplayName } from '../utils/displayName';
import { formatPredictionPick } from '../utils/predictionDisplay';
import type { ThemeControls } from '../App';

type AdminDashboardProps = {
  themeControls: ThemeControls;
};

type ResultDrafts = Record<string, { homeScore: string; awayScore: string }>;
type ActionState = { loading?: boolean; error?: string; success?: string };

const playerCardImportExample = JSON.stringify([
  {
    name: 'Lionel Messi',
    position: 'RW',
    alternate_positions: 'CAM, ST',
    team: 'Argentina',
    league: 'National Team',
    nation_region: 'Argentina',
    skill_moves: '4',
    footedness: 'Left',
    height: '170 cm',
    weight: '72 kg',
    work_rate_att: 'Medium',
    work_rate_def: 'Low',
    added_on: '2026-07-05',
    image_url: 'https://example.com/messi.png',
    rarity: 'Icon',
  },
], null, 2);

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function getMatchLabel(match: MatchRow, teams: Map<string, TeamRow>) {
  const homeTeam = teams.get(match.home_team_id);
  const awayTeam = teams.get(match.away_team_id);
  return `${homeTeam?.short_name ?? match.home_team_id} vs ${awayTeam?.short_name ?? match.away_team_id}`;
}

export default function AdminDashboard({ themeControls }: AdminDashboardProps) {
  const { t } = useTranslation();
  const { user, loading: authLoading } = useAuth();
  const [role, setRole] = useState<string | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [teams, setTeams] = useState<Map<string, TeamRow>>(new Map());
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntryWithProfile[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLogRow[]>([]);
  const [trustSignals, setTrustSignals] = useState<UserTrustSignalRow[]>([]);
  const [rewardReviews, setRewardReviews] = useState<RewardReviewRow[]>([]);
  const [recentPredictions, setRecentPredictions] = useState<AdminPredictionRow[]>([]);
  const [resultDrafts, setResultDrafts] = useState<ResultDrafts>({});
  const [matchActionState, setMatchActionState] = useState<Record<string, ActionState>>({});
  const [recalcState, setRecalcState] = useState<ActionState>({});
  const [cardImportJson, setCardImportJson] = useState(playerCardImportExample);
  const [cardImportState, setCardImportState] = useState<ActionState>({});
  const [importedCards, setImportedCards] = useState<PlayerCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadAdminData() {
    setLoading(true);
    setError(null);

    try {
      const [nextMatches, nextTeams, nextLeaderboard, nextAuditLogs, nextSignals, nextRewardReviews, nextRecentPredictions] = await Promise.all([
        listMatches(),
        getTeamMap(),
        listGlobalLeaderboard(),
        listAdminAuditLogs(),
        listUserTrustSignalsForAdmin(),
        listRewardReviewsForAdmin(),
        listRecentPredictionsForAdmin(),
      ]);
      setMatches(nextMatches);
      setTeams(nextTeams);
      setLeaderboard(nextLeaderboard);
      setAuditLogs(nextAuditLogs);
      setTrustSignals(nextSignals);
      setRewardReviews(nextRewardReviews);
      setRecentPredictions(nextRecentPredictions);
      setResultDrafts(Object.fromEntries(nextMatches.map((match) => [match.id, {
        homeScore: match.home_score?.toString() ?? '',
        awayScore: match.away_score?.toString() ?? '',
      }])));
    } catch (nextError) {
      setError(getErrorMessage(nextError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!user) {
      setRole(null);
      setRoleLoading(false);
      return;
    }

    let active = true;
    setRoleLoading(true);
    setError(null);

    getCurrentUserRole(user.id)
      .then((nextRole) => {
        if (!active) return;
        setRole(nextRole);
      })
      .catch((nextError) => {
        if (!active) return;
        setError(getErrorMessage(nextError));
      })
      .finally(() => {
        if (active) setRoleLoading(false);
      });

    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    if (role === 'admin') void loadAdminData();
  }, [role]);

  async function saveMatchResult(match: MatchRow) {
    const draft = resultDrafts[match.id];
    const homeScore = Number(draft?.homeScore);
    const awayScore = Number(draft?.awayScore);

    if (!Number.isInteger(homeScore) || !Number.isInteger(awayScore) || homeScore < 0 || awayScore < 0) {
      setMatchActionState((current) => ({ ...current, [match.id]: { error: t('ui.enterWholeScores') } }));
      return;
    }

    setMatchActionState((current) => ({ ...current, [match.id]: { loading: true } }));

    try {
      await updateMatchResult({ matchId: match.id, homeScore, awayScore });
      await loadAdminData();
      setMatchActionState((current) => ({ ...current, [match.id]: { success: t('ui.resultSaved') } }));
    } catch (nextError) {
      setMatchActionState((current) => ({ ...current, [match.id]: { error: getErrorMessage(nextError) } }));
    }
  }

  async function runRecalculation() {
    setRecalcState({ loading: true });

    try {
      const result = await recalculateScores() as { predictionScores?: number; leaderboardEntries?: number };
      await loadAdminData();
      setRecalcState({ success: t('ui.recalcUpdated', { scores: result.predictionScores ?? 0, entries: result.leaderboardEntries ?? 0 }) });
    } catch (nextError) {
      setRecalcState({ error: getErrorMessage(nextError) });
    }
  }

  async function importPlayerCards() {
    setCardImportState({ loading: true });

    try {
      const parsedCards = JSON.parse(cardImportJson) as unknown;
      if (!Array.isArray(parsedCards)) throw new Error('Player cards JSON must be an array.');

      const nextCards = await upsertPlayerCards(parsedCards as AdminPlayerCardInput[]);
      setImportedCards(nextCards);
      setCardImportState({ success: `Imported ${nextCards.length} player cards.` });
    } catch (nextError) {
      setCardImportState({ error: getErrorMessage(nextError) });
    }
  }

  if (authLoading || roleLoading) {
    return (
      <AppShell themeControls={themeControls}>
        <div className="relative z-10 flex flex-col p-4 lg:p-6 gap-4 lg:gap-6 min-h-0">
          <div className="bg-card border-4 border-main p-4 lg:p-6 flex flex-col w-full xl:w-1/2 shadow-[8px_8px_0_0_var(--color-shadow)]">
            <h1 className="text-4xl lg:text-5xl font-black uppercase tracking-tighter mb-1 text-main">{t('ui.adminControlRoom')}</h1>
          </div>
          <div className="bg-card border-4 border-main p-4 lg:p-6 shadow-[8px_8px_0_0_var(--color-shadow)] rounded-sm font-black uppercase text-sm">{t('ui.loadingAdminAccess')}</div>
        </div>
      </AppShell>
    );
  }

  if (!user) {
    return (
      <AppShell themeControls={themeControls}>
        <div className="relative z-10 flex flex-col p-4 lg:p-6 gap-4 lg:gap-6 min-h-0">
          <div className="bg-card border-4 border-main p-4 lg:p-6 flex flex-col w-full xl:w-1/2 shadow-[8px_8px_0_0_var(--color-shadow)]">
            <h1 className="text-4xl lg:text-5xl font-black uppercase tracking-tighter mb-1 text-main">{t('ui.adminControlRoom')}</h1>
          </div>
          <div className="bg-card border-4 border-main p-4 lg:p-6 shadow-[8px_8px_0_0_var(--color-shadow)] rounded-sm font-black uppercase text-sm flex flex-col gap-3">
            <span>{t('ui.signInAdmin')}</span>
            <Link to="/login" className="text-c2 underline">{t('ui.goToLogin')}</Link>
          </div>
        </div>
      </AppShell>
    );
  }

  if (role !== 'admin') {
    return (
      <AppShell themeControls={themeControls}>
        <div className="relative z-10 flex flex-col p-4 lg:p-6 gap-4 lg:gap-6 min-h-0">
          <div className="bg-card border-4 border-main p-4 lg:p-6 flex flex-col w-full xl:w-1/2 shadow-[8px_8px_0_0_var(--color-shadow)]">
            <h1 className="text-4xl lg:text-5xl font-black uppercase tracking-tighter mb-1 text-main">{t('ui.adminControlRoom')}</h1>
          </div>
          <div className="bg-card border-4 border-main p-4 lg:p-6 shadow-[8px_8px_0_0_var(--color-shadow)] rounded-sm font-black uppercase text-sm">{t('ui.adminAccessRequired')}</div>
        </div>
      </AppShell>
    );
  }

  const finishedMatches = matches.filter((match) => match.status === 'finished').length;
  const lockedMatches = matches.filter((match) => match.status === 'locked' || match.status === 'live').length;
  const pendingRewards = rewardReviews.filter((reward) => reward.status === 'pending').length;

  return (
    <AppShell themeControls={themeControls}>
      <div className="relative z-10 flex flex-col p-4 lg:p-6 gap-4 lg:gap-6 min-h-0">
        <div className="bg-card border-4 border-main p-4 lg:p-6 flex flex-col w-full xl:w-1/2 shadow-[8px_8px_0_0_var(--color-shadow)]">
          <h1 className="text-4xl lg:text-5xl font-black uppercase tracking-tighter mb-1 text-main">
            {t('ui.adminControlRoom')}
          </h1>
        </div>

        <div className="bg-card border-4 border-main p-4 lg:p-6 flex flex-col gap-4 lg:gap-6 shadow-[8px_8px_0_0_var(--color-shadow)] rounded-sm">
          {error && <div className="bg-c5 border-4 border-main p-4 font-black uppercase text-sm">{error}</div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 border-b-4 border-main">
            <div className="flex items-center gap-4 border-b-4 sm:border-r-4 xl:border-b-0 border-main p-4 lg:p-5 bg-c1 text-main">
              <div className="shrink-0"><Trophy size={36} strokeWidth={2.5} /></div>
              <div className="flex flex-col justify-center">
                <div className="text-xs uppercase font-black tracking-widest leading-none mb-1 opacity-90">{t('ui.matches')}</div>
                <div className="text-2xl sm:text-3xl font-black leading-none">{loading ? '—' : matches.length}</div>
                <div className="text-[10px] font-bold uppercase mt-1">{t('ui.finishedCount', { count: finishedMatches })}</div>
              </div>
            </div>
            <div className="flex items-center gap-4 border-b-4 xl:border-b-0 xl:border-r-4 border-main p-4 lg:p-5 bg-c2 text-inv">
              <div className="shrink-0"><ClipboardCheck size={36} strokeWidth={2.5} /></div>
              <div className="flex flex-col justify-center">
                <div className="text-xs uppercase font-black tracking-widest leading-none mb-1 opacity-90">{t('nav.items.leaderboard')}</div>
                <div className="text-2xl sm:text-3xl font-black leading-none">{loading ? '—' : leaderboard.length}</div>
                <div className="text-[10px] font-bold uppercase mt-1">{t('ui.lockedLiveMatchesCount', { count: lockedMatches })}</div>
              </div>
            </div>
            <div className="flex items-center gap-4 border-b-4 sm:border-b-0 sm:border-r-4 border-main p-4 lg:p-5 bg-c3 text-main">
              <div className="shrink-0"><Radar size={36} strokeWidth={2.5} /></div>
              <div className="flex flex-col justify-center">
                <div className="text-xs uppercase font-black tracking-widest leading-none mb-1 opacity-90">{t('ui.signals')}</div>
                <div className="text-2xl sm:text-3xl font-black leading-none">{trustSignals.length}</div>
                <div className="text-[10px] font-bold uppercase mt-1">{t('ui.watchReviewQueue')}</div>
              </div>
            </div>
            <div className="flex items-center gap-4 border-main p-4 lg:p-5 bg-c4 text-main">
              <div className="shrink-0"><ShieldCheck size={36} strokeWidth={2.5} /></div>
              <div className="flex flex-col justify-center">
                <div className="text-xs uppercase font-black tracking-widest leading-none mb-1 opacity-90">{t('ui.rewards')}</div>
                <div className="text-2xl sm:text-3xl font-black leading-none">{pendingRewards}</div>
                <div className="text-[10px] font-bold uppercase mt-1">{t('ui.pendingManualReview')}</div>
              </div>
            </div>
          </div>

          <div className="flex flex-col xl:flex-row flex-1">
            <div className="flex-1 border-r-0 xl:border-r-4 border-main flex flex-col bg-card min-w-0">
              <div className="bg-main text-inv font-black px-4 py-3 uppercase tracking-wide text-sm border-b-4 border-main">
                {t('ui.matchOperations')}
              </div>
              <div className="bg-card flex flex-col border-b-4 border-main">
                {loading && <div className="p-4 font-black uppercase text-sm">{t('ui.loadingAdminData')}</div>}
                {!loading && matches.map((match) => {
                  const state = matchActionState[match.id];
                  const draft = resultDrafts[match.id] ?? { homeScore: '', awayScore: '' };

                  return (
                    <div key={match.id} className="grid grid-cols-1 md:grid-cols-[1fr_120px_170px_170px] border-b-4 border-main last:border-b-0 font-bold text-sm hover:bg-muted transition-colors">
                      <div className="p-3 md:border-r-2 border-main">
                        <Link to={`/matches/${match.id}`} className="font-black uppercase hover:text-c2 hover:underline">{getMatchLabel(match, teams)}</Link>
                        <div className="text-xs text-subtle uppercase mt-1">{match.city}</div>
                      </div>
                      <div className="p-3 md:border-r-2 border-main uppercase">{match.status}</div>
                      <div className="p-3 md:border-r-2 border-main text-xs uppercase">{t('ui.lockDate', { date: formatDate(match.lock_at) })}</div>
                      <div className="p-3 flex flex-col gap-2">
                        <div className="flex gap-2">
                          <input value={draft.homeScore} onChange={(event) => setResultDrafts((current) => ({ ...current, [match.id]: { ...draft, homeScore: event.target.value } }))} className="w-14 bg-card border-2 border-main px-2 py-1 font-black text-center" inputMode="numeric" aria-label={t('ui.homeScore')} />
                          <input value={draft.awayScore} onChange={(event) => setResultDrafts((current) => ({ ...current, [match.id]: { ...draft, awayScore: event.target.value } }))} className="w-14 bg-card border-2 border-main px-2 py-1 font-black text-center" inputMode="numeric" aria-label={t('ui.awayScore')} />
                          <button type="button" onClick={() => void saveMatchResult(match)} disabled={state?.loading} className="bg-c2 text-inv border-2 border-main px-2 py-1 font-black uppercase text-[10px] disabled:opacity-60">{t('ui.save')}</button>
                        </div>
                        {(state?.error || state?.success) && <div className={`font-black uppercase text-[10px] ${state.error ? 'text-c5' : 'text-c2'}`}>{state.error ?? state.success}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="bg-main text-inv font-black px-4 py-3 uppercase tracking-wide text-sm border-b-4 border-main">
                {t('ui.predictionIntegrity')}
              </div>
              <div className="bg-card flex flex-col">
                {recentPredictions.map((prediction) => {
                  const match = prediction.matches;
                  const displayPrediction = {
                    id: prediction.id,
                    userId: prediction.user_id,
                    matchId: prediction.match_id,
                    predictionType: prediction.prediction_type as 'exact_score' | 'outcome_only',
                    homeScore: prediction.home_score,
                    awayScore: prediction.away_score,
                    predictedOutcome: prediction.predicted_outcome as 'home' | 'draw' | 'away',
                    confidence: prediction.confidence,
                    isRiskPick: prediction.is_risk_pick,
                    createdAt: prediction.created_at,
                    updatedAt: prediction.updated_at,
                    lockedAt: prediction.locked_at ?? undefined,
                    status: prediction.status as 'draft' | 'submitted' | 'locked' | 'scored',
                    revision: prediction.revision,
                  };
                  return (
                    <div key={prediction.id} className="grid grid-cols-1 md:grid-cols-[1fr_140px_110px_130px] border-b-4 border-main last:border-b-0 font-bold text-sm">
                      <div className="p-3 md:border-r-2 border-main">
                        <div className="font-black uppercase">{getPublicDisplayName(prediction.profiles, prediction.user_id)}</div>
                        <div className="text-xs text-subtle uppercase mt-1">{match ? getMatchLabel(match, teams) : prediction.match_id}</div>
                      </div>
                      <div className="p-3 md:border-r-2 border-main">{match ? formatPredictionPick(displayPrediction, teams.get(match.home_team_id)?.short_name ?? match.home_team_id, teams.get(match.away_team_id)?.short_name ?? match.away_team_id) : prediction.predicted_outcome.toUpperCase()}</div>
                      <div className="p-3 md:border-r-2 border-main">{t('ui.revLabel', { revision: prediction.revision })}</div>
                      <div className="p-3 uppercase text-[10px] font-black">{prediction.status}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="w-full xl:w-[380px] bg-card flex flex-col">
              <div className="bg-main text-inv font-black px-4 py-3 uppercase tracking-wide text-sm border-b-4 border-main">
                {t('ui.leaderboardRecalc')}
              </div>
              <div className="p-4 bg-card flex flex-col gap-3 border-b-4 border-main">
                {leaderboard.slice(0, 4).map((entry) => (
                  <div key={entry.user_id} className="border-2 border-main p-3 flex items-center justify-between font-bold text-sm">
                    <span className="uppercase">#{entry.rank} {getPublicDisplayName(entry.profiles, entry.user_id)}</span>
                    <span className="font-black">{entry.points} {t('ui.pointsShort')}</span>
                  </div>
                ))}
                <button type="button" onClick={() => void runRecalculation()} disabled={recalcState.loading} className="border-2 border-main bg-c1 p-3 font-black uppercase text-xs shadow-[2px_2px_0_var(--color-shadow)] disabled:opacity-60">
                  {recalcState.loading ? t('ui.recalculating') : t('ui.recalculateScores')}
                </button>
                {(recalcState.error || recalcState.success) && <div className={`border-2 border-main p-3 font-black uppercase text-xs ${recalcState.error ? 'bg-c5' : 'bg-c3'}`}>{recalcState.error ?? recalcState.success}</div>}
              </div>

              <div className="bg-main text-inv font-black px-4 py-3 uppercase tracking-wide text-sm border-b-4 border-main">
                Player cards JSON
              </div>
              <div className="p-4 bg-card flex flex-col gap-3 border-b-4 border-main">
                <textarea
                  value={cardImportJson}
                  onChange={(event) => setCardImportJson(event.target.value)}
                  className="min-h-64 w-full resize-y border-2 border-main bg-muted p-3 font-mono text-xs text-main"
                  spellCheck={false}
                  aria-label="Player cards JSON"
                />
                <button type="button" onClick={() => void importPlayerCards()} disabled={cardImportState.loading} className="border-2 border-main bg-c2 p-3 font-black uppercase text-inv text-xs shadow-[2px_2px_0_var(--color-shadow)] disabled:opacity-60">
                  {cardImportState.loading ? 'Importing cards' : 'Import / update cards'}
                </button>
                {(cardImportState.error || cardImportState.success) && <div className={`border-2 border-main p-3 font-black uppercase text-xs ${cardImportState.error ? 'bg-c5' : 'bg-c3'}`}>{cardImportState.error ?? cardImportState.success}</div>}
                {importedCards.length > 0 && <div className="font-black uppercase text-[10px] text-subtle">Latest: {importedCards.slice(0, 3).map((card) => card.name).join(', ')}</div>}
              </div>

              <div className="bg-main text-inv font-black px-4 py-3 uppercase tracking-wide text-sm border-b-4 border-main">
                {t('ui.suspiciousSignals')}
              </div>
              <div className="bg-card flex flex-col border-b-4 border-main">
                {trustSignals.map((signal) => (
                  <div key={signal.id} className="p-4 border-b-2 border-line last:border-b-0">
                    <div className="font-black uppercase flex items-center gap-2"><AlertTriangle size={16} /> {signal.user_id ?? t('ui.systemSignal')}</div>
                    <div className="text-xs font-bold text-subtle mt-1">{signal.label} • {signal.severity}</div>
                  </div>
                ))}
                {!loading && trustSignals.length === 0 && <div className="p-4 font-black uppercase text-xs">{t('ui.noTrustSignals')}</div>}
              </div>

              <div className="flex flex-col flex-1 bg-card">
                <div className="bg-main text-inv font-black px-4 py-3 uppercase tracking-wide text-sm border-b-4 border-main flex justify-between items-center">
                  <span>{t('ui.recentAuditEvents')}</span>
                  <Link to="/admin/audit" className="text-[10px] opacity-80 hover:underline">{t('ui.viewAuditLog')}</Link>
                </div>
                <div className="p-4 bg-card flex flex-col gap-3 text-xs font-bold flex-1">
                  {auditLogs.slice(0, 4).map((log) => (
                    <div key={log.id} className="border-b-2 border-line last:border-b-0 pb-3 last:pb-0">
                      <div className="font-black uppercase">{log.action.replaceAll('_', ' ')}</div>
                      <div className="text-subtle mt-1">{log.description}</div>
                    </div>
                  ))}
                  {!loading && auditLogs.length === 0 && <div className="font-black uppercase text-xs">{t('ui.noAuditEvents')}</div>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
