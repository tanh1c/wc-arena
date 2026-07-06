import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { AlertTriangle, ClipboardCheck, Radar, ShieldCheck, Trophy } from 'lucide-react';
import AppShell from '../components/layout/AppShell';
import type { CardRarity } from '../config/cardPacks';
import { useAuth } from '../lib/auth';
import { listAdminAuditLogs, listRecentPredictionsForAdmin, listRewardReviewsForAdmin, listUserTrustSignalsForAdmin, recalculateScores, updateMatchResult, type AdminAuditLogRow, type AdminPredictionRow, type RewardReviewRow, type UserTrustSignalRow } from '../services/admin';
import { deletePlayerCard, listPlayerCards, parsePlayerCardCsv, playerCardToAdminInput, upsertPlayerCards, type AdminPlayerCardInput, type PlayerCard } from '../services/cards';
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

type CardDraftTextField = Exclude<keyof AdminPlayerCardInput, 'rarity'>;
type CardCatalogSort = 'rarity-asc' | 'name-asc' | 'name-desc' | 'team-asc' | 'position-asc';
type CardRarityFilter = 'all' | CardRarity;

const cardRarities: CardRarity[] = ['Common', 'Rare', 'Epic', 'Icon'];
const cardRarityRank = new Map(cardRarities.map((rarity, index) => [rarity, index]));
const cardDraftFields: Array<{ key: CardDraftTextField; label: string; wide?: boolean }> = [
  { key: 'id', label: 'ID' },
  { key: 'name', label: 'Name' },
  { key: 'position', label: 'Position' },
  { key: 'alternate_positions', label: 'Alternate Positions' },
  { key: 'team', label: 'Team' },
  { key: 'league', label: 'League' },
  { key: 'nation_region', label: 'Nation/Region' },
  { key: 'skill_moves', label: 'Skill Moves' },
  { key: 'footedness', label: 'Footedness' },
  { key: 'height', label: 'Height' },
  { key: 'weight', label: 'Weight' },
  { key: 'work_rate_att', label: 'Work Rate ATT' },
  { key: 'work_rate_def', label: 'Work Rate DEF' },
  { key: 'added_on', label: 'Added On' },
  { key: 'image_url', label: 'PNG URL', wide: true },
  { key: 'gif_url', label: 'GIF URL', wide: true },
];

function emptyPlayerCardDraft(): AdminPlayerCardInput {
  return {
    name: '',
    position: '',
    team: '',
    league: '',
    nation_region: '',
    image_url: '',
    gif_url: '',
    rarity: 'Common',
  };
}

function compareCardText(left: string | null | undefined, right: string | null | undefined) {
  return (left ?? '').localeCompare(right ?? '', undefined, { sensitivity: 'base' });
}

