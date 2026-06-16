import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CalendarClock, Lock, MapPin, Save, ShieldCheck, Target, Trophy } from 'lucide-react';
import AppShell from '../components/layout/AppShell';
import PageHero from '../components/ui/PageHero';
import Panel from '../components/ui/Panel';
import StatCard from '../components/ui/StatCard';
import StatusPill from '../components/ui/StatusPill';
import { getMatchById } from '../data/mockMatches';
import { mockPredictions } from '../data/mockPredictions';
import { getTeamById } from '../data/mockTeams';
import { currentUserId } from '../data/mockUsers';
import { calculatePredictionScore, getPredictionOutcome } from '../lib/scoring';
import type { ThemeControls } from '../App';
import type { Match, MatchResult, Prediction, PredictionDisplayStatus } from '../types/domain';

type MatchDetailProps = {
  themeControls: ThemeControls;
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(new Date(value));
}

function getMatchResult(match: Match): MatchResult | undefined {
  if (typeof match.homeScore !== 'number' || typeof match.awayScore !== 'number') return undefined;
  return { homeScore: match.homeScore, awayScore: match.awayScore };
}

function getDisplayStatus(prediction?: Prediction, result?: MatchResult): PredictionDisplayStatus {
  if (!prediction) return 'pending';
  if (!result) return prediction.status === 'locked' ? 'locked' : 'pending';
  return getPredictionOutcome(prediction, result);
}

function getStatusTone(status: Match['status']) {
  if (status === 'open') return 'bg-c3 text-main';
  if (status === 'locked') return 'bg-c1 text-main';
  if (status === 'finished') return 'bg-muted text-main';
  if (status === 'live') return 'bg-c4 text-inv';
  return 'bg-card text-main';
}

