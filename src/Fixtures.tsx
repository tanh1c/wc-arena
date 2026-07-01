import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  BarChart2,
  Binoculars,
  Calendar,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  CheckCircle,
  Clock,
  Flag,
  HelpCircle,
  MonitorPlay,
  Pencil,
  Star,
  Target,
  TrendingUp,
  Trophy,
  User,
} from 'lucide-react';
import AppShell from './components/layout/AppShell';
import { useAuth } from './lib/auth';
import { buildKnockoutTeamProjection, type ProjectedMatchTeams } from './lib/knockoutAdvancement';
import { getDefaultStageFilter, type StageFilter } from './lib/matchesDefaultStage';
import { MATCHES_TOUR_ID, getMatchesTutorialSteps } from './lib/matchesTutorial';
import { hasSeenTour, markTourSeen, shouldAutoRunTour, startTutorialTour } from './lib/tutorialTour';
import { getErrorMessage } from './services/serviceTypes';
import { listGlobalLeaderboard, type LeaderboardEntryWithProfile } from './services/leaderboard';
import { getEffectiveMatchStatus, isMatchPredictionOpen, listMatches, type MatchRow } from './services/matches';
import { listCurrentUserPredictions, type PredictionWithMatch } from './services/predictions';
import { getTeamMap, type TeamRow } from './services/teams';
import { getPublicDisplayName } from './utils/displayName';
import { getPenaltyScoreLabel, getPenaltyWinnerLabel } from './utils/predictionDisplay';
import { getTeamFlag } from './utils/teamFlags';

type FixturesProps = {
  onNavigate: (page: string) => void;
  isVintage: boolean;
  setIsVintage: (v: boolean) => void;
  isDark: boolean;
  setIsDark: (v: boolean) => void;
  isRounded: boolean;
  setIsRounded: (v: boolean) => void;
  hasShadow: boolean;
  setHasShadow: (v: boolean) => void;
  hasFrame: boolean;
  setHasFrame: (v: boolean) => void;
};

type StatusFilter = 'all' | 'open' | 'locked' | 'live' | 'finished';
type TranslationFn = ReturnType<typeof useTranslation>['t'];

const stageLabelKeys: Record<StageFilter, string> = {
  group: 'ui.groupStage',
  round32: 'ui.roundOf32',
  round16: 'ui.roundOf16',
  quarter: 'ui.quarterFinals',
  semi: 'ui.semiFinals',
  third_place: 'ui.thirdPlace',
  final: 'ui.final',
};

