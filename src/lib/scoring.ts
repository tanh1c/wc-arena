import type { MatchOutcome, MatchResult, Prediction, ScoreBreakdown } from '../types/domain';

export type ScoringOptions = {
  streakBonus?: number;
  riskMultiplier?: number;
  underdogBonus?: number;
  calculatedAt?: string;
};

export function getOutcome(score: MatchResult): MatchOutcome {
  if (score.homeScore > score.awayScore) return 'home';
  if (score.homeScore < score.awayScore) return 'away';
  return 'draw';
}

export function getPredictionOutcome(prediction: Pick<Prediction, 'homeScore' | 'awayScore'>, matchResult: MatchResult): 'exact' | 'correct' | 'missed' {
  const exact = prediction.homeScore === matchResult.homeScore && prediction.awayScore === matchResult.awayScore;
  if (exact) return 'exact';

  return getOutcome(prediction) === getOutcome(matchResult) ? 'correct' : 'missed';
}

export function calculatePredictionScore(prediction: Prediction, matchResult: MatchResult, options: ScoringOptions = {}): ScoreBreakdown {
  const outcome = getPredictionOutcome(prediction, matchResult);
  const exactScore = outcome === 'exact' ? 3 : 0;
  const correctOutcome = outcome === 'correct' ? 1 : 0;
  const streakBonus = options.streakBonus ?? 0;
  const riskMultiplier = options.riskMultiplier ?? 1;
  const underdogBonus = options.underdogBonus ?? 0;
  const baseTotal = exactScore + correctOutcome + streakBonus + underdogBonus;

  return {
    predictionId: prediction.id,
    exactScore,
    correctOutcome,
    streakBonus,
    riskMultiplier,
    underdogBonus,
    total: baseTotal * riskMultiplier,
    scoringVersion: 'mvp-2026-06-15',
    calculatedAt: options.calculatedAt ?? new Date().toISOString(),
  };
}

export function calculateAccuracy(items: Array<{ prediction: Prediction; result?: MatchResult }>): number {
  const scored = items.filter((item) => item.result);
  if (scored.length === 0) return 0;

  const correct = scored.filter((item) => item.result && getPredictionOutcome(item.prediction, item.result) !== 'missed').length;
  return Math.round((correct / scored.length) * 100);
}

export function calculateStreak(items: Array<{ prediction: Prediction; result?: MatchResult }>): number {
  let streak = 0;

  for (const item of [...items].reverse()) {
    if (!item.result) continue;
    if (getPredictionOutcome(item.prediction, item.result) === 'missed') break;
    streak += 1;
  }

  return streak;
}
