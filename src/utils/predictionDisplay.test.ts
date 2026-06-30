import assert from 'node:assert/strict';
import test from 'node:test';

import { formatActualResult, getPenaltyScoreLabel, getPenaltyWinnerLabel } from './predictionDisplay';

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

test('keeps normal score labels unchanged', () => {
  assert.equal(formatActualResult({ home_score: 2, away_score: 0, espn_home_winner: true }, 'FRA', 'SWE', ' - '), '2 - 0');
  assert.equal(formatActualResult({ home_score: null, away_score: null }, 'FRA', 'SWE'), '—');
});