const MATCHES_PER_PAGE = 12;

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(value));
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('en', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function formatDateRange(matches: MatchRow[], t: TranslationFn) {
  if (!matches.length) return t('ui.noMatchesLabel');
  return `${formatDate(matches[0].kickoff_at)} - ${formatDate(matches[matches.length - 1].kickoff_at)}`;
}

function getStatusLabel(status: string, t: TranslationFn) {
  if (status === 'finished') return t('ui.completed');
  if (status === 'open') return t('ui.open');
  if (status === 'locked') return t('ui.locked');
  if (status === 'live') return t('ui.live');
  return status.toUpperCase();
}

function getStatusClass(status: string) {
  if (status === 'open') return 'bg-c5 text-main';
  if (status === 'locked') return 'bg-muted text-main';
  if (status === 'live') return 'bg-c4 text-inv';
  if (status === 'finished') return 'font-black text-[10px] uppercase text-subtle px-3 py-1';
  return 'bg-c1 text-main';
}

function statusMatchesFilter(statusFilter: StatusFilter, effectiveStatus: string) {
  if (statusFilter === 'all') return true;
  if (statusFilter === 'open') return effectiveStatus === 'open' || effectiveStatus === 'scheduled';
  return effectiveStatus === statusFilter;
}

function getDefaultOpenStage(matches: Pick<MatchRow, 'lock_at' | 'stage' | 'status'>[]) {
  return (matches.find((match) => isMatchPredictionOpen(match))?.stage as StageFilter | undefined) ?? getDefaultStageFilter(matches as MatchRow[]);
}

function TeamFlag({ team }: { team?: TeamRow }) {
  const FlagIcon = getTeamFlag(team?.country_code, team?.short_name);

  return (
    <div className="w-7 h-7 sm:w-8 sm:h-8 lg:w-10 lg:h-10 border-2 border-main rounded-full overflow-hidden flex items-center justify-center bg-elevated shrink-0">
      {FlagIcon ? <FlagIcon className="w-full h-full object-cover" /> : <span className="font-black text-[10px]">{team?.short_name ?? '?'}</span>}
    </div>
  );
}

function MatchScore({ match, homeTeam, awayTeam }: { match: MatchRow; homeTeam?: TeamRow; awayTeam?: TeamRow }) {
  if (typeof match.home_score === 'number' && typeof match.away_score === 'number') {
    const penaltyScore = getPenaltyScoreLabel(match);
    const penaltyWinner = getPenaltyWinnerLabel(match, homeTeam?.short_name ?? match.home_team_id, awayTeam?.short_name ?? match.away_team_id);

    return (
      <div className={`relative flex items-center gap-2 ${match.status === 'live' ? 'text-c4' : ''}`}>
        <div className={`w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 border-[3px] ${match.status === 'live' ? 'border-c4' : 'border-main'} flex items-center justify-center font-black text-base sm:text-xl bg-card`}>{match.home_score}</div>
        <div className="font-black text-base sm:text-xl">-</div>
        <div className={`w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 border-[3px] ${match.status === 'live' ? 'border-c4' : 'border-main'} flex items-center justify-center font-black text-base sm:text-xl bg-card`}>{match.away_score}</div>
        {penaltyScore && <div className="absolute left-1/2 top-full mt-1 -translate-x-1/2 bg-main text-inv border-2 border-main px-2 py-0.5 font-black text-[9px] sm:text-[10px] uppercase whitespace-nowrap z-10">{penaltyScore}</div>}
        {!penaltyScore && penaltyWinner && <div className="absolute left-1/2 top-full mt-1 -translate-x-1/2 font-black text-[9px] sm:text-[10px] uppercase text-center text-c2 whitespace-nowrap z-10">{penaltyWinner}</div>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 border-[3px] border-main flex items-center justify-center font-black text-base sm:text-xl bg-card">-</div>
      <div className="font-black text-base sm:text-xl">-</div>
      <div className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 border-[3px] border-main flex items-center justify-center font-black text-base sm:text-xl bg-card">-</div>
    </div>
  );
}

function MatchListRow({ match, homeTeam, awayTeam, projection, featured, onNavigate, t }: { key?: string; match: MatchRow; homeTeam?: TeamRow; awayTeam?: TeamRow; projection?: ProjectedMatchTeams; featured: boolean; onNavigate: (page: string) => void; t: TranslationFn }) {
  const effectiveStatus = getEffectiveMatchStatus(match);
  const isLive = effectiveStatus === 'live';
  const isFinished = effectiveStatus === 'finished';
  const isProjected = Boolean(projection && (projection.home.projected || projection.away.projected));

  return (
    <div className={`flex flex-col sm:flex-row border-b-4 border-main relative hover:bg-page transition-colors overflow-hidden ${isLive ? 'bg-[#f0f9ff]' : 'bg-card'} ${isFinished ? 'opacity-80' : ''}`}>
      {featured && (
        <div className="absolute top-0 right-0 sm:right-auto sm:left-24 bg-c1 border-l-4 sm:border-x-4 border-b-4 border-main text-main text-[9px] sm:text-[10px] px-2 sm:px-3 py-1 flex items-center gap-1 font-black uppercase z-10">
          <Star size={12} className="fill-main" /> {t('ui.featured')}
        </div>
      )}
      {isLive && (
        <div className="absolute top-2 left-2 flex items-center gap-1 z-10">
          <div className="w-2 h-2 rounded-full bg-c4 animate-pulse" />
        </div>
      )}
      <div className={`w-full sm:w-32 border-b-4 sm:border-b-0 sm:border-r-4 border-main flex sm:flex-col items-center sm:items-start justify-between sm:justify-start pt-5 sm:pt-4 p-2 sm:p-3 shrink-0 ${isLive ? 'bg-[#f0f9ff] text-c4' : 'bg-card text-main'}`}>
        <div className="flex flex-col">
          <span className="font-bold text-[10px] sm:text-xs uppercase whitespace-nowrap mb-0.5">{formatDate(match.kickoff_at)}</span>
          <span className="font-black text-xl sm:text-2xl leading-none">{formatTime(match.kickoff_at)}</span>
        </div>
        <span className="font-bold text-[9px] sm:text-[10px] uppercase opacity-80 sm:mb-4 md:mb-6 text-subtle">{t('ui.local')}</span>
        <div className="mt-auto flex-col gap-0.5 text-faint hidden md:flex">
          <span className="text-[9px] uppercase font-bold leading-tight">{match.stadium}</span>
          <span className="text-[8px] uppercase font-bold opacity-80 leading-tight">{match.city}</span>
        </div>
      </div>
      <div className={`flex-1 flex flex-col md:flex-row items-center p-2 sm:p-3 lg:p-6 min-w-0 ${featured ? 'pt-8 lg:pt-8' : ''}`}>
        <div className="flex-1 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-3 w-full min-w-0">
          <div className="flex items-center justify-end gap-1.5 sm:gap-2 text-right min-w-0">
            <span className="font-black text-sm lg:text-lg uppercase tracking-wide hidden sm:block truncate">{homeTeam?.name ?? match.home_team_id}</span>
            <span className="font-black text-xs uppercase sm:hidden truncate">{homeTeam?.short_name ?? match.home_team_id}</span>
            <TeamFlag team={homeTeam} />
          </div>
          <div className="flex flex-col items-center gap-1 shrink-0">
            <MatchScore match={match} homeTeam={homeTeam} awayTeam={awayTeam} />
            {isLive && <span className="text-[8px] bg-c4 text-inv px-1 h-3 flex items-center leading-none">{t('ui.live')}</span>}
            {isFinished && <span className="text-[8px] uppercase text-subtle font-black">{t('ui.fullTime')}</span>}
          </div>
          <div className="flex items-center justify-start gap-1.5 sm:gap-2 text-left min-w-0">
            <TeamFlag team={awayTeam} />
            <span className="font-black text-sm lg:text-lg uppercase tracking-wide hidden sm:block truncate">{awayTeam?.name ?? match.away_team_id}</span>
            <span className="font-black text-xs uppercase sm:hidden truncate">{awayTeam?.short_name ?? match.away_team_id}</span>
          </div>
        </div>
        <div className="w-full md:w-auto mt-3 md:mt-0 md:ml-6 grid grid-cols-2 md:flex items-center gap-2 md:gap-3 shrink-0">
          <span className={`${getStatusClass(effectiveStatus)} px-2 sm:px-3 py-1 border-2 border-main uppercase text-center text-[9px] sm:text-[10px]`}>{getStatusLabel(effectiveStatus, t)}</span>
          {isProjected && <span className="bg-c1 text-main px-2 sm:px-3 py-1 border-2 border-main uppercase text-center text-[9px] sm:text-[10px] font-black">{t('ui.projected')}</span>}
          <button onClick={() => onNavigate(`matches/${match.id}`)} className={`${effectiveStatus === 'open' ? 'bg-c2 text-inv hover:opacity-90' : 'bg-card hover:bg-page text-main'} font-black text-[10px] px-3 py-1.5 border-2 border-main uppercase flex items-center justify-center gap-1 min-w-0 md:min-w-24 focus:shadow-none focus:translate-x-[2px] focus:translate-y-[2px] transition-all`}>
            {effectiveStatus === 'open' ? t('matches.predict') : isFinished ? t('matches.results') : t('matches.details')} <ChevronRight size={14} className="-mr-1" strokeWidth={3} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Fixtures({ onNavigate, isVintage, setIsVintage, isDark, setIsDark, isRounded, setIsRounded, hasShadow, setHasShadow, hasFrame, setHasFrame }: FixturesProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const themeControls = { isVintage, setIsVintage, isDark, setIsDark, isRounded, setIsRounded, hasShadow, setHasShadow, hasFrame, setHasFrame };
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [teams, setTeams] = useState<Map<string, TeamRow>>(new Map());
  const [predictions, setPredictions] = useState<PredictionWithMatch[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntryWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stageFilter, setStageFilter] = useState<StageFilter>('group');
  const [matchdayFilter, setMatchdayFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    Promise.all([listMatches(), getTeamMap(), listCurrentUserPredictions(), listGlobalLeaderboard()])
      .then(([nextMatches, nextTeams, nextPredictions, nextLeaderboard]) => {
        if (!active) return;
        setMatches(nextMatches);
        setStageFilter(getDefaultOpenStage(nextMatches));
        setMatchdayFilter('all');
        setStatusFilter('open');
        setPage(1);
        setTeams(nextTeams);
        setPredictions(nextPredictions);
        setLeaderboard(nextLeaderboard.slice(0, 5));
      })
      .catch((nextError) => {
        if (!active) return;
        setError(getErrorMessage(nextError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const knockoutProjection = useMemo(() => buildKnockoutTeamProjection(matches, teams), [matches, teams]);
  const matchesTutorialSteps = useMemo(() => getMatchesTutorialSteps(t), [t]);

  const filteredMatches = useMemo(() => matches.filter((match) => {
    const effectiveStatus = getEffectiveMatchStatus(match);
    const stageMatches = match.stage === stageFilter;
    const matchdayMatches = matchdayFilter === 'all' || String(match.matchday) === matchdayFilter;
    return stageMatches && matchdayMatches && statusMatchesFilter(statusFilter, effectiveStatus);
  }), [matches, matchdayFilter, stageFilter, statusFilter]);

  const matchdays = useMemo(() => Array.from(new Set(matches.filter((match) => match.stage === stageFilter && match.matchday).map((match) => match.matchday))).sort((a, b) => Number(a) - Number(b)), [matches, stageFilter]);
  const pageCount = Math.max(1, Math.ceil(filteredMatches.length / MATCHES_PER_PAGE));
  const currentPage = Math.min(page, pageCount);
  const visibleMatches = filteredMatches.slice((currentPage - 1) * MATCHES_PER_PAGE, currentPage * MATCHES_PER_PAGE);
  const totalMatches = matches.length;
  const liveMatches = matches.filter((match) => getEffectiveMatchStatus(match) === 'live').length;
  const upcomingMatches = matches.filter((match) => ['open', 'scheduled'].includes(getEffectiveMatchStatus(match))).length;
  const completedMatches = matches.filter((match) => getEffectiveMatchStatus(match) === 'finished').length;
  const openMatches = matches.filter(isMatchPredictionOpen).length;
  const submittedCount = predictions.length;
  const nextDeadline = matches.find(isMatchPredictionOpen);
  const nextHomeTeam = nextDeadline ? teams.get(nextDeadline.home_team_id) : undefined;
  const nextAwayTeam = nextDeadline ? teams.get(nextDeadline.away_team_id) : undefined;
  const firstOpenMatchId = filteredMatches.find(isMatchPredictionOpen)?.id;

  function startMatchesTutorial() {
    startTutorialTour(MATCHES_TOUR_ID, matchesTutorialSteps);
  }

  useEffect(() => {
    if (!shouldAutoRunTour({ loading, error, seen: hasSeenTour(MATCHES_TOUR_ID) })) return;
    const timer = window.setTimeout(() => {
      startMatchesTutorial();
      markTourSeen(MATCHES_TOUR_ID);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [error, loading, matchesTutorialSteps]);
  const slipItems = [
    { label: t('ui.submittedPicks'), calculation: t('ui.savedCount', { count: submittedCount }), value: t('ui.picksCount', { count: submittedCount }), icon: <Star size={16} /> },
    { label: t('ui.openMatches'), calculation: t('ui.editableCount', { count: openMatches }), value: `${openMatches}`, icon: <CheckCircle size={16} className="text-c2" /> },
    { label: t('ui.maxExactPoints'), calculation: t('ui.timesPoints', { count: submittedCount, points: 5 }), value: `${submittedCount * 5} ${t('ui.pointsShort')}`, icon: <TrendingUp size={16} className="text-c4" /> },
  ];

  return (
    <AppShell themeControls={themeControls}>
      <div className="relative z-10 flex flex-col p-4 lg:p-6 gap-4 lg:gap-6 min-h-0">
        <div className="bg-card border-4 border-main p-4 lg:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 w-full xl:w-1/2 shadow-[8px_8px_0_0_var(--color-shadow)]">
          <h1 className="text-4xl lg:text-5xl font-black uppercase tracking-tighter mb-1 text-main">
            {t('nav.public.matches')}
          </h1>
          <button type="button" onClick={startMatchesTutorial} className="border-2 border-main bg-c1 text-main px-4 py-2 font-black uppercase text-xs shadow-[3px_3px_0_var(--color-shadow)] hover:bg-c3 inline-flex items-center justify-center gap-2">
            <HelpCircle size={16} strokeWidth={3} />
            {t('tutorial.start')}
          </button>
        </div>

        <div className="bg-card border-4 border-main p-4 lg:p-6 flex flex-col gap-4 lg:gap-6 shadow-[8px_8px_0_0_var(--color-shadow)] rounded-sm">
          <div data-tour="matches-summary" className="grid grid-cols-2 xl:grid-cols-4 border-b-4 border-main">
            <div className="flex items-center gap-2 sm:gap-4 border-b-4 border-r-4 xl:border-b-0 border-main p-2.5 sm:p-4 lg:p-5 bg-c3 text-main min-w-0">
              <div className="shrink-0"><MonitorPlay size={24} className="sm:w-9 sm:h-9" strokeWidth={2.5} /></div>
              <div className="flex flex-col justify-center min-w-0">
                <span className="font-black text-[9px] sm:text-xs uppercase text-main opacity-90 tracking-wide sm:tracking-widest mb-0.5 sm:mb-1 leading-none truncate">{t('ui.totalMatches')}</span>
                <span className="font-black text-xl sm:text-3xl leading-none text-main">{totalMatches}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-4 border-b-4 xl:border-b-0 xl:border-r-4 border-main p-2.5 sm:p-4 lg:p-5 bg-c2 text-inv min-w-0">
              <div className="shrink-0 text-inv"><Activity size={24} className="sm:w-9 sm:h-9" strokeWidth={2.5} /></div>
              <div className="flex flex-col justify-center min-w-0">
                <span className="font-black text-[9px] sm:text-xs uppercase opacity-90 tracking-wide sm:tracking-widest mb-0.5 sm:mb-1 leading-none truncate">{t('ui.liveNow')}</span>
                <span className="font-black text-xl sm:text-3xl leading-none">{liveMatches}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-4 border-r-4 border-main p-2.5 sm:p-4 lg:p-5 bg-c5 text-main min-w-0">
              <div className="shrink-0 text-main"><CalendarDays size={24} className="sm:w-9 sm:h-9" strokeWidth={2.5} /></div>
              <div className="flex flex-col justify-center text-main min-w-0">
                <span className="font-black text-[9px] sm:text-xs uppercase opacity-90 tracking-wide sm:tracking-widest mb-0.5 sm:mb-1 leading-none truncate">{t('ui.upcoming')}</span>
                <span className="font-black text-xl sm:text-3xl leading-none">{upcomingMatches}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-4 border-main p-2.5 sm:p-4 lg:p-5 bg-[#FF6B00] text-main min-w-0">
              <div className="shrink-0 text-main"><Flag size={24} className="sm:w-9 sm:h-9" strokeWidth={2.5} /></div>
              <div className="flex flex-col justify-center text-main min-w-0">
                <span className="font-black text-[9px] sm:text-xs uppercase opacity-90 tracking-wide sm:tracking-widest mb-0.5 sm:mb-1 leading-none truncate">{t('ui.completed')}</span>
                <span className="font-black text-xl sm:text-3xl leading-none">{completedMatches}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row flex-1 items-stretch">
            <div className="flex-1 border-r-0 lg:border-r-4 border-main flex flex-col min-w-0 bg-muted">
              <div data-tour="matches-stage-tabs" className="flex overflow-x-auto border-b-4 border-main font-black text-xs sm:text-sm md:text-base uppercase">
                {(Object.keys(stageLabelKeys) as StageFilter[]).map((stage) => (
                  <button key={stage} onClick={() => { setStageFilter(stage); setMatchdayFilter('all'); setPage(1); }} className={`${stageFilter === stage ? 'bg-c2 text-accent-inv' : 'bg-card text-main hover:bg-elevated'} px-3 sm:px-4 md:px-6 py-3 border-r-4 border-main shrink-0 whitespace-nowrap`}>
                    {t(stageLabelKeys[stage])}
                  </button>
                ))}
              </div>

              <div data-tour="matches-filters" className="flex flex-col sm:flex-row items-center justify-between p-3 border-b-4 border-main bg-card gap-3 relative z-20">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 w-full">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
                    {stageFilter === 'group' && (
                      <div className="relative flex-1 md:flex-none">
                        <select value={matchdayFilter} onChange={(event) => { setMatchdayFilter(event.target.value); setPage(1); }} className="appearance-none w-full md:w-40 border-2 border-main py-2 pl-3 pr-8 font-black uppercase text-xs bg-card outline-none cursor-pointer focus:translate-y-[2px] focus:translate-x-[2px] focus:shadow-none transition-all">
                          <option value="all">{t('ui.allMatchdays')}</option>
                          {matchdays.map((matchday) => <option key={matchday} value={String(matchday)}>{t('ui.matchdayLabel', { matchday })}</option>)}
                        </select>
                        <ChevronDown size={14} strokeWidth={3} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    )}
                    <div className="flex items-center gap-2 border-2 border-main py-2 px-3 bg-page font-bold text-xs uppercase flex-1 md:flex-none justify-center min-w-0">
                      <Calendar size={14} className="text-main shrink-0" />
                      <span className="truncate">{formatDateRange(filteredMatches, t)}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center border-2 border-main font-bold text-xs uppercase self-stretch md:self-auto overflow-hidden w-full md:w-auto">
                    {(['all', 'open', 'locked', 'live', 'finished'] as StatusFilter[]).map((status) => (
                      <button key={status} onClick={() => { setStatusFilter(status); setPage(1); }} className={`${statusFilter === status ? 'bg-c2 text-accent-inv' : 'bg-card hover:bg-elevated text-main'} px-4 py-1.5 flex-1 md:flex-none border-r-2 border-main border-b-2 sm:border-b-0 last:border-r-0`}>
                        {getStatusLabel(status, t)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div data-tour="matches-list" className="flex flex-col bg-card">
                {loading && <div className="p-6 font-black uppercase text-sm">{t('ui.loadingMatches')}</div>}
                {error && <div className="p-6 font-black uppercase text-sm bg-c5 text-main border-b-4 border-main">{error}</div>}
                {!loading && !error && filteredMatches.length === 0 && <div className="p-6 font-black uppercase text-sm">{t('ui.noMatchesForFilter')}</div>}
                {!loading && !error && visibleMatches.map((match) => {
                  const projection = knockoutProjection.get(match.id);
                  return (
                    <MatchListRow
                      key={match.id}
                      match={match}
                      homeTeam={teams.get(projection?.home.teamId ?? match.home_team_id)}
                      awayTeam={teams.get(projection?.away.teamId ?? match.away_team_id)}
                      projection={projection}
                      featured={match.id === firstOpenMatchId}
                      onNavigate={onNavigate}
                      t={t}
                    />
                  );
                })}
                {!loading && !error && filteredMatches.length > MATCHES_PER_PAGE && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-card border-b-4 border-main font-black uppercase text-xs">
                    <span>
                      {t('ui.showingRange', { start: (currentPage - 1) * MATCHES_PER_PAGE + 1, end: Math.min(currentPage * MATCHES_PER_PAGE, filteredMatches.length), total: filteredMatches.length })}
                    </span>
                    <div className="flex items-center border-2 border-main overflow-hidden">
                      <button type="button" disabled={currentPage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="px-4 py-2 border-r-2 border-main bg-card disabled:bg-muted disabled:text-subtle hover:bg-elevated">
                        {t('ui.previous')}
                      </button>
                      <span className="px-4 py-2 bg-page border-r-2 border-main">{t('ui.pageCount', { current: currentPage, total: pageCount })}</span>
                      <button type="button" disabled={currentPage === pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))} className="px-4 py-2 bg-card disabled:bg-muted disabled:text-subtle hover:bg-elevated">
                        {t('ui.next')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="w-full lg:w-[420px] bg-card flex flex-col shrink-0 self-stretch relative z-20">
              <div data-tour="matches-deadline" className="flex flex-col border-b-4 border-main bg-page">
                <div className="bg-main text-inv font-black uppercase text-xs py-3 px-4 min-h-[48px] flex items-center border-b-4 border-main">
                  {t('appPages.predictions.nextDeadline')}
                </div>
                <div className="p-4 flex flex-col items-center text-center">
                  <Clock size={24} className="mb-2 text-main" />
                  <span className="font-bold text-[10px] uppercase mb-1">{t('ui.predictionsLockIn')}</span>
                  <span className="font-black text-4xl xl:text-5xl text-c4 font-mono tracking-tighter w-full mb-1">{nextDeadline ? formatTime(nextDeadline.lock_at) : '—'}</span>
                  <span className="font-black text-xs uppercase">{nextDeadline ? formatDate(nextDeadline.lock_at) : t('ui.noOpenDeadline')}</span>
                  <span className="font-bold text-xs text-subtle mt-0.5 mb-4">{nextDeadline ? `${nextHomeTeam?.name ?? nextDeadline.home_team_id} vs ${nextAwayTeam?.name ?? nextDeadline.away_team_id}` : t('ui.checkBackFixtures')}</span>
                  <button onClick={() => onNavigate('my-predictions')} className="w-full bg-c2 hover:opacity-90 text-inv font-black text-xs uppercase py-3 border-2 border-main flex items-center justify-center gap-2 transition-transform active:translate-y-[2px] active:translate-x-[2px] active:shadow-none focus:outline-none">
                    {t('ui.viewAll')} <ChevronRight size={16} strokeWidth={3} />
                  </button>
                </div>
              </div>

              <div data-tour="matches-slip" className="flex flex-col border-b-4 border-main">
                <div className="bg-main text-inv font-black px-4 py-3 uppercase tracking-wide text-sm flex justify-between items-center border-b-4 border-main">
                  <span>{t('ui.mySlip')}</span>
                  <span className="text-c1 font-bold text-xs"><span className="text-accent-inv">{submittedCount}/64</span> {t('ui.picksMade')}</span>
                </div>
                <div className="bg-muted p-4 flex flex-col gap-3 text-sm">
                  {slipItems.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between border-b border-line pb-2 last:border-0 last:pb-0">
                      <div className="flex items-center gap-2 font-bold text-subtle">
                        <div className="w-6 h-6 bg-card border border-line flex items-center justify-center shrink-0">{item.icon}</div>
                        {item.label}
                      </div>
                      <div className="flex items-center gap-4 text-right">
                        <span className="text-xs text-faint font-medium">{item.calculation}</span>
                        <span className="font-black w-14">{item.value}</span>
                      </div>
                    </div>
                  ))}
                  <div className="mt-2 pt-3 border-t-2 border-main flex items-center justify-between font-black uppercase">
                    <span className="text-subtle text-sm">{t('ui.totalPotentialPoints')}</span>
                    <span className="text-xl">{submittedCount * 5} {t('ui.pointsShort')}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col border-b-4 border-main">
                <div className="bg-main text-inv font-black px-4 py-2 uppercase tracking-wide text-[11px] flex justify-between items-center">
                  <span>{t('ui.yourPredictions')} ({submittedCount})</span>
                  <button className="text-faint font-bold hover:text-inv cursor-pointer" onClick={() => onNavigate('my-predictions')}>{t('ui.viewAll')}</button>
                </div>
                <div className="flex flex-col bg-card p-2 gap-1.5">
                  {predictions.slice(0, 5).map((prediction) => {
                    const match = prediction.matches;
                    if (!match) return null;
                    const homeTeam = teams.get(match.home_team_id);
                    const awayTeam = teams.get(match.away_team_id);
                    return (
                      <div key={prediction.id} className="flex items-center justify-between text-xs font-bold border border-line p-2 gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="truncate">{homeTeam?.short_name ?? 'TBD'}</span>
                          <span className="text-faint font-normal text-[10px]">{t('ui.vs')}</span>
                          <span className="truncate">{awayTeam?.short_name ?? 'TBD'}</span>
                        </div>
                        <div className="font-black px-2 shrink-0">{prediction.prediction_type === 'exact_score' && typeof prediction.home_score === 'number' && typeof prediction.away_score === 'number' ? `${prediction.home_score} - ${prediction.away_score}` : prediction.predicted_outcome.toUpperCase()}</div>
                        <div className="text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-sm border border-main font-black bg-c3 text-accent-on shrink-0">{prediction.status}</div>
                      </div>
                    );
                  })}
                  {predictions.length === 0 && <div className="p-2 font-black uppercase text-xs text-subtle">{t('ui.noSavedPicks')}</div>}
                </div>
              </div>

              <div className="hidden xl:flex flex-col border-b-4 border-main">
                <div className="bg-main text-inv font-black px-4 py-2 uppercase tracking-wide text-[11px] flex justify-between items-center">
                  <span>{t('ui.topPlayersThisWeek')}</span>
                  <button className="text-faint font-bold hover:text-inv cursor-pointer" onClick={() => onNavigate('leaderboard')}>{t('ui.viewAll')}</button>
                </div>
                <div className="flex flex-col bg-card">
                  {leaderboard.map((item) => (
                    <div key={item.user_id} className="flex border-b border-line last:border-b-0 items-stretch hover:bg-elevated transition-colors text-sm">
                      <div className="w-10 border-r border-line flex items-center justify-center font-black bg-c1 text-accent-on">{item.rank}</div>
                      <div className="p-2 border-r border-line flex items-center justify-center bg-elevated"><User size={14} strokeWidth={3} className="text-main" /></div>
                      <div className="flex-1 p-2 font-bold flex items-center min-w-0 truncate">{getPublicDisplayName(item.profiles, item.user_id)}</div>
                      <div className="p-2 font-black flex items-center justify-end text-main whitespace-nowrap">{item.points.toLocaleString()} {t('ui.pointsShort')}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-row flex-1">
                <div className="flex-1 flex flex-col border-r-4 border-main">
                  <div className="bg-main text-inv font-black px-3 py-2 uppercase tracking-wide text-[11px]">{t('ui.scoring')} {t('nav.public.rules')}</div>
                  <div className="p-3 flex flex-col gap-2 font-bold text-xs bg-card text-subtle">
                    <div className="flex items-center gap-2"><div className="bg-c1 p-1 border border-main flex items-center justify-center"><Target size={14} strokeWidth={2.5} className="text-accent-on"/></div><span>{t('ui.exactScoreFive')}</span></div>
                    <div className="flex items-center gap-2"><div className="bg-c2 p-1 border border-main flex items-center justify-center"><CheckCircle size={14} strokeWidth={2.5} className="text-accent-inv"/></div><span>{t('ui.correctOutcomeTwo')}</span></div>
                    <div className="flex items-center gap-2"><div className="bg-c4 p-1 border border-main flex items-center justify-center"><TrendingUp size={14} strokeWidth={2.5} className="text-accent-inv"/></div><span>{t('ui.streakBonusFive')}</span></div>
                  </div>
                </div>

                <div className="flex-1 flex flex-col bg-muted">
                  <div className="bg-main text-inv font-black px-3 py-2 uppercase tracking-wide text-[11px]">{t('appPages.predictions.nextDeadline')}</div>
                  <div className="p-4 flex flex-col justify-center items-center h-full gap-1 pt-2">
                    <div className="text-3xl font-black text-c5 tracking-tighter">{nextDeadline ? formatTime(nextDeadline.lock_at) : '—'}</div>
                    <div className="text-center font-bold text-xs leading-tight">{nextDeadline ? `${formatDate(nextDeadline.lock_at)} ${nextHomeTeam?.short_name ?? 'TBD'} ${t('ui.vs')} ${nextAwayTeam?.short_name ?? 'TBD'}` : t('ui.noOpenMatch')}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div data-tour="matches-how-to-play" className="flex flex-col lg:flex-row border-t-4 border-main bg-card overflow-hidden w-full uppercase shrink-0">
            <div className="flex-1 flex border-b-4 lg:border-b-0 lg:border-r-4 border-main min-h-[90px] xl:min-h-[100px]">
              <div className="w-[4.5rem] bg-c3 flex justify-center items-center border-r-4 border-main shrink-0 text-main pb-1"><span className="font-black text-6xl leading-none">1</span></div>
              <div className="w-16 bg-c3 flex justify-center items-center border-r-4 border-main shrink-0 text-main"><Binoculars size={28} strokeWidth={2.5}/></div>
              <div className="flex flex-col justify-center p-3 flex-1 bg-page"><span className="font-black text-[13px] xl:text-sm tracking-wide">{t('ui.browseFixtures')}</span><span className="text-[10px] xl:text-[11px] font-bold leading-[1.2] capitalize text-subtle mt-1 max-w-[170px]">{t('ui.browseFixturesBody')}</span></div>
            </div>
            <div className="flex-1 flex border-b-4 lg:border-b-0 lg:border-r-4 border-main min-h-[90px] xl:min-h-[100px]">
              <div className="w-[4.5rem] bg-c2 flex justify-center items-center border-r-4 border-main shrink-0 text-inv pb-1"><span className="font-black text-6xl leading-none">2</span></div>
              <div className="w-16 bg-c2 flex justify-center items-center border-r-4 border-main shrink-0 text-inv"><Pencil size={28} strokeWidth={2.5}/></div>
              <div className="flex flex-col justify-center p-3 flex-1 bg-page"><span className="font-black text-[13px] xl:text-sm tracking-wide">{t('ui.pickMatches')}</span><span className="text-[10px] xl:text-[11px] font-bold leading-[1.2] capitalize text-subtle mt-1 max-w-[170px]">{t('ui.makePredictionsBeforeKickoff')}</span></div>
            </div>
            <div className="flex-1 flex border-b-4 lg:border-b-0 lg:border-r-4 border-main min-h-[90px] xl:min-h-[100px]">
              <div className="w-[4.5rem] bg-c5 flex justify-center items-center border-r-4 border-main shrink-0 text-main pb-1"><span className="font-black text-6xl leading-none">3</span></div>
              <div className="w-16 bg-c5 flex justify-center items-center border-r-4 border-main shrink-0 text-main"><BarChart2 size={28} strokeWidth={2.5}/></div>
              <div className="flex flex-col justify-center p-3 flex-1 bg-page"><span className="font-black text-[13px] xl:text-sm tracking-wide">{t('ui.trackResults')}</span><span className="text-[10px] xl:text-[11px] font-bold leading-[1.2] capitalize text-subtle mt-1 max-w-[170px]">{t('ui.trackResultsBody')}</span></div>
            </div>
            <div className="flex-1 flex min-h-[90px] xl:min-h-[100px]">
              <div className="w-[4.5rem] bg-[#FF6B00] flex justify-center items-center border-r-4 border-main shrink-0 text-main pb-1"><span className="font-black text-6xl leading-none">4</span></div>
              <div className="w-16 bg-[#FF6B00] flex justify-center items-center border-r-4 border-main shrink-0 text-main"><Trophy size={28} strokeWidth={2.5}/></div>
              <div className="flex flex-col justify-center p-3 flex-1 bg-page"><span className="font-black text-[13px] xl:text-sm tracking-wide">{t('ui.climbLeaderboard')}</span><span className="text-[10px] xl:text-[11px] font-bold leading-[1.2] capitalize text-subtle mt-1 max-w-[170px]">{t('ui.climbLeaderboardBody')}</span></div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
