import assert from 'node:assert/strict';
import test from 'node:test';

import { mapPredictionEfficiencyRow, mapPredictionLeaderboardRow, type PredictionEfficiencyLeaderboardRow, type PredictionLeaderboardRow } from './leaderboardMapper';

test('maps prediction leaderboard rows into leaderboard entries', () => {
  const entry = mapPredictionLeaderboardRow({
    rank: 1,
    user_id: 'user-1',
    stage: 'round32',
    metric: 'total',
    prediction_points: 42,
    predicted_matches: 6,
    average_points: 7,
    exact_scores: 3,
    accuracy: 67,
    streak: 2,
    last_scored_at: '2026-07-01T09:00:00Z',
    username: 'chan',
    display_name: 'Chan Đê',
    avatar_url: null,
    avatar_bg_color: '#E4FF00',
    country_code: 'VN',
  } satisfies PredictionLeaderboardRow);

  assert.equal(entry.points, 42);
  assert.equal(entry.prediction_points, 42);
  assert.equal(entry.stage, 'round32');
  assert.equal(entry.metric, 'total');
  assert.equal(entry.profiles?.display_name, 'Chan Đê');
});

test('maps prediction efficiency rows into leaderboard entries', () => {
  const entry = mapPredictionEfficiencyRow({
    rank: 2,
    user_id: 'user-1',
    prediction_points: 60,
    predicted_matches: 10,
    average_points: 6,
    exact_scores: 4,
    accuracy: 70,
    streak: 3,
    last_scored_at: '2026-07-01T09:00:00Z',
    username: 'chan',
    display_name: 'Chan Đê',
    avatar_url: null,
    avatar_bg_color: '#E4FF00',
    country_code: 'VN',
  } satisfies PredictionEfficiencyLeaderboardRow);

  assert.equal(entry.points, 60);
  assert.equal(entry.prediction_points, 60);
  assert.equal(entry.average_points, 6);
  assert.equal(entry.predicted_matches, 10);
  assert.equal(entry.stage, 'all');
  assert.equal(entry.metric, 'efficiency');
  assert.equal(entry.profiles?.display_name, 'Chan Đê');
});
