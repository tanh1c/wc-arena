import assert from 'node:assert/strict';
import test from 'node:test';

import { formatActualResult, getPenaltyWinnerLabel } from './predictionDisplay';

test('formats penalty winner for tied knockout results', () => {
  const match = { home_score: 1, away_score: 1, espn_home_winner: false, espn_away_winner: true };

  assert.equal(getPenaltyWinnerLabel(match, 'NED', 'MAR'), 'MAR wins pens');
  assert.equal(formatActualResult(match, 'NED', 'MAR'), '1-1 (MAR wins pens)');
});

test('keeps normal score labels unchanged', () => {
  assert.equal(formatActualResult({ home_score: 2, away_score: 0, espn_home_winner: true }, 'FRA', 'SWE', ' - '), '2 - 0');
  assert.equal(formatActualResult({ home_score: null, away_score: null }, 'FRA', 'SWE'), '—');
});
