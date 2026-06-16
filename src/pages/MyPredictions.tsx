import { Link } from 'react-router-dom';
import { BarChart2, Flame, ListChecks, Star } from 'lucide-react';
import AppShell from '../components/layout/AppShell';
import PageHero from '../components/ui/PageHero';
import Panel from '../components/ui/Panel';
import StatCard from '../components/ui/StatCard';
import StatusPill from '../components/ui/StatusPill';
import { getMatchById } from '../data/mockMatches';
import { mockPredictions } from '../data/mockPredictions';
import { getTeamById } from '../data/mockTeams';
import { calculateAccuracy, calculatePredictionScore, calculateStreak, getPredictionOutcome } from '../lib/scoring';
import type { ThemeControls } from '../App';
import type { Match, MatchResult, Prediction, PredictionDisplayStatus } from '../types/domain';

type MyPredictionsProps = {
  themeControls: ThemeControls;
};

type PredictionRow = {
  prediction: Prediction;
  match: Match;
  result?: MatchResult;
  status: PredictionDisplayStatus;
  points: number;
};

function getMatchResult(match: Match): MatchResult | undefined {
  if (typeof match.homeScore !== 'number' || typeof match.awayScore !== 'number') return undefined;
  return { homeScore: match.homeScore, awayScore: match.awayScore };
}

