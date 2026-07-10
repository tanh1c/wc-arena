import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { AlertTriangle, ClipboardCheck, Radar, ShieldCheck, Trophy } from 'lucide-react';
import AppShell from '../components/layout/AppShell';
import { CARD_RARITIES, DROP_EASE_PRESETS, getEffectiveRarityOdds, type CardRarity } from '../config/cardPacks';
import { PACK_IMAGE_OPTIONS } from '../config/packImages';
import { useAuth } from '../lib/auth';
import { listAdminAuditLogs, listRecentPredictionsForAdmin, listRewardReviewsForAdmin, listUserTrustSignalsForAdmin, recalculateScores, updateMatchResult, type AdminAuditLogRow, type AdminPredictionRow, type RewardReviewRow, type UserTrustSignalRow } from '../services/admin';
import { deletePlayerCard, importPlayerCardGameplayProfiles, listAdminPlayerCards, listCardPackCatalog, parsePlayerCardCsv, parsePlayerCardGameplayProfilesCsv, playerCardToAdminInput, replacePlayerCardGameplayProfileRawStats, upsertCardPackCatalog, upsertPlayerCards, type AdminPlayerCard, type AdminPlayerCardInput, type CardPackCatalog, type CardPackCatalogInput, type CardPackPoolType, type PlayerCard } from '../services/cards';
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

type CardDraftTextField = Exclude<keyof AdminPlayerCardInput, 'rarity' | 'drop_weight'>;
type CardCatalogSort = 'rarity-asc' | 'name-asc' | 'name-desc' | 'team-asc' | 'position-asc';
type CardRarityFilter = 'all' | CardRarity;
type PackPoolPlayerSort = 'name-asc' | 'position-asc' | 'nation-asc' | 'team-asc' | 'league-asc' | 'rarity-asc';
type PackPoolOption = { value: string; label: string };

const requiredGameplayStatKeys = ['OVR', 'PAC', 'SHO', 'PAS', 'DRI', 'DEF', 'PHY'] as const;
type GameplayStatDraft = { stats: Record<string, string>; playstyles: string; traits: string };

function gameplayProfileDraft(card: AdminPlayerCard): GameplayStatDraft | null {
  const profile = getCardGameplayProfile(card);
  if (!profile) return null;
  return {
    stats: Object.fromEntries(Object.entries(profile.raw_stats).map(([key, value]) => [key, String(value)])),
    playstyles: profile.playstyles.join('; '),
    traits: profile.traits.join('; '),
  };
}

function getGameplayStatColumns(cards: AdminPlayerCard[]) {
  const statKeys = new Set(cards.flatMap((card) => Object.keys(getCardGameplayProfile(card)?.raw_stats ?? {})));
  return [...requiredGameplayStatKeys, ...[...statKeys].filter((key) => !requiredGameplayStatKeys.includes(key as typeof requiredGameplayStatKeys[number])).sort((left, right) => left.localeCompare(right))];
}

function gameplayProfileDrafts(cards: AdminPlayerCard[]) {
  return Object.fromEntries(cards.flatMap((card) => {
    const draft = gameplayProfileDraft(card);
    return draft ? [[card.id, draft]] : [];
  }));
}

function splitProfileLabels(value: string) {
  return value.split(';').map((item) => item.trim()).filter(Boolean);
}

function isGameplayProfileDraftValid(draft: GameplayStatDraft) {
  return requiredGameplayStatKeys.every((key) => Number.isFinite(Number(draft.stats[key])))
    && Object.entries(draft.stats).every(([key, value]) => key.trim() && Number.isFinite(Number(value)));
}

const poolTypeOptions: Array<{ value: CardPackPoolType; label: string }> = [
  { value: 'all', label: 'All cards' },
  { value: 'manual', label: 'Manual players' },
  { value: 'team', label: 'Team' },
  { value: 'nation_region', label: 'Nation/Region' },
  { value: 'league', label: 'League' },
  { value: 'position', label: 'Position' },
];

const cardRarities: CardRarity[] = [...CARD_RARITIES];
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
    drop_weight: 1,
  };
}

function getCardGameplayProfile(card: AdminPlayerCard) {
  return Array.isArray(card.player_card_gameplay_profiles) ? card.player_card_gameplay_profiles[0] : card.player_card_gameplay_profiles;
}

function emptyPackDraft(): CardPackCatalogInput {
  return {
    pack_type: '',
    title: '',
    description: '',
    image_path: PACK_IMAGE_OPTIONS[0].path,
    card_count: 1,
    price_coins: 0,
    once_per_utc_day: false,
    rarity_weights: Object.fromEntries(CARD_RARITIES.map((rarity) => [rarity, 0])) as Record<CardRarity, number>,
    pool_type: 'all',
    pool_values: [],
    enabled: true,
    sort_order: 0,
  };
}

function compareCardText(left: string | null | undefined, right: string | null | undefined) {
  return (left ?? '').localeCompare(right ?? '', undefined, { sensitivity: 'base' });
}

function getCardSearchText(card: PlayerCard) {
  return [card.id, card.name, card.position, card.team, card.league, card.nation_region, card.rarity].join(' ').toLowerCase();
}

function splitAlternatePositions(value: string | null) {
  return (value ?? '').split(',').map((position) => position.trim()).filter(Boolean);
}

function uniqueOptions(values: Array<string | null | undefined>): PackPoolOption[] {
  return [...new Set(values.map((value) => value?.trim()).filter(Boolean) as string[])].sort((left, right) => compareCardText(left, right)).map((value) => ({ value, label: value }));
}

