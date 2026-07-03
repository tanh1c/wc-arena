import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('league pools use spendable coins instead of rank points', () => {
  const leagueDetailSource = readFileSync('src/pages/LeagueDetail.tsx', 'utf8');
  const leagueEventsSource = readFileSync('src/services/leagueEvents.ts', 'utf8');

  assert.match(leagueEventsSource, /getCurrentUserCoinBalance/);
  assert.doesNotMatch(leagueDetailSource, /availablePoints/);
  assert.match(leagueDetailSource, /availableCoins/);
  assert.match(leagueDetailSource, /ui\.availableCoins/);
  assert.match(leagueDetailSource, /ui\.stakeCoins/);
  assert.match(leagueDetailSource, /profile-coins-changed/);
  assert.doesNotMatch(leagueDetailSource, /profile-points-changed[\s\S]*enterLeagueEvent/);
});
