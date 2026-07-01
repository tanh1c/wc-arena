import assert from 'node:assert/strict';
import test from 'node:test';

import { formatActualResult, formatPredictionRowPick, getPenaltyScoreLabel, getPenaltyWinnerLabel } from './predictionDisplay';

test('formats prediction rows for match cards', () => {
  assert.equal(formatPredictionRowPick({ prediction_type: 'exact_score', home_score: 2, away_score: 1, predicted_outcome: 'home' }, 'BRA', 'ARG'), '2-1');
  assert.equal(formatPredictionRowPick({ prediction_type: 'outcome_only', home_score: null, away_score: null, predicted_outcome: 'draw' }, 'BRA', 'ARG'), 'DRAW');
});

test('formats penalty winner for tied knockout results', () => {
  const match = { home_score: 1, away_score: 1, espn_home_winner: false, espn_away_winner: true };

  assert.equal(getPenaltyWinnerLabel(match, 'NED', 'MAR'), 'MAR wins pens');
  assert.equal(formatActualResult(match, 'NED', 'MAR'), '1-1 (MAR wins pens)');
});

test('formats penalty shootout scores compactly', () => {
  const match = {
    home_score: 1,
    away_score: 1,
    espn_home_winner: false,
    espn_away_winner: true,
    espn_home_shootout_score: 2,
    espn_away_shootout_score: 3,
  };

  assert.equal(getPenaltyScoreLabel(match), 'PEN 2-3');
  assert.equal(formatActualResult(match, 'NED', 'MAR'), '1-1 (PEN 2-3)');
  assert.equal(formatActualResult(match, 'NED', 'MAR', ' - '), '1 - 1 (PEN 2 - 3)');
});

test('does not show placeholder penalty shootout scores', () => {
  const match = {
    home_score: 0,
    away_score: 0,
    espn_home_winner: null,
    espn_away_winner: null,
    espn_home_shootout_score: 0,
    espn_away_shootout_score: 0,
  };

  assert.equal(getPenaltyScoreLabel(match), null);
  assert.equal(formatActualResult(match, 'GER', 'PAR'), '0-0');
});

test('keeps normal score labels unchanged', () => {
  assert.equal(formatActualResult({ home_score: 2, away_score: 0, espn_home_winner: true }, 'FRA', 'SWE', ' - '), '2 - 0');
  assert.equal(formatActualResult({ home_score: null, away_score: null }, 'FRA', 'SWE'), '—');
});