function getPoolSummary(pack: Pick<CardPackCatalogInput, 'pool_type' | 'pool_values'>) {
  if (pack.pool_type === 'all') return 'Pool: All cards';
  if (pack.pool_type === 'manual') return `Pool: ${pack.pool_values.length} selected players`;
  return `Pool: ${pack.pool_type.replace('_', ' ')} · ${pack.pool_values.join(', ') || 'No values selected'}`;
}

function cardMatchesPackDraftPool(card: PlayerCard, pack: Pick<CardPackCatalogInput, 'pool_type' | 'pool_values'>) {
  if (pack.pool_type === 'all') return true;
  const values = new Set(pack.pool_values);
  if (pack.pool_type === 'manual') return values.has(card.id);
  if (pack.pool_type === 'team') return values.has(card.team);
  if (pack.pool_type === 'nation_region') return values.has(card.nation_region);
  if (pack.pool_type === 'league') return values.has(card.league);
  if (pack.pool_type === 'position') return [card.position, ...splitAlternatePositions(card.alternate_positions)].some((position) => values.has(position));
  return false;
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
  const [activeAdminTab, setActiveAdminTab] = useState<'matches' | 'cards' | 'packs'>('matches');
  const [playerCards, setPlayerCards] = useState<AdminPlayerCard[]>([]);
  const [cardDraft, setCardDraft] = useState<AdminPlayerCardInput>(emptyPlayerCardDraft());
  const [cardActionState, setCardActionState] = useState<ActionState>({});
  const [packCatalog, setPackCatalog] = useState<CardPackCatalog[]>([]);
  const [packDraft, setPackDraft] = useState<CardPackCatalogInput>(emptyPackDraft());
  const [packActionState, setPackActionState] = useState<ActionState>({});
  const [packPoolPickerOpen, setPackPoolPickerOpen] = useState(false);
  const [packPoolSearchQuery, setPackPoolSearchQuery] = useState('');
  const [packPoolPositionFilter, setPackPoolPositionFilter] = useState('all');
  const [packPoolNationFilter, setPackPoolNationFilter] = useState('all');
  const [packPoolTeamFilter, setPackPoolTeamFilter] = useState('all');
  const [packPoolLeagueFilter, setPackPoolLeagueFilter] = useState('all');
  const [packPoolSort, setPackPoolSort] = useState<PackPoolPlayerSort>('name-asc');
  const [cardSearchQuery, setCardSearchQuery] = useState('');
  const [cardRarityFilter, setCardRarityFilter] = useState<CardRarityFilter>('all');
  const [cardCatalogSort, setCardCatalogSort] = useState<CardCatalogSort>('rarity-asc');
  const [cardCsvImport, setCardCsvImport] = useState('');
  const [profileCsvImport, setProfileCsvImport] = useState('');
  const [gameplayProfileDraftByCardId, setGameplayProfileDraftByCardId] = useState<Record<string, GameplayStatDraft>>({});
  const [savingGameplayProfileCardId, setSavingGameplayProfileCardId] = useState<string | null>(null);
  const [csvImportRarity, setCsvImportRarity] = useState<CardRarity>('Common');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadPlayerCards() {
    const cards = await listAdminPlayerCards();
    setPlayerCards(cards);
    setGameplayProfileDraftByCardId(gameplayProfileDrafts(cards));
  }

  async function loadPackCatalog() {
    setPackCatalog(await listCardPackCatalog());
  }

  async function loadAdminData() {
    setLoading(true);
    setError(null);

    try {
      const [nextMatches, nextTeams, nextLeaderboard, nextAuditLogs, nextSignals, nextRewardReviews, nextRecentPredictions, nextPlayerCards, nextPacks] = await Promise.all([
        listMatches(),
        getTeamMap(),
        listGlobalLeaderboard(),
        listAdminAuditLogs(),
        listUserTrustSignalsForAdmin(),
        listRewardReviewsForAdmin(),
        listRecentPredictionsForAdmin(),
        listAdminPlayerCards(),
        listCardPackCatalog(),
      ]);
      setMatches(nextMatches);
      setTeams(nextTeams);
      setLeaderboard(nextLeaderboard);
      setAuditLogs(nextAuditLogs);
      setTrustSignals(nextSignals);
      setRewardReviews(nextRewardReviews);
      setRecentPredictions(nextRecentPredictions);
      setPlayerCards(nextPlayerCards);
      setGameplayProfileDraftByCardId(gameplayProfileDrafts(nextPlayerCards));
      setPackCatalog(nextPacks);
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

    getCurrentUserRole()
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

  function startNewPlayerCard() {
    setCardDraft(emptyPlayerCardDraft());
  }

  function editPlayerCard(card: AdminPlayerCard) {
    setCardDraft(playerCardToAdminInput(card));
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

  async function importGameplayProfileCsv() {
    setCardActionState({ loading: true });

    try {
      const profiles = parsePlayerCardGameplayProfilesCsv(profileCsvImport);
      const catalogUrls = new Set(playerCards.map((card) => card.image_url));
      const matchedProfiles = profiles.filter((profile) => catalogUrls.has(profile.source_image_url));
      if (matchedProfiles.length === 0) throw new Error('No gameplay profiles match a live player card image URL.');
      const result = await importPlayerCardGameplayProfiles(matchedProfiles);
      await loadPlayerCards();
      setCardActionState({ success: `Imported ${result.importedCount} profiles. Skipped ${profiles.length - matchedProfiles.length} unmatched CSV rows, including GOAT Salah until entered manually.` });
    } catch (nextError) {
      setCardActionState({ error: getErrorMessage(nextError) });
    }
  }

  function updateGameplayProfileDraft(cardId: string, update: (draft: GameplayStatDraft) => GameplayStatDraft) {
    setGameplayProfileDraftByCardId((current) => {
      const draft = current[cardId];
      return draft ? { ...current, [cardId]: update(draft) } : current;
    });
  }

  async function saveGameplayProfile(card: AdminPlayerCard) {
    const draft = gameplayProfileDraftByCardId[card.id];
    if (!draft) return;
    if (!isGameplayProfileDraftValid(draft)) {
      setCardActionState({ error: 'Enter a finite number for every stat, including OVR, PAC, SHO, PAS, DRI, DEF, and PHY.' });
      return;
    }

    setSavingGameplayProfileCardId(card.id);
    setCardActionState({ loading: true });
    try {
      await replacePlayerCardGameplayProfileRawStats(
        card.id,
        Object.fromEntries(Object.entries(draft.stats).map(([key, value]) => [key.trim(), Number(value)])),
        splitProfileLabels(draft.playstyles),
        splitProfileLabels(draft.traits),
      );
      await loadPlayerCards();
      setCardActionState({ success: `Saved gameplay profile for ${card.name}.` });
    } catch (nextError) {
      setCardActionState({ error: getErrorMessage(nextError) });
    } finally {
      setSavingGameplayProfileCardId(null);
    }
  }

  async function savePack() {
    setPackActionState({ loading: true });

    try {
      const savedPacks = await upsertCardPackCatalog(packDraft);
      await loadPackCatalog();
      setPackDraft(savedPacks.find((pack) => pack.pack_type === packDraft.pack_type) ?? savedPacks[0] ?? emptyPackDraft());
      setPackActionState({ success: `Saved ${packDraft.title || packDraft.pack_type || 'pack'}.` });
    } catch (nextError) {
      setPackActionState({ error: getErrorMessage(nextError) });
    }
  }

  function setPackWeight(rarity: CardRarity, value: string) {
    setPackDraft((current) => ({
      ...current,
      rarity_weights: { ...current.rarity_weights, [rarity]: value === '' ? 0 : Number(value) },
    }));
  }

  function copyPackRarityWeights(packType: string) {
    const sourcePack = packCatalog.find((pack) => pack.pack_type === packType);
    if (!sourcePack) return;
    setPackDraft((current) => ({ ...current, rarity_weights: { ...sourcePack.rarity_weights } }));
  }

  function applyDropEasePreset(name: keyof typeof DROP_EASE_PRESETS) {
    setPackDraft((current) => ({ ...current, rarity_weights: { ...DROP_EASE_PRESETS[name].weights } }));
  }

  function setPackPoolType(poolType: CardPackPoolType) {
    setPackPoolPickerOpen(false);
    setPackDraft((current) => ({ ...current, pool_type: poolType, pool_values: [] }));
  }

  function setPackPoolValues(values: string[]) {
    setPackDraft((current) => ({ ...current, pool_values: values }));
  }

  function togglePackPoolValue(value: string) {
    setPackDraft((current) => ({
      ...current,
      pool_values: current.pool_values.includes(value) ? current.pool_values.filter((poolValue) => poolValue !== value) : [...current.pool_values, value],
    }));
  }

  function clearPackPoolFilters() {
    setPackPoolSearchQuery('');
    setPackPoolPositionFilter('all');
    setPackPoolNationFilter('all');
    setPackPoolTeamFilter('all');
    setPackPoolLeagueFilter('all');
    setPackPoolSort('name-asc');
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
  const gameplayStatColumns = getGameplayStatColumns(playerCards);
  const packPoolOptions: Record<Exclude<CardPackPoolType, 'all'>, PackPoolOption[]> = {
    manual: playerCards.map((card) => ({ value: card.id, label: `${card.name} · ${card.position} · ${card.team} · ${card.rarity}` })),
    team: uniqueOptions(playerCards.map((card) => card.team)),
    nation_region: uniqueOptions(playerCards.map((card) => card.nation_region)),
    league: uniqueOptions(playerCards.map((card) => card.league)),
    position: uniqueOptions(playerCards.flatMap((card) => [card.position, ...splitAlternatePositions(card.alternate_positions)])),
  };
  const activePoolOptions = packDraft.pool_type === 'all' ? [] : packPoolOptions[packDraft.pool_type];
  const selectedPoolLabels = packDraft.pool_values.map((value) => activePoolOptions.find((option) => option.value === value)?.label ?? value);
  const selectedPoolValueCount = packDraft.pool_values.length;
  const packPoolPositionOptions = uniqueOptions(playerCards.flatMap((card) => [card.position, ...splitAlternatePositions(card.alternate_positions)]));
  const packPoolNationOptions = uniqueOptions(playerCards.map((card) => card.nation_region));
  const packPoolTeamOptions = uniqueOptions(playerCards.map((card) => card.team));
  const packPoolLeagueOptions = uniqueOptions(playerCards.map((card) => card.league));
  const normalizedPackPoolSearch = packPoolSearchQuery.trim().toLowerCase();
  const visiblePoolPlayerCards = [...playerCards]
    .filter((card) => !normalizedPackPoolSearch || card.name.toLowerCase().includes(normalizedPackPoolSearch))
    .filter((card) => packPoolPositionFilter === 'all' || [card.position, ...splitAlternatePositions(card.alternate_positions)].includes(packPoolPositionFilter))
    .filter((card) => packPoolNationFilter === 'all' || card.nation_region === packPoolNationFilter)
    .filter((card) => packPoolTeamFilter === 'all' || card.team === packPoolTeamFilter)
    .filter((card) => packPoolLeagueFilter === 'all' || card.league === packPoolLeagueFilter)
    .sort((left, right) => {
      if (packPoolSort === 'position-asc') return compareCardText(left.position, right.position) || compareCardText(left.name, right.name);
      if (packPoolSort === 'nation-asc') return compareCardText(left.nation_region, right.nation_region) || compareCardText(left.name, right.name);
      if (packPoolSort === 'team-asc') return compareCardText(left.team, right.team) || compareCardText(left.name, right.name);
      if (packPoolSort === 'league-asc') return compareCardText(left.league, right.league) || compareCardText(left.name, right.name);
      if (packPoolSort === 'rarity-asc') return (cardRarityRank.get(left.rarity) ?? 99) - (cardRarityRank.get(right.rarity) ?? 99) || compareCardText(left.name, right.name);
      return compareCardText(left.name, right.name);
    });
  const packPoolCards = playerCards.filter((card) => cardMatchesPackDraftPool(card, packDraft));
  const packPoolRarityCounts = Object.fromEntries(CARD_RARITIES.map((rarity) => [rarity, packPoolCards.filter((card) => card.rarity === rarity).length])) as Record<CardRarity, number>;
  const effectiveRarityOdds = getEffectiveRarityOdds(packDraft.rarity_weights, new Set(packPoolCards.map((card) => card.rarity)));
  const effectiveRarityOddsByRarity = new Map(effectiveRarityOdds.map((odds) => [odds.rarity, odds]));

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
              ['packs', 'Card Packs'],
            ].map(([tab, label]) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveAdminTab(tab as 'matches' | 'cards' | 'packs')}
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
                <button type="button" onClick={startNewPlayerCard} className="border-2 border-main bg-c1 p-3 font-black uppercase text-xs shadow-[2px_2px_0_var(--color-shadow)]">New card</button>
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
                  <label className="flex flex-col gap-1 text-[10px] font-black uppercase">
                    Drop Weight
                    <input value={cardDraft.drop_weight ?? 1} onChange={(event) => setCardDraft((current) => ({ ...current, drop_weight: event.target.value }))} className="border-2 border-main bg-muted p-2 text-sm font-bold normal-case" inputMode="decimal" />
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

              <div className="bg-main text-inv font-black px-4 py-3 uppercase tracking-wide text-sm border-y-4 border-main">Gameplay Profiles</div>
              <div className="p-4 flex flex-col gap-3">
                <p className="text-xs font-bold text-subtle">Imports only exact PNG URL matches. Unmatched rows, including GOAT Salah, stay unprofiled for manual entry.</p>
                <textarea value={profileCsvImport} onChange={(event) => setProfileCsvImport(event.target.value)} className="min-h-64 w-full resize-y border-2 border-main bg-muted p-3 font-mono text-xs text-main" spellCheck={false} aria-label="Gameplay profile CSV" placeholder="Name,...,PAC,SHO,PAS,DRI,DEF,PHY,...,PNG URL,...,OVR,PlayStyles,Traits" />
                <button type="button" onClick={() => void importGameplayProfileCsv()} disabled={cardActionState.loading} className="border-2 border-main bg-c3 p-3 font-black uppercase text-main text-xs shadow-[2px_2px_0_var(--color-shadow)] disabled:opacity-60">Import gameplay profiles</button>
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
              <div className="max-h-[70dvh] overflow-x-auto overflow-y-auto">
                <table className="w-full min-w-max text-left text-xs font-bold">
                  <thead className="sticky top-0 z-10 bg-muted font-black uppercase">
                    <tr>
                      <th className="sticky left-0 z-20 w-56 border-b-4 border-r-2 border-main bg-muted p-3">Card</th>
                      <th className="border-b-4 border-r-2 border-main p-3">Position</th>
                      <th className="border-b-4 border-r-2 border-main p-3">Alternate positions</th>
                      <th className="border-b-4 border-r-2 border-main p-3">Team</th>
                      <th className="border-b-4 border-r-2 border-main p-3">League</th>
                      <th className="border-b-4 border-r-2 border-main p-3">Nation</th>
                      <th className="border-b-4 border-r-2 border-main p-3">Foot</th>
                      <th className="border-b-4 border-r-2 border-main p-3">Skill moves</th>
                      <th className="border-b-4 border-r-2 border-main p-3">Height / weight</th>
                      <th className="border-b-4 border-r-2 border-main p-3">Work rates</th>
                      <th className="border-b-4 border-r-2 border-main p-3">Added</th>
                      {gameplayStatColumns.map((stat) => <th key={stat} title={stat} className="w-24 border-b-4 border-r-2 border-main p-3"><span className="block truncate">{stat}</span></th>)}
                      <th className="border-b-4 border-r-2 border-main p-3">PlayStyles</th>
                      <th className="border-b-4 border-r-2 border-main p-3">Traits</th>
                      <th className="border-b-4 border-r-2 border-main p-3">Rarity</th>
                      <th className="border-b-4 border-r-2 border-main p-3">Drop Weight</th>
                      <th className="border-b-4 border-main p-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visiblePlayerCards.map((card) => {
                      const profile = getCardGameplayProfile(card);

                      return <tr key={card.id} className="border-b-2 border-main last:border-b-0 align-top">
                        <td className="sticky left-0 z-10 border-r-2 border-main bg-card p-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <img src={card.image_url} alt="" className="h-12 w-12 shrink-0 border-2 border-main bg-muted object-cover" loading="lazy" />
                            <div className="min-w-0">
                              <div className="truncate font-black uppercase" title={card.name}>{card.name}</div>
                              <a href={card.image_url} target="_blank" rel="noreferrer" className="text-[10px] text-c2 underline">Image link</a>
                            </div>
                          </div>
                        </td>
                        <td className="border-r-2 border-main p-3 uppercase">{card.position}</td>
                        <td className="max-w-36 border-r-2 border-main p-3 uppercase"><span className="block truncate" title={card.alternate_positions || '—'}>{card.alternate_positions || '—'}</span></td>
                        <td className="max-w-36 border-r-2 border-main p-3 uppercase"><span className="block truncate" title={card.team}>{card.team}</span></td>
                        <td className="max-w-36 border-r-2 border-main p-3 uppercase"><span className="block truncate" title={card.league}>{card.league}</span></td>
                        <td className="max-w-36 border-r-2 border-main p-3 uppercase"><span className="block truncate" title={card.nation_region}>{card.nation_region}</span></td>
                        <td className="border-r-2 border-main p-3 uppercase">{card.footedness || '—'}</td>
                        <td className="border-r-2 border-main p-3 uppercase">{card.skill_moves || '—'}</td>
                        <td className="border-r-2 border-main p-3 uppercase">{[card.height, card.weight].filter(Boolean).join(' / ') || '—'}</td>
                        <td className="border-r-2 border-main p-3 uppercase">{[card.work_rate_att, card.work_rate_def].filter(Boolean).join(' / ') || '—'}</td>
                        <td className="border-r-2 border-main p-3 uppercase">{card.added_on || '—'}</td>
                        {gameplayStatColumns.map((stat) => <td key={stat} className="border-r-2 border-main p-2">
                          <input
                            value={gameplayProfileDraftByCardId[card.id]?.stats[stat] ?? ''}
                            onChange={(event) => updateGameplayProfileDraft(card.id, (draft) => ({ ...draft, stats: { ...draft.stats, [stat]: event.target.value } }))}
                            disabled={!profile}
                            className="w-20 min-w-0 border-2 border-main bg-card px-2 py-1 text-center text-xs font-black disabled:opacity-50"
                            inputMode="decimal"
                            aria-label={`${card.name} ${stat}`}
                          />
                        </td>)}
                        <td className="border-r-2 border-main p-2"><input value={gameplayProfileDraftByCardId[card.id]?.playstyles ?? ''} onChange={(event) => updateGameplayProfileDraft(card.id, (draft) => ({ ...draft, playstyles: event.target.value }))} disabled={!profile} className="w-40 min-w-0 border-2 border-main bg-card px-2 py-1 text-xs font-bold normal-case disabled:opacity-50" placeholder="; separated" /></td>
                        <td className="border-r-2 border-main p-2"><input value={gameplayProfileDraftByCardId[card.id]?.traits ?? ''} onChange={(event) => updateGameplayProfileDraft(card.id, (draft) => ({ ...draft, traits: event.target.value }))} disabled={!profile} className="w-40 min-w-0 border-2 border-main bg-card px-2 py-1 text-xs font-bold normal-case disabled:opacity-50" placeholder="; separated" /></td>
                        <td className="border-r-2 border-main p-3 uppercase">{card.rarity}</td>
                        <td className="border-r-2 border-main p-3 uppercase">{card.drop_weight}</td>
                        <td className="p-3">
                          <div className="flex min-w-[120px] flex-col gap-2">
                            {profile ? <button type="button" onClick={() => void saveGameplayProfile(card)} disabled={cardActionState.loading || savingGameplayProfileCardId === card.id} className="border-2 border-main bg-c2 px-3 py-2 font-black uppercase text-[10px] text-inv disabled:opacity-60">Save stats</button> : <span className="max-w-28 truncate text-[10px] font-black uppercase text-c5" title="Import profile CSV first">Import profile CSV first</span>}
                            <button type="button" onClick={() => editPlayerCard(card)} className="border-2 border-main bg-c1 px-3 py-2 font-black uppercase text-[10px]">Edit</button>
                            <button type="button" onClick={() => void removePlayerCard(card)} disabled={cardActionState.loading} className="border-2 border-main bg-c5 px-3 py-2 font-black uppercase text-[10px] disabled:opacity-60">Delete</button>
                          </div>
                        </td>
                      </tr>;
                    })}
                    {!loading && visiblePlayerCards.length === 0 && <tr><td colSpan={12 + gameplayStatColumns.length} className="p-4 font-black uppercase">{playerCards.length === 0 ? 'No player cards yet.' : 'No player cards match your search.'}</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>}

          {activeAdminTab === 'packs' && <div className="grid grid-cols-1 xl:grid-cols-[420px_1fr] border-4 border-main bg-card">
            <div className="border-b-4 xl:border-b-0 xl:border-r-4 border-main flex flex-col">
              <div className="bg-main text-inv font-black px-4 py-3 uppercase tracking-wide text-sm border-b-4 border-main">Card Packs</div>
              <div className="p-4 flex flex-col gap-3 border-b-4 border-main">
                <button type="button" onClick={() => setPackDraft(emptyPackDraft())} className="border-2 border-main bg-c1 p-3 font-black uppercase text-xs shadow-[2px_2px_0_var(--color-shadow)]">New pack</button>
                <label className="flex flex-col gap-1 text-[10px] font-black uppercase">
                  Pack type
                  <input value={packDraft.pack_type} onChange={(event) => setPackDraft((current) => ({ ...current, pack_type: event.target.value }))} className="border-2 border-main bg-muted p-2 text-sm font-bold normal-case" placeholder="special_pack" />
                </label>
                <label className="flex flex-col gap-1 text-[10px] font-black uppercase">
                  Title
                  <input value={packDraft.title} onChange={(event) => setPackDraft((current) => ({ ...current, title: event.target.value }))} className="border-2 border-main bg-muted p-2 text-sm font-bold normal-case" />
                </label>
                <label className="flex flex-col gap-1 text-[10px] font-black uppercase">
                  Description
                  <textarea value={packDraft.description} onChange={(event) => setPackDraft((current) => ({ ...current, description: event.target.value }))} className="min-h-24 border-2 border-main bg-muted p-2 text-sm font-bold normal-case" />
                </label>
                <label className="flex flex-col gap-1 text-[10px] font-black uppercase">
                  Image
                  <select value={packDraft.image_path} onChange={(event) => setPackDraft((current) => ({ ...current, image_path: event.target.value }))} className="border-2 border-main bg-muted p-2 text-sm font-black uppercase">
                    {PACK_IMAGE_OPTIONS.map((option) => <option key={option.path} value={option.path}>{option.label}</option>)}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-[10px] font-black uppercase">
                  Pool type
                  <select value={packDraft.pool_type} onChange={(event) => setPackPoolType(event.target.value as CardPackPoolType)} className="border-2 border-main bg-muted p-2 text-sm font-black uppercase">
                    {poolTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
                {packDraft.pool_type !== 'all' && <div className="flex flex-col gap-2 border-2 border-main bg-muted p-3 text-[10px] font-black uppercase">
                  <div className="flex items-center justify-between gap-2">
                    <span>Pool values</span>
                    <span>{selectedPoolValueCount} selected</span>
                  </div>
                  <p className="line-clamp-2 text-xs font-bold normal-case text-muted-foreground">{selectedPoolLabels.length > 0 ? selectedPoolLabels.join(', ') : 'No pool values selected.'}</p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <button type="button" onClick={() => setPackPoolPickerOpen(true)} className="border-2 border-main bg-c1 p-2 font-black uppercase text-main shadow-[2px_2px_0_var(--color-shadow)]">Manage pool values</button>
                    {selectedPoolValueCount > 0 && <button type="button" onClick={() => setPackPoolValues([])} className="border-2 border-main bg-card p-2 font-black uppercase text-main shadow-[2px_2px_0_var(--color-shadow)]">Clear pool</button>}
                  </div>
                  <span className="text-[10px] font-bold normal-case text-muted-foreground">Choose values from the player card database.</span>
                </div>}
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1 text-[10px] font-black uppercase">
                    Card count
                    <input value={packDraft.card_count} onChange={(event) => setPackDraft((current) => ({ ...current, card_count: Number(event.target.value) }))} className="border-2 border-main bg-muted p-2 text-sm font-bold" inputMode="numeric" />
                  </label>
                  <label className="flex flex-col gap-1 text-[10px] font-black uppercase">
                    Price Coins
                    <input value={packDraft.price_coins} onChange={(event) => setPackDraft((current) => ({ ...current, price_coins: Number(event.target.value) }))} className="border-2 border-main bg-muted p-2 text-sm font-bold" inputMode="numeric" />
                  </label>
                  <label className="flex items-center gap-2 text-[10px] font-black uppercase">
                    <input type="checkbox" checked={packDraft.once_per_utc_day} onChange={(event) => setPackDraft((current) => ({ ...current, once_per_utc_day: event.target.checked }))} />
                    Once per UTC day
                  </label>
                  <label className="flex items-center gap-2 text-[10px] font-black uppercase">
                    <input type="checkbox" checked={packDraft.enabled} onChange={(event) => setPackDraft((current) => ({ ...current, enabled: event.target.checked }))} />
                    Enabled
                  </label>
                  <label className="flex flex-col gap-1 text-[10px] font-black uppercase col-span-2">
                    Sort order
                    <input value={packDraft.sort_order} onChange={(event) => setPackDraft((current) => ({ ...current, sort_order: Number(event.target.value) }))} className="border-2 border-main bg-muted p-2 text-sm font-bold" inputMode="numeric" />
                  </label>
                </div>
                <label className="flex flex-col gap-1 text-[10px] font-black uppercase">
                  Copy rarity rates
                  <select value="" onChange={(event) => copyPackRarityWeights(event.target.value)} className="border-2 border-main bg-muted p-2 text-sm font-black uppercase">
                    <option value="">Choose source pack</option>
                    {packCatalog.filter((pack) => pack.pack_type !== packDraft.pack_type).map((pack) => <option key={pack.pack_type} value={pack.pack_type}>{pack.title || pack.pack_type}</option>)}
                  </select>
                </label>
                <div className="flex flex-col gap-2 text-[10px] font-black uppercase">
                  Drop ease presets
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.keys(DROP_EASE_PRESETS) as Array<keyof typeof DROP_EASE_PRESETS>).map((name) => (
                      <button key={name} type="button" onClick={() => applyDropEasePreset(name)} className="border-2 border-main bg-c1 p-2 text-main shadow-[2px_2px_0_var(--color-shadow)]">{name}</button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {CARD_RARITIES.map((rarity) => (
                    <label key={rarity} className="flex flex-col gap-1 text-[10px] font-black uppercase">
                      {rarity}
                      <input value={packDraft.rarity_weights[rarity]} onChange={(event) => setPackWeight(rarity, event.target.value)} className="border-2 border-main bg-muted p-2 text-sm font-bold" inputMode="decimal" />
                    </label>
                  ))}
                </div>
                <button type="button" onClick={() => void savePack()} disabled={packActionState.loading} className="border-2 border-main bg-c2 p-3 font-black uppercase text-inv text-xs shadow-[2px_2px_0_var(--color-shadow)] disabled:opacity-60">Save pack</button>
                {(packActionState.error || packActionState.success) && <div className={`border-2 border-main p-3 font-black uppercase text-xs ${packActionState.error ? 'bg-c5' : 'bg-c3'}`}>{packActionState.error ?? packActionState.success}</div>}
              </div>
            </div>

            <div className="min-w-0 flex flex-col">
              <div className="bg-main text-inv font-black px-4 py-3 uppercase tracking-wide text-sm border-b-4 border-main">Pack preview</div>
              <div className="grid gap-4 p-4 lg:grid-cols-[240px_minmax(0,1fr)] border-b-4 border-main">
                <div className="flex min-h-64 items-center justify-center border-4 border-main bg-muted p-4">
                  {PACK_IMAGE_OPTIONS.find((option) => option.path === packDraft.image_path) && <img src={PACK_IMAGE_OPTIONS.find((option) => option.path === packDraft.image_path)?.image} alt="" className="max-h-56 max-w-full object-contain" />}
                </div>
                <div className="font-black uppercase text-main">
                  <h3 className="text-3xl tracking-tight">{packDraft.title || 'Untitled pack'}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{packDraft.description || 'No description yet.'}</p>
                  <p className="mt-4 text-sm">{packDraft.card_count} cards · {packDraft.price_coins} coins · {packDraft.enabled ? 'Enabled' : 'Disabled'}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{getPoolSummary(packDraft)}</p>
                  <div className="mt-4 border-2 border-main bg-card p-3 text-xs">
                    <p className="mb-2 text-sm">Effective odds for selected pool</p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {CARD_RARITIES.map((rarity) => {
                        const cardCount = packPoolRarityCounts[rarity];
                        const odds = effectiveRarityOddsByRarity.get(rarity);
                        return <div key={rarity} className="border-2 border-main bg-muted p-2">
                          <div>{rarity}</div>
                          <div className="text-[10px] text-muted-foreground">{cardCount === 0 ? '0 cards / skipped' : `${cardCount} cards · ${odds?.chance ?? 0}%`}</div>
                        </div>;
                      })}
                    </div>
                  </div>
                </div>
              </div>
              <div className="max-h-[70dvh] overflow-auto">
                <table className="w-full min-w-[720px] text-left text-xs font-bold">
                  <thead className="sticky top-0 z-10 bg-muted font-black uppercase">
                    <tr>
                      <th className="border-b-4 border-r-2 border-main p-3">Pack</th>
                      <th className="border-b-4 border-r-2 border-main p-3">Image</th>
                      <th className="border-b-4 border-r-2 border-main p-3">Cards</th>
                      <th className="border-b-4 border-r-2 border-main p-3">Price</th>
                      <th className="border-b-4 border-r-2 border-main p-3">Pool</th>
                      <th className="border-b-4 border-r-2 border-main p-3">Enabled</th>
                      <th className="border-b-4 border-main p-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {packCatalog.map((pack) => (
                      <tr key={pack.pack_type} className="border-b-2 border-main last:border-b-0">
                        <td className="border-r-2 border-main p-3"><div className="font-black uppercase">{pack.title}</div><div className="text-[10px] text-subtle">{pack.pack_type}</div></td>
                        <td className="border-r-2 border-main p-3 uppercase">{pack.image_path}</td>
                        <td className="border-r-2 border-main p-3 uppercase">{pack.card_count}</td>
                        <td className="border-r-2 border-main p-3 uppercase">{pack.price_coins}</td>
                        <td className="border-r-2 border-main p-3 uppercase">{getPoolSummary(pack)}</td>
                        <td className="border-r-2 border-main p-3 uppercase">{pack.enabled ? 'Yes' : 'No'}</td>
                        <td className="p-3"><button type="button" onClick={() => setPackDraft(pack)} className="border-2 border-main bg-c1 px-3 py-2 font-black uppercase text-[10px]">Edit</button></td>
                      </tr>
                    ))}
                    {!loading && packCatalog.length === 0 && <tr><td colSpan={6} className="p-4 font-black uppercase">No card packs yet.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>}

          {packPoolPickerOpen && packDraft.pool_type !== 'all' && <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/70 p-3 pt-16 sm:p-6 sm:pt-20" onClick={() => setPackPoolPickerOpen(false)}>
            <section role="dialog" aria-modal="true" className="flex max-h-[calc(100dvh-5rem)] w-full max-w-6xl flex-col overflow-hidden border-4 border-main bg-card shadow-[8px_8px_0_var(--color-shadow)]" onClick={(event) => event.stopPropagation()}>
              <div className="flex shrink-0 items-center justify-between gap-3 border-b-4 border-main bg-main p-3 text-inv">
                <div>
                  <h2 className="font-black uppercase">Pool values</h2>
                  <p className="text-[10px] font-black uppercase opacity-80">{selectedPoolValueCount} selected · {packDraft.pool_type === 'manual' ? visiblePoolPlayerCards.length : activePoolOptions.length} shown</p>
                </div>
                <button type="button" onClick={() => setPackPoolPickerOpen(false)} className="border-2 border-main bg-card px-4 py-2 text-xs font-black uppercase text-main shadow-[2px_2px_0_var(--color-shadow)]">Done</button>
              </div>
              {packDraft.pool_type === 'manual' && <div className="shrink-0 border-b-4 border-main bg-card p-3">
                <div className="grid grid-cols-1 gap-2 md:grid-cols-3 xl:grid-cols-6">
                  <label className="flex flex-col gap-1 text-[10px] font-black uppercase md:col-span-3 xl:col-span-2">
                    Search player name
                    <input value={packPoolSearchQuery} onChange={(event) => setPackPoolSearchQuery(event.target.value)} className="border-2 border-main bg-muted p-2 text-sm font-bold normal-case" placeholder="Messi, Mbappe..." />
                  </label>
                  <label className="flex flex-col gap-1 text-[10px] font-black uppercase">
                    Position filter
                    <select value={packPoolPositionFilter} onChange={(event) => setPackPoolPositionFilter(event.target.value)} className="border-2 border-main bg-muted p-2 text-sm font-black uppercase">
                      <option value="all">All</option>
                      {packPoolPositionOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-[10px] font-black uppercase">
                    Nation filter
                    <select value={packPoolNationFilter} onChange={(event) => setPackPoolNationFilter(event.target.value)} className="border-2 border-main bg-muted p-2 text-sm font-black uppercase">
                      <option value="all">All</option>
                      {packPoolNationOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-[10px] font-black uppercase">
                    Team filter
                    <select value={packPoolTeamFilter} onChange={(event) => setPackPoolTeamFilter(event.target.value)} className="border-2 border-main bg-muted p-2 text-sm font-black uppercase">
                      <option value="all">All</option>
                      {packPoolTeamOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-[10px] font-black uppercase">
                    League filter
                    <select value={packPoolLeagueFilter} onChange={(event) => setPackPoolLeagueFilter(event.target.value)} className="border-2 border-main bg-muted p-2 text-sm font-black uppercase">
                      <option value="all">All</option>
                      {packPoolLeagueOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-[10px] font-black uppercase">
                    Sort players
                    <select value={packPoolSort} onChange={(event) => setPackPoolSort(event.target.value as PackPoolPlayerSort)} className="border-2 border-main bg-muted p-2 text-sm font-black uppercase">
                      <option value="name-asc">Name A-Z</option>
                      <option value="position-asc">Position A-Z</option>
                      <option value="nation-asc">Nation A-Z</option>
                      <option value="team-asc">Team A-Z</option>
                      <option value="league-asc">League A-Z</option>
                      <option value="rarity-asc">Rarity</option>
                    </select>
                  </label>
                  <button type="button" onClick={clearPackPoolFilters} className="border-2 border-main bg-c1 p-2 text-xs font-black uppercase text-main shadow-[2px_2px_0_var(--color-shadow)]">Clear filters</button>
                </div>
              </div>}
              <div className="min-h-0 overflow-auto p-3">
                {packDraft.pool_type === 'manual' ? <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {visiblePoolPlayerCards.map((card) => {
                    const selected = packDraft.pool_values.includes(card.id);

                    return <button key={card.id} type="button" onClick={() => togglePackPoolValue(card.id)} className={`flex items-center gap-3 rounded-2xl border-2 border-main p-3 text-left shadow-[3px_3px_0_var(--color-shadow)] ${selected ? 'bg-c1' : 'bg-muted'}`}>
                      <input type="checkbox" checked={selected} readOnly className="shrink-0" />
                      <img src={card.image_url} alt={card.name} className="h-20 w-16 shrink-0 object-contain" />
                      <span className="min-w-0 font-black uppercase">
                        <span className="block truncate text-base">{card.name}</span>
                        <span className="block text-xs text-muted-foreground">{card.position} · {card.nation_region}</span>
                        <span className="block text-[10px] text-muted-foreground">{card.team} · {card.league}</span>
                        <span className="block text-[10px] text-muted-foreground">{card.rarity}</span>
                      </span>
                    </button>;
                  })}
                  {playerCards.length === 0 && <p className="border-2 border-main bg-muted p-3 text-xs font-black uppercase">No player cards yet.</p>}
                  {playerCards.length > 0 && visiblePoolPlayerCards.length === 0 && <p className="border-2 border-main bg-muted p-3 text-xs font-black uppercase">No player cards match your filters.</p>}
                </div> : <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {activePoolOptions.map((option) => (
                    <label key={option.value} className="flex items-center gap-3 border-2 border-main bg-muted p-3 text-xs font-black uppercase shadow-[2px_2px_0_var(--color-shadow)]">
                      <input type="checkbox" checked={packDraft.pool_values.includes(option.value)} onChange={() => togglePackPoolValue(option.value)} />
                      <span>{option.label}</span>
                    </label>
                  ))}
                  {activePoolOptions.length === 0 && <p className="border-2 border-main bg-muted p-3 text-xs font-black uppercase">No pool values found.</p>}
                </div>}
              </div>
            </section>
          </div>}
        </div>
      </div>
    </AppShell>
  );
}