export default function MatchDetail({ themeControls }: MatchDetailProps) {
  const { matchId } = useParams();
  const match = matchId ? getMatchById(matchId) : undefined;
  const existingPrediction = match ? mockPredictions.find((prediction) => prediction.userId === currentUserId && prediction.matchId === match.id) : undefined;
  const [homeScore, setHomeScore] = useState(existingPrediction?.homeScore.toString() ?? '');
  const [awayScore, setAwayScore] = useState(existingPrediction?.awayScore.toString() ?? '');
  const [submittedPrediction, setSubmittedPrediction] = useState<Prediction | undefined>(existingPrediction);
  const [savedAt, setSavedAt] = useState<string | undefined>();

  const homeTeam = match ? getTeamById(match.homeTeamId) : undefined;
  const awayTeam = match ? getTeamById(match.awayTeamId) : undefined;
  const result = match ? getMatchResult(match) : undefined;
  const isLocked = !match || match.status === 'locked' || match.status === 'finished' || match.status === 'live';
  const displayStatus = getDisplayStatus(submittedPrediction, result);

  const scoreBreakdown = useMemo(() => {
    if (!submittedPrediction || !result) return undefined;
    return calculatePredictionScore(submittedPrediction, result, { riskMultiplier: submittedPrediction.isRiskPick ? 1 : 1 });
  }, [submittedPrediction, result]);

  if (!match || !homeTeam || !awayTeam) {
    return (
      <AppShell themeControls={themeControls}>
        <div className="relative z-10 flex flex-col p-4 lg:p-6 gap-4 lg:gap-6 bg-page flex-1">
          <PageHero title="Match Not Found" description="This match is not available in the current World Cup 2026 schedule mock data." />
          <Panel>
            <div className="p-6 bg-card font-bold flex flex-col gap-4">
              <p>Choose another fixture from the matches page.</p>
              <Link to="/matches" className="bg-c2 text-inv font-black uppercase py-3 px-4 border-2 border-main shadow-[3px_3px_0_var(--color-shadow)] w-fit">Back to Matches</Link>
            </div>
          </Panel>
        </div>
      </AppShell>
    );
  }

  const handleSubmit = () => {
    const nextHomeScore = Number(homeScore);
    const nextAwayScore = Number(awayScore);
    if (!Number.isInteger(nextHomeScore) || !Number.isInteger(nextAwayScore) || nextHomeScore < 0 || nextAwayScore < 0) return;

    setSubmittedPrediction({
      id: existingPrediction?.id ?? `local-${match.id}`,
      userId: currentUserId,
      matchId: match.id,
      homeScore: nextHomeScore,
      awayScore: nextAwayScore,
      confidence: existingPrediction?.confidence ?? 70,
      isRiskPick: existingPrediction?.isRiskPick ?? false,
      createdAt: existingPrediction?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lockedAt: existingPrediction?.lockedAt,
      status: existingPrediction?.status ?? 'submitted',
      revision: (existingPrediction?.revision ?? 0) + 1,
    });
    setSavedAt(new Date().toISOString());
  };

  return (
    <AppShell themeControls={themeControls}>
      <div className="relative z-10 flex flex-col p-4 lg:p-6 gap-4 lg:gap-6 bg-page flex-1">
        <PageHero title={`${homeTeam.name} vs ${awayTeam.name}`} description="Review match context, lock timing, and your exact-score prediction before kickoff.">
          <div className={`border-4 border-main px-4 py-2 font-black uppercase text-xs shadow-[3px_3px_0_var(--color-shadow)] ${getStatusTone(match.status)}`}>{match.status}</div>
        </PageHero>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-6">
          <StatCard label="Kickoff" value={formatDateTime(match.kickoffAt)} subtitle="World Cup 2026" tone="blue" icon={<CalendarClock size={34} strokeWidth={2.5} />} />
          <StatCard label="Prediction Lock" value={formatDateTime(match.lockAt)} subtitle="Submit before this" tone="lime" icon={<Lock size={34} strokeWidth={2.5} />} />
          <StatCard label="Stage" value={`Group ${match.group ?? '-'}`} subtitle={`Matchday ${match.matchday ?? '-'}`} tone="green" icon={<Trophy size={34} strokeWidth={2.5} />} />
          <StatCard label="Points" value={scoreBreakdown?.total ?? '—'} subtitle="Current earned" tone="orange" icon={<Target size={34} strokeWidth={2.5} />} />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-4 lg:gap-6 items-start">
          <Panel title="Match Card" className="overflow-hidden">
            <div className="bg-card p-5 lg:p-8 flex flex-col gap-6">
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 lg:gap-6">
                <div className="text-right">
                  <div className="font-black text-3xl lg:text-6xl uppercase tracking-tighter">{homeTeam.shortName}</div>
                  <div className="font-bold text-subtle uppercase text-xs lg:text-sm mt-1">{homeTeam.name}</div>
                  <div className="font-bold text-subtle uppercase text-[10px] mt-2">FIFA Rank #{homeTeam.fifaRank ?? '—'}</div>
                </div>
                <div className="border-4 border-main bg-page shadow-[4px_4px_0_var(--color-shadow)] px-4 py-3 lg:px-6 lg:py-4 font-black text-2xl lg:text-5xl">
                  {result ? `${result.homeScore} - ${result.awayScore}` : 'VS'}
                </div>
                <div>
                  <div className="font-black text-3xl lg:text-6xl uppercase tracking-tighter">{awayTeam.shortName}</div>
                  <div className="font-bold text-subtle uppercase text-xs lg:text-sm mt-1">{awayTeam.name}</div>
                  <div className="font-bold text-subtle uppercase text-[10px] mt-2">FIFA Rank #{awayTeam.fifaRank ?? '—'}</div>
                </div>
              </div>

              <div className="border-4 border-main bg-muted p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 font-bold">
                <div className="flex items-center gap-2"><MapPin size={18} /> {match.stadium}</div>
                <div className="uppercase text-subtle">{match.city}</div>
              </div>
            </div>
          </Panel>

          <Panel title="Your Exact Score">
            <div className="p-4 bg-card flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3">
                <span className="font-black uppercase text-xs text-subtle">Prediction status</span>
                <StatusPill status={displayStatus} />
              </div>

              <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-end">
                <label className="flex flex-col gap-2">
                  <span className="font-black uppercase text-[10px]">{homeTeam.shortName}</span>
                  <input type="number" min="0" value={homeScore} disabled={isLocked} onChange={(event) => setHomeScore(event.target.value)} className="w-full border-[3px] border-main bg-card p-3 text-center font-black text-3xl shadow-[3px_3px_0_var(--color-shadow)] outline-none disabled:bg-muted" />
                </label>
                <div className="font-black text-3xl pb-3">-</div>
                <label className="flex flex-col gap-2">
                  <span className="font-black uppercase text-[10px] text-right">{awayTeam.shortName}</span>
                  <input type="number" min="0" value={awayScore} disabled={isLocked} onChange={(event) => setAwayScore(event.target.value)} className="w-full border-[3px] border-main bg-card p-3 text-center font-black text-3xl shadow-[3px_3px_0_var(--color-shadow)] outline-none disabled:bg-muted" />
                </label>
              </div>

              <button type="button" disabled={isLocked} onClick={handleSubmit} className="bg-c2 disabled:bg-muted disabled:text-subtle text-inv font-black uppercase py-3 px-4 border-2 border-main shadow-[4px_4px_0_var(--color-shadow)] flex items-center justify-center gap-2 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all">
                <Save size={18} strokeWidth={3} /> Save Mock Prediction
              </button>

              <div className="border-2 border-main bg-page p-3 text-xs font-bold text-subtle leading-relaxed">
                {isLocked ? 'This match is locked or already finished, so prediction editing is disabled in this frontend mock.' : 'Frontend-only mock save: this updates the page state for your current session without calling a backend.'}
              </div>

              {savedAt && <div className="bg-c3 border-2 border-main p-3 font-black uppercase text-xs flex items-center gap-2"><ShieldCheck size={16} /> Saved locally at {formatDateTime(savedAt)}</div>}

              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <Link to="/my-predictions" className="flex-1 text-center bg-card hover:bg-muted text-main font-black uppercase py-3 px-4 border-2 border-main shadow-[3px_3px_0_var(--color-shadow)] text-xs">My Predictions</Link>
                {submittedPrediction && (
                  <Link to={`/predictions/${submittedPrediction.id}`} className="flex-1 text-center bg-c1 text-main font-black uppercase py-3 px-4 border-2 border-main shadow-[3px_3px_0_var(--color-shadow)] text-xs">View Breakdown</Link>
                )}
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}
