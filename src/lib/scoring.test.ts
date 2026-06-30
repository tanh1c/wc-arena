import assert from 'node:assert/strict';
import test from 'node:test';

import { getPredictionOutcome } from './scoring';
import type { Prediction } from '../types/domain';

function prediction(overrides: Partial<Prediction> = {}): Prediction {
  return {
    id: 'prediction-1',
    userId: 'user-1',
    matchId: 'match-1',
    predictionType: 'exact_score',
    homeScore: 2,
    awayScore: 3,
    predictedOutcome: 'away',
    confidence: 100,
    isRiskPick: false,
    createdAt: '2026-06-01T00:00:00Z',
    updatedAt: '2026-06-01T00:00:00Z',
    status: 'scored',
    revision: 1,
    ...overrides,
  };
}

test('scores knockout tied result by ESPN penalty winner', () => {
  assert.equal(
    getPredictionOutcome(prediction(), { homeScore: 1, awayScore: 1, stage: 'round32', espnHomeWinner: false, espnAwayWinner: true }),
    'correct',
  );
});

test('keeps exact score based on the displayed match scoreline', () => {
  assert.equal(
    getPredictionOutcome(prediction({ homeScore: 1, awayScore: 1, predictedOutcome: 'away' }), { homeScore: 1, awayScore: 1, stage: 'round32', espnHomeWinner: false, espnAwayWinner: true }),
    'exact',
  );
});
