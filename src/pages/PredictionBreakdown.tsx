import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, BarChart2, CheckCircle2, Flame, ShieldCheck, Target, Trophy } from 'lucide-react';
import AppShell from '../components/layout/AppShell';
import PageHero from '../components/ui/PageHero';
import Panel from '../components/ui/Panel';
import StatCard from '../components/ui/StatCard';
import StatusPill from '../components/ui/StatusPill';
import { getMatchById } from '../data/mockMatches';
import { mockPredictions } from '../data/mockPredictions';
import { getTeamById } from '../data/mockTeams';
import { calculatePredictionScore, getPredictionOutcome } from '../lib/scoring';
import type { ThemeControls } from '../App';
import type { Match, MatchResult, Prediction, PredictionDisplayStatus } from '../types/domain';

type PredictionBreakdownProps = {
  themeControls: ThemeControls;
};

type BreakdownLineProps = {
  label: string;
  value: string | number;
  description: string;
  tone?: string;
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

function BreakdownLine({ label, value, description, tone = 'bg-card' }: BreakdownLineProps) {
  return (
    <div className={`grid grid-cols-[1fr_auto] gap-4 border-b-2 border-line last:border-b-0 p-4 ${tone}`}>
      <div>
        <div className="font-black uppercase text-sm">{label}</div>
        <div className="font-bold text-xs text-subtle mt-1">{description}</div>
      </div>
      <div className="font-black text-2xl text-right">{value}</div>
    </div>
  );
}

export default function PredictionBreakdown({ themeControls }: PredictionBreakdownProps) {
  const { predictionId } = useParams();
  const prediction = mockPredictions.find((item) => item.id === predictionId);
  const match = prediction ? getMatchById(prediction.matchId) : undefined;
  const homeTeam = match ? getTeamById(match.homeTeamId) : undefined;
  const awayTeam = match ? getTeamById(match.awayTeamId) : undefined;

  if (!prediction || !match || !homeTeam || !awayTeam) {
    return (
      <AppShell themeControls={themeControls}>
        <div className="relative z-10 flex flex-col p-4 lg:p-6 gap-4 lg:gap-6 bg-page flex-1">
          <PageHero title="Prediction Not Found" description="This scoring breakdown is not available in the current frontend mock data." />
          <Panel>
            <div className="p-6 bg-card font-bold flex flex-col gap-4">
              <p>Open a prediction from your prediction history.</p>
              <Link to="/my-predictions" className="bg-c2 text-inv font-black uppercase py-3 px-4 border-2 border-main shadow-[3px_3px_0_var(--color-shadow)] w-fit">Back to My Predictions</Link>
            </div>
          </Panel>
        </div>
      </AppShell>
    );
  }

  const result = getMatchResult(match);
  const score = result ? calculatePredictionScore(prediction, result, { riskMultiplier: prediction.isRiskPick ? 1 : 1 }) : undefined;
  const status = getDisplayStatus(prediction, result);

  return (
    <AppShell themeControls={themeControls}>
      <div className="relative z-10 flex flex-col p-4 lg:p-6 gap-4 lg:gap-6 bg-page flex-1">
        <PageHero title="Prediction Breakdown" description="Transparent scoring details for your exact-score prediction.">
          <StatusPill status={status} />
        </PageHero>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-6">
          <StatCard label="Your Pick" value={`${homeTeam.shortName} ${prediction.homeScore}-${prediction.awayScore} ${awayTeam.shortName}`} subtitle="Exact score prediction" tone="blue" icon={<Target size={34} strokeWidth={2.5} />} />
          <StatCard label="Actual Result" value={result ? `${result.homeScore}-${result.awayScore}` : 'Pending'} subtitle={match.status} tone="lime" icon={<Trophy size={34} strokeWidth={2.5} />} />
          <StatCard label="Total Points" value={score?.total ?? '—'} subtitle="Current earned" tone="green" icon={<BarChart2 size={34} strokeWidth={2.5} />} />
          <StatCard label="Revision" value={prediction.revision} subtitle={`Updated ${formatDate(prediction.updatedAt)}`} tone="orange" icon={<ShieldCheck size={34} strokeWidth={2.5} />} />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-4 lg:gap-6 items-start">
          <Panel title="Scoring Ledger" className="overflow-hidden">
            <div className="bg-card">
              <BreakdownLine label="Exact score" value={score?.exactScore ?? 'Pending'} description="Awarded when both team scores match the final result. Exact score is worth 3 points." tone={score?.exactScore ? 'bg-c3' : 'bg-card'} />
              <BreakdownLine label="Correct outcome" value={score?.correctOutcome ?? 'Pending'} description="Awarded when the win/draw/loss outcome is correct but the exact score is not. Correct outcome is worth 1 point." tone={score?.correctOutcome ? 'bg-c1' : 'bg-card'} />
              <BreakdownLine label="Streak bonus" value={score?.streakBonus ?? 'Placeholder'} description="Reserved for future streak rules. Phase 2 keeps this visible but not fully integrated." />
              <BreakdownLine label="Risk multiplier" value={score ? `${score.riskMultiplier}x` : 'Placeholder'} description="Reserved for future risk-pick scoring. Current mock data keeps the multiplier neutral." />
              <BreakdownLine label="Underdog bonus" value={score?.underdogBonus ?? 'Placeholder'} description="Reserved for future underdog rules after product validation." />
              <div className="p-5 bg-main text-inv flex items-center justify-between uppercase">
                <div>
                  <div className="font-black text-xs tracking-widest">Total earned</div>
                  <div className="font-bold text-[10px] opacity-80">{score?.scoringVersion ?? 'Awaiting final result'}</div>
                </div>
                <div className="font-black text-4xl">{score?.total ?? 0} PTS</div>
              </div>
            </div>
          </Panel>

          <div className="flex flex-col gap-4">
            <Panel title="Match Context">
              <div className="p-4 bg-card flex flex-col gap-3 font-bold text-sm">
                <div className="flex justify-between border-b-2 border-line pb-2"><span>Match</span><span className="font-black text-right">{homeTeam.name} vs {awayTeam.name}</span></div>
                <div className="flex justify-between border-b-2 border-line pb-2"><span>Kickoff</span><span className="font-black text-right">{formatDate(match.kickoffAt)}</span></div>
                <div className="flex justify-between border-b-2 border-line pb-2"><span>Lock time</span><span className="font-black text-right">{formatDate(match.lockAt)}</span></div>
                <div className="flex justify-between border-b-2 border-line pb-2"><span>Status</span><span className="font-black uppercase">{match.status}</span></div>
                <div className="flex justify-between"><span>Risk pick</span><span className="font-black uppercase">{prediction.isRiskPick ? 'Yes' : 'No'}</span></div>
              </div>
            </Panel>

            <Panel title="Actions">
              <div className="p-4 bg-card flex flex-col gap-3">
                <Link to="/my-predictions" className="bg-card hover:bg-muted text-main font-black uppercase py-3 px-4 border-2 border-main shadow-[3px_3px_0_var(--color-shadow)] flex items-center justify-center gap-2 text-xs"><ArrowLeft size={16} /> My Predictions</Link>
                <Link to={`/matches/${match.id}`} className="bg-c2 text-inv font-black uppercase py-3 px-4 border-2 border-main shadow-[3px_3px_0_var(--color-shadow)] flex items-center justify-center gap-2 text-xs"><CheckCircle2 size={16} /> Match Detail</Link>
              </div>
            </Panel>

            <div className="border-4 border-main bg-c1 p-4 shadow-[4px_4px_0_var(--color-shadow)] font-black uppercase text-xs leading-relaxed">
              This is a skill-based scoring view. No betting odds, wagers, or cash stake mechanics are used in this frontend flow.
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
