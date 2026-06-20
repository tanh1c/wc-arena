import type { MatchOutcome, Prediction } from '../types/domain';

export function formatOutcomeLabel(outcome: MatchOutcome, homeLabel: string, awayLabel: string) {
  if (outcome === 'home') return `${homeLabel} WIN`;
  if (outcome === 'away') return `${awayLabel} WIN`;
  return 'DRAW';
}

export function formatPredictionPick(prediction: Prediction, homeLabel: string, awayLabel: string) {
  if (prediction.predictionType === 'exact_score' && typeof prediction.homeScore === 'number' && typeof prediction.awayScore === 'number') {
    return `${homeLabel} ${prediction.homeScore}-${prediction.awayScore} ${awayLabel}`;
  }

  return formatOutcomeLabel(prediction.predictedOutcome, homeLabel, awayLabel);
}
