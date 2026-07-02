import type { MatchOutcome, Prediction } from '../types/domain';

type MatchResultLike = {
  home_score?: number | null;
  away_score?: number | null;
  espn_home_winner?: boolean | null;
  espn_away_winner?: boolean | null;
  espn_home_shootout_score?: number | null;
  espn_away_shootout_score?: number | null;
};

type PredictionRowLike = {
  prediction_type: string;
  home_score?: number | null;
  away_score?: number | null;
  predicted_outcome: string;
};

type FixtureMetadataChip =
  | { kind: 'predictionState'; labelKey: 'ui.predicted' }
  | { kind: 'predictionState'; labelKey: 'ui.notPredicted' }
  | { kind: 'predictionPick'; label: string }
  | { kind: 'penalty'; label: string }
  | { kind: 'penaltyWinner'; label: string }
  | { kind: 'status'; labelKey: 'ui.live' | 'ui.completed' };

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

export function formatPredictionRowPick(prediction: PredictionRowLike, homeLabel: string, awayLabel: string) {
  if (prediction.prediction_type === 'exact_score' && typeof prediction.home_score === 'number' && typeof prediction.away_score === 'number') {
    return `${prediction.home_score}-${prediction.away_score}`;
  }

  return formatOutcomeLabel(prediction.predicted_outcome as MatchOutcome, homeLabel, awayLabel);
}

export function getShootoutScoreLabel(match: MatchResultLike, separator = '-') {
  if (typeof match.espn_home_shootout_score !== 'number' || typeof match.espn_away_shootout_score !== 'number') return null;
  if (match.espn_home_shootout_score === 0 && match.espn_away_shootout_score === 0) return null;
  return `${match.espn_home_shootout_score}${separator}${match.espn_away_shootout_score}`;
}

export function getPenaltyWinnerLabel(match: MatchResultLike, homeLabel: string, awayLabel: string) {
  if (typeof match.home_score !== 'number' || typeof match.away_score !== 'number') return null;
  if (match.home_score !== match.away_score) return null;
  if (match.espn_home_winner === true) return `${homeLabel} wins pens`;
  if (match.espn_away_winner === true) return `${awayLabel} wins pens`;
  return null;
}

export function getPenaltyScoreLabel(match: MatchResultLike, separator = '-') {
  if (typeof match.home_score !== 'number' || typeof match.away_score !== 'number') return null;
  if (match.home_score !== match.away_score) return null;
  const shootoutScore = getShootoutScoreLabel(match, separator);
  return shootoutScore ? `PEN ${shootoutScore}` : null;
}

export function formatActualResult(match: MatchResultLike, homeLabel: string, awayLabel: string, separator = '-') {
  if (typeof match.home_score !== 'number' || typeof match.away_score !== 'number') return '—';
  const score = `${match.home_score}${separator}${match.away_score}`;
  const penaltyScore = getPenaltyScoreLabel(match, separator);
  const winnerLabel = getPenaltyWinnerLabel(match, homeLabel, awayLabel);
  if (penaltyScore) return `${score} (${penaltyScore})`;
  return winnerLabel ? `${score} (${winnerLabel})` : score;
}

export function formatFixtureMetadata(match: MatchResultLike, prediction: PredictionRowLike | undefined, homeLabel: string, awayLabel: string, status: string): FixtureMetadataChip[] {
  const chips: FixtureMetadataChip[] = [prediction ? { kind: 'predictionState', labelKey: 'ui.predicted' } : { kind: 'predictionState', labelKey: 'ui.notPredicted' }];

  if (prediction) chips.push({ kind: 'predictionPick', label: formatPredictionRowPick(prediction, homeLabel, awayLabel) });

  const penaltyScore = getPenaltyScoreLabel(match);
  const penaltyWinner = getPenaltyWinnerLabel(match, homeLabel, awayLabel);
  if (penaltyScore) chips.push({ kind: 'penalty', label: penaltyScore });
  else if (penaltyWinner) chips.push({ kind: 'penaltyWinner', label: penaltyWinner });

  if (status === 'live') chips.push({ kind: 'status', labelKey: 'ui.live' });
  if (status === 'finished') chips.push({ kind: 'status', labelKey: 'ui.completed' });

  return chips;
}
