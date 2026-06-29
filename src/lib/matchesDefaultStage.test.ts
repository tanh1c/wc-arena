import assert from 'node:assert/strict';
import test from 'node:test';

import { getDefaultStageFilter } from './matchesDefaultStage';

type MatchInput = Parameters<typeof getDefaultStageFilter>[0][number];

function match(input: Partial<MatchInput> = {}): MatchInput {
  return {
    stage: input.stage ?? 'group',
    status: input.status ?? 'finished',
    lock_at: input.lock_at ?? '2026-06-01T00:00:00Z',
  };
}

const now = new Date('2026-06-30T12:00:00Z');

test('defaults to the active knockout stage when a live match exists', () => {
  assert.equal(
    getDefaultStageFilter([
      match({ stage: 'group', status: 'finished' }),
      match({ stage: 'round32', status: 'live' }),
      match({ stage: 'round16', status: 'scheduled', lock_at: '2026-07-04T12:00:00Z' }),
    ], now),
    'round32',
  );
});

test('defaults to the next upcoming stage after group stage finishes', () => {
  assert.equal(
    getDefaultStageFilter([
      match({ stage: 'group', status: 'finished' }),
      match({ stage: 'round32', status: 'open', lock_at: '2026-06-30T20:00:00Z' }),
    ], now),
    'round32',
  );
});

test('falls back to the latest finished stage when there are no upcoming matches', () => {
  assert.equal(
    getDefaultStageFilter([
      match({ stage: 'group', status: 'finished' }),
      match({ stage: 'round32', status: 'finished' }),
    ], now),
    'round32',
  );
});
