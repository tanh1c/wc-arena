import assert from 'node:assert/strict';
import test from 'node:test';

import { getScoreboardNoteShootoutScore, getShootoutScore } from './espnShootout';

test('uses summary shootout score when ESPN provides one', () => {
  const summary = {
    boxscore: {
      form: [{ events: [{ homeShootoutScore: '2', awayShootoutScore: '3' }] }],
    },
  };

  assert.deepEqual(getShootoutScore(summary, { home: 3, away: 4 }), { home: 2, away: 3 });
});

test('falls back to scoreboard penalty note when summary only has placeholders', () => {
  const summary = {
    boxscore: {
      form: [{ events: [{ homeShootoutScore: '0', awayShootoutScore: '0' }] }],
    },
  };

  assert.deepEqual(getShootoutScore(summary, { home: 3, away: 4 }), { home: 3, away: 4 });
});

test('maps away-winner penalty note back to home-away score order', () => {
  assert.deepEqual(
    getScoreboardNoteShootoutScore({
      homeWinner: false,
      awayWinner: true,
      notes: [{ text: 'Paraguay advance 4-3 on penalties' }],
    }),
    { home: 3, away: 4 },
  );
});

test('maps home-winner penalty note back to home-away score order', () => {
  assert.deepEqual(
    getScoreboardNoteShootoutScore({
      homeWinner: true,
      awayWinner: false,
      notes: [{ text: 'Netherlands advance 5-4 on penalties' }],
    }),
    { home: 5, away: 4 },
  );
});