function getCardSearchText(card: PlayerCard) {
  return [card.id, card.name, card.position, card.team, card.league, card.nation_region, card.rarity].join(' ').toLowerCase();
}

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
  const userId = user?.id ?? null;
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
  const [activeAdminTab, setActiveAdminTab] = useState<'matches' | 'cards'>('matches');
  const [playerCards, setPlayerCards] = useState<PlayerCard[]>([]);
  const [cardDraft, setCardDraft] = useState<AdminPlayerCardInput>(emptyPlayerCardDraft());
  const [cardActionState, setCardActionState] = useState<ActionState>({});
  const [cardSearchQuery, setCardSearchQuery] = useState('');
  const [cardRarityFilter, setCardRarityFilter] = useState<CardRarityFilter>('all');
  const [cardCatalogSort, setCardCatalogSort] = useState<CardCatalogSort>('rarity-asc');
  const [cardCsvImport, setCardCsvImport] = useState('');
  const [csvImportRarity, setCsvImportRarity] = useState<CardRarity>('Common');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadPlayerCards() {
    setPlayerCards(await listPlayerCards());
  }

  async function loadAdminData() {
    setLoading(true);
    setError(null);

    try {
      const [nextMatches, nextTeams, nextLeaderboard, nextAuditLogs, nextSignals, nextRewardReviews, nextRecentPredictions, nextPlayerCards] = await Promise.all([
        listMatches(),
        getTeamMap(),
        listGlobalLeaderboard(),
        listAdminAuditLogs(),
        listUserTrustSignalsForAdmin(),
        listRewardReviewsForAdmin(),
        listRecentPredictionsForAdmin(),
        listPlayerCards(),
      ]);
      setMatches(nextMatches);
      setTeams(nextTeams);
      setLeaderboard(nextLeaderboard);
      setAuditLogs(nextAuditLogs);
      setTrustSignals(nextSignals);
      setRewardReviews(nextRewardReviews);
      setRecentPredictions(nextRecentPredictions);
      setPlayerCards(nextPlayerCards);
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
    if (!userId) {
      setRole(null);
      setRoleLoading(false);
      return;
    }

    let active = true;
    setRoleLoading(true);
    setError(null);

    getCurrentUserRole(userId)
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
  }, [userId]);

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

  function setCardDraftField(field: CardDraftTextField, value: string) {
    setCardDraft((current) => ({ ...current, [field]: value }));
  }

  async function savePlayerCard() {
    setCardActionState({ loading: true });

    try {
      const savedCards = await upsertPlayerCards([cardDraft]);
      await loadPlayerCards();
      setCardDraft(savedCards[0] ? playerCardToAdminInput(savedCards[0]) : emptyPlayerCardDraft());
      setCardActionState({ success: `Saved ${savedCards[0]?.name ?? 'player card'}.` });
    } catch (nextError) {
      setCardActionState({ error: getErrorMessage(nextError) });
    }
  }

  async function removePlayerCard(card: PlayerCard) {
    if (!window.confirm(`Delete ${card.name}?`)) return;
    setCardActionState({ loading: true });

    try {
      await deletePlayerCard(card.id);
      await loadPlayerCards();
      if (cardDraft.id === card.id) setCardDraft(emptyPlayerCardDraft());
      setCardActionState({ success: `Deleted ${card.name}.` });
    } catch (nextError) {
      setCardActionState({ error: getErrorMessage(nextError) });
    }
  }

  async function importPlayerCardCsv() {
    setCardActionState({ loading: true });

    try {
      const parsedCards = parsePlayerCardCsv(cardCsvImport, csvImportRarity);
      const savedCards = await upsertPlayerCards(parsedCards);
      await loadPlayerCards();
      setCardActionState({ success: `Imported ${savedCards.length} player cards.` });
    } catch (nextError) {
      setCardActionState({ error: getErrorMessage(nextError) });
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
  const normalizedCardSearch = cardSearchQuery.trim().toLowerCase();
  const visiblePlayerCards = [...playerCards]
    .filter((card) => cardRarityFilter === 'all' || card.rarity === cardRarityFilter)
    .filter((card) => !normalizedCardSearch || getCardSearchText(card).includes(normalizedCardSearch))
    .sort((left, right) => {
      if (cardCatalogSort === 'name-asc') return compareCardText(left.name, right.name);
      if (cardCatalogSort === 'name-desc') return compareCardText(right.name, left.name);
      if (cardCatalogSort === 'team-asc') return compareCardText(left.team, right.team) || compareCardText(left.name, right.name);
      if (cardCatalogSort === 'position-asc') return compareCardText(left.position, right.position) || compareCardText(left.name, right.name);

      return (cardRarityRank.get(left.rarity) ?? 99) - (cardRarityRank.get(right.rarity) ?? 99) || compareCardText(left.name, right.name);
    });

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

          <div className="flex flex-wrap gap-3">
            {[
              ['matches', 'Match Management'],
              ['cards', 'Player Cards'],
            ].map(([tab, label]) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveAdminTab(tab as 'matches' | 'cards')}
                className={`border-4 border-main px-4 py-3 font-black uppercase text-xs shadow-[4px_4px_0_var(--color-shadow)] ${activeAdminTab === tab ? 'bg-c2 text-inv' : 'bg-card text-main'}`}
              >
                {label}
              </button>
            ))}
          </div>

          {activeAdminTab === 'matches' && <div className="flex flex-col xl:flex-row flex-1">
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
          </div>}

          {activeAdminTab === 'cards' && <div className="grid grid-cols-1 xl:grid-cols-[420px_1fr] border-4 border-main bg-card">
            <div className="border-b-4 xl:border-b-0 xl:border-r-4 border-main flex flex-col">
              <div className="bg-main text-inv font-black px-4 py-3 uppercase tracking-wide text-sm border-b-4 border-main">Player Cards</div>
              <div className="p-4 flex flex-col gap-3 border-b-4 border-main">
                <button type="button" onClick={() => setCardDraft(emptyPlayerCardDraft())} className="border-2 border-main bg-c1 p-3 font-black uppercase text-xs shadow-[2px_2px_0_var(--color-shadow)]">New card</button>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {cardDraftFields.map((field) => (
                    <label key={field.key} className={`flex flex-col gap-1 text-[10px] font-black uppercase ${field.wide ? 'sm:col-span-2' : ''}`}>
                      {field.label}
                      <input value={cardDraft[field.key] ?? ''} onChange={(event) => setCardDraftField(field.key, event.target.value)} className="border-2 border-main bg-muted p-2 text-sm font-bold normal-case" />
                    </label>
                  ))}
                  <label className="flex flex-col gap-1 text-[10px] font-black uppercase">
                    Rarity
                    <select value={cardDraft.rarity} onChange={(event) => setCardDraft((current) => ({ ...current, rarity: event.target.value as CardRarity }))} className="border-2 border-main bg-muted p-2 text-sm font-bold">
                      {cardRarities.map((rarity) => <option key={rarity} value={rarity}>{rarity}</option>)}
                    </select>
                  </label>
                </div>
                <button type="button" onClick={() => void savePlayerCard()} disabled={cardActionState.loading} className="border-2 border-main bg-c2 p-3 font-black uppercase text-inv text-xs shadow-[2px_2px_0_var(--color-shadow)] disabled:opacity-60">Save card</button>
                {(cardActionState.error || cardActionState.success) && <div className={`border-2 border-main p-3 font-black uppercase text-xs ${cardActionState.error ? 'bg-c5' : 'bg-c3'}`}>{cardActionState.error ?? cardActionState.success}</div>}
              </div>

              <div className="bg-main text-inv font-black px-4 py-3 uppercase tracking-wide text-sm border-b-4 border-main">CSV Import</div>
              <div className="p-4 flex flex-col gap-3">
                <select value={csvImportRarity} onChange={(event) => setCsvImportRarity(event.target.value as CardRarity)} className="border-2 border-main bg-muted p-2 text-sm font-black uppercase" aria-label="CSV rarity">
                  {cardRarities.map((rarity) => <option key={rarity} value={rarity}>{rarity}</option>)}
                </select>
                <textarea value={cardCsvImport} onChange={(event) => setCardCsvImport(event.target.value)} className="min-h-64 w-full resize-y border-2 border-main bg-muted p-3 font-mono text-xs text-main" spellCheck={false} aria-label="Player card CSV" placeholder="Name,Position,Alternate Positions,TEAM,LEAGUE,NATION/REGION,Skill Moves,STRONG FOOT / WEAK FOOT,Height,Weight,Work Rate (ATT) / Work Rate (DEF),Added on,PNG URL,GIF URL" />
                <button type="button" onClick={() => void importPlayerCardCsv()} disabled={cardActionState.loading} className="border-2 border-main bg-c2 p-3 font-black uppercase text-inv text-xs shadow-[2px_2px_0_var(--color-shadow)] disabled:opacity-60">Import CSV</button>
              </div>
            </div>

            <div className="min-w-0 flex flex-col">
              <div className="bg-main text-inv font-black px-4 py-3 uppercase tracking-wide text-sm border-b-4 border-main">Catalog ({visiblePlayerCards.length}/{playerCards.length})</div>
              <div className="grid grid-cols-1 gap-3 border-b-4 border-main bg-card p-4 md:grid-cols-[1fr_180px_220px]">
                <label className="flex flex-col gap-1 text-[10px] font-black uppercase">
                  Search cards
                  <input value={cardSearchQuery} onChange={(event) => setCardSearchQuery(event.target.value)} className="border-2 border-main bg-muted p-2 text-sm font-bold normal-case" placeholder="Name, team, position, league..." />
                </label>
                <label className="flex flex-col gap-1 text-[10px] font-black uppercase">
                  Rarity filter
                  <select value={cardRarityFilter} onChange={(event) => setCardRarityFilter(event.target.value as CardRarityFilter)} className="border-2 border-main bg-muted p-2 text-sm font-black uppercase">
                    <option value="all">All</option>
                    {cardRarities.map((rarity) => <option key={rarity} value={rarity}>{rarity}</option>)}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-[10px] font-black uppercase">
                  Sort by
                  <select value={cardCatalogSort} onChange={(event) => setCardCatalogSort(event.target.value as CardCatalogSort)} className="border-2 border-main bg-muted p-2 text-sm font-black uppercase">
                    <option value="rarity-asc">Rarity, then name</option>
                    <option value="name-asc">Name A-Z</option>
                    <option value="name-desc">Name Z-A</option>
                    <option value="team-asc">Team A-Z</option>
                    <option value="position-asc">Position A-Z</option>
                  </select>
                </label>
              </div>
              <div className="max-h-[70dvh] overflow-auto">
                <table className="w-full min-w-[760px] text-left text-xs font-bold">
                  <thead className="sticky top-0 z-10 bg-muted font-black uppercase">
                    <tr>
                      <th className="border-b-4 border-r-2 border-main p-3">Card</th>
                      <th className="border-b-4 border-r-2 border-main p-3">Position</th>
                      <th className="border-b-4 border-r-2 border-main p-3">Team</th>
                      <th className="border-b-4 border-r-2 border-main p-3">Rarity</th>
                      <th className="border-b-4 border-main p-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visiblePlayerCards.map((card) => (
                      <tr key={card.id} className="border-b-2 border-main last:border-b-0">
                        <td className="border-r-2 border-main p-3">
                          <div className="flex items-center gap-3">
                            <img src={card.image_url} alt="" className="h-12 w-12 border-2 border-main object-cover bg-muted" loading="lazy" />
                            <div>
                              <div className="font-black uppercase">{card.name}</div>
                              <a href={card.image_url} target="_blank" rel="noreferrer" className="text-[10px] text-c2 underline">Image link</a>
                            </div>
                          </div>
                        </td>
                        <td className="border-r-2 border-main p-3 uppercase">{card.position}</td>
                        <td className="border-r-2 border-main p-3 uppercase">{card.team}</td>
                        <td className="border-r-2 border-main p-3 uppercase">{card.rarity}</td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-2">
                            <button type="button" onClick={() => setCardDraft(playerCardToAdminInput(card))} className="border-2 border-main bg-c1 px-3 py-2 font-black uppercase text-[10px]">Edit</button>
                            <button type="button" onClick={() => void removePlayerCard(card)} disabled={cardActionState.loading} className="border-2 border-main bg-c5 px-3 py-2 font-black uppercase text-[10px] disabled:opacity-60">Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!loading && visiblePlayerCards.length === 0 && <tr><td colSpan={5} className="p-4 font-black uppercase">{playerCards.length === 0 ? 'No player cards yet.' : 'No player cards match your search.'}</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>}
        </div>
      </div>
    </AppShell>
  );
}