function getDisplayStatus(prediction: Prediction, result?: MatchResult): PredictionDisplayStatus {
  if (!result) return prediction.status === 'locked' ? 'locked' : 'pending';
  return getPredictionOutcome(prediction, result);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function getTeamName(teamId: string) {
  return getTeamById(teamId)?.name ?? 'Unknown Team';
}

function getTeamShortName(teamId: string) {
  return getTeamById(teamId)?.shortName ?? 'TBD';
}

export default function MyPredictions({ themeControls }: MyPredictionsProps) {
  const rows: PredictionRow[] = mockPredictions.flatMap((prediction) => {
    const match = getMatchById(prediction.matchId);
    if (!match) return [];

    const result = getMatchResult(match);
    const score = result ? calculatePredictionScore(prediction, result, { riskMultiplier: prediction.isRiskPick ? 1 : 1 }) : undefined;

    return [{
      prediction,
      match,
      result,
      status: getDisplayStatus(prediction, result),
      points: score?.total ?? 0,
    }];
  });

  const scoredItems = rows.map((row) => ({ prediction: row.prediction, result: row.result }));
  const exactScores = rows.filter((row) => row.status === 'exact').length;
  const accuracy = calculateAccuracy(scoredItems);
  const currentStreak = calculateStreak(scoredItems);

  return (
    <AppShell themeControls={themeControls}>
      <div className="relative z-10 flex flex-col p-4 lg:p-6 gap-4 lg:gap-6 bg-page flex-1">
        <PageHero title="My Predictions" description="Track every pick, result, status, and point total from your World Cup 2026 prediction run." />

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-6">
          <StatCard label="Total Picks" value={rows.length} subtitle="Submitted so far" tone="blue" icon={<ListChecks size={36} strokeWidth={2.5} />} />
          <StatCard label="Exact Scores" value={exactScores} subtitle="Perfect calls" tone="lime" icon={<Star size={36} strokeWidth={2.5} fill="currentColor" />} />
          <StatCard label="Accuracy" value={`${accuracy}%`} subtitle="Exact or outcome" tone="green" icon={<BarChart2 size={36} strokeWidth={2.5} />} />
          <StatCard label="Current Streak" value={currentStreak} subtitle="Correct results" tone="orange" icon={<Flame size={36} strokeWidth={2.5} />} />
        </div>

        <div className="flex flex-col xl:flex-row gap-4 lg:gap-6 items-start">
          <Panel title="Prediction History" className="flex-1 w-full overflow-hidden">
            <div className="hidden lg:grid grid-cols-[140px_1.4fr_140px_140px_120px_90px_150px] bg-card border-b-4 border-main font-black uppercase text-[10px] tracking-widest text-subtle">
              <div className="p-3 border-r-2 border-main">Kickoff</div>
              <div className="p-3 border-r-2 border-main">Match</div>
              <div className="p-3 border-r-2 border-main text-center">Your Pick</div>
              <div className="p-3 border-r-2 border-main text-center">Actual</div>
              <div className="p-3 border-r-2 border-main text-center">Status</div>
              <div className="p-3 border-r-2 border-main text-center">Points</div>
              <div className="p-3 text-center">Action</div>
            </div>

            <div className="flex flex-col bg-card">
              {rows.map(({ prediction, match, result, status, points }) => (
                <div key={prediction.id} className="grid grid-cols-1 lg:grid-cols-[140px_1.4fr_140px_140px_120px_90px_150px] border-b-2 border-line last:border-b-0 font-bold text-sm hover:bg-muted transition-colors">
                  <div className="p-3 lg:border-r-2 border-main text-subtle uppercase text-xs font-black">{formatDate(match.kickoffAt)}</div>
                  <div className="p-3 lg:border-r-2 border-main">
                    <Link to={`/matches/${match.id}`} className="font-black uppercase text-main hover:text-c2 hover:underline">{getTeamName(match.homeTeamId)} vs {getTeamName(match.awayTeamId)}</Link>
                    <div className="text-xs text-subtle uppercase mt-1">{match.stadium} • {match.city}</div>
                  </div>
                  <div className="p-3 lg:border-r-2 border-main text-left lg:text-center font-black">
                    <span className="lg:hidden text-[10px] uppercase text-subtle mr-2">Pick</span>
                    {getTeamShortName(match.homeTeamId)} {prediction.homeScore} - {prediction.awayScore} {getTeamShortName(match.awayTeamId)}
                  </div>
                  <div className="p-3 lg:border-r-2 border-main text-left lg:text-center font-black">
                    <span className="lg:hidden text-[10px] uppercase text-subtle mr-2">Actual</span>
                    {result ? `${result.homeScore} - ${result.awayScore}` : '—'}
                  </div>
                  <div className="p-3 lg:border-r-2 border-main flex lg:justify-center"><StatusPill status={status} /></div>
                  <div className="p-3 lg:border-r-2 border-main text-left lg:text-center font-black text-lg">{points}</div>
                  <div className="p-3 flex lg:justify-center">
                    <Link to={`/predictions/${prediction.id}`} className="bg-card hover:bg-muted text-main font-black text-[10px] px-3 py-2 border-2 border-main uppercase shadow-[2px_2px_0_var(--color-shadow)]">
                      View Breakdown
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <div className="w-full xl:w-[360px] flex flex-col gap-4">
            <Panel title="Points Breakdown">
              <div className="p-4 bg-card flex flex-col gap-3 text-sm font-bold">
                <div className="flex justify-between border-b-2 border-line pb-2"><span>Exact score points</span><span className="font-black">{exactScores * 3}</span></div>
                <div className="flex justify-between border-b-2 border-line pb-2"><span>Outcome points</span><span className="font-black">{rows.reduce((sum, row) => sum + (row.status === 'correct' ? 1 : 0), 0)}</span></div>
                <div className="flex justify-between border-b-2 border-line pb-2"><span>Streak bonus</span><span className="font-black">Placeholder</span></div>
                <div className="flex justify-between border-b-2 border-line pb-2"><span>Risk multiplier</span><span className="font-black">Placeholder</span></div>
                <div className="flex justify-between text-lg uppercase"><span>Total earned</span><span className="font-black">{rows.reduce((sum, row) => sum + row.points, 0)} PTS</span></div>
              </div>
            </Panel>

            <Panel title="Next Deadline">
              <div className="p-4 bg-c1 text-main font-black uppercase">
                USA vs South Korea locks Jun 15, 20:45 UTC.
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
