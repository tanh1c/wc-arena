import type { MatchOutcome, Prediction } from '../types/domain';

type MatchResultLike = {
  home_score?: number | null;
  away_score?: number | null;
  espn_home_winner?: boolean | null;
  espn_away_winner?: boolean | null;
};

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

export function getPenaltyWinnerLabel(match: MatchResultLike, homeLabel: string, awayLabel: string) {
  if (typeof match.home_score !== 'number' || typeof match.away_score !== 'number') return null;
  if (match.home_score !== match.away_score) return null;
  if (match.espn_home_winner === true) return `${homeLabel} wins pens`;
  if (match.espn_away_winner === true) return `${awayLabel} wins pens`;
  return null;
}

export function formatActualResult(match: MatchResultLike, homeLabel: string, awayLabel: string, separator = '-') {
  if (typeof match.home_score !== 'number' || typeof match.away_score !== 'number') return '—';
  const score = `${match.home_score}${separator}${match.away_score}`;
  const winnerLabel = getPenaltyWinnerLabel(match, homeLabel, awayLabel);
  return winnerLabel ? `${score} (${winnerLabel})` : score;
}
