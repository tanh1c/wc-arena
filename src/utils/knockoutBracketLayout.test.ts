import assert from 'node:assert/strict';
import test from 'node:test';

import { buildDependencyBracketColumns } from './knockoutBracketLayout';

test('groups source matches before the next match they feed', () => {
  const columns = buildDependencyBracketColumns([
    { id: 'match-081', stage: 'round32', home_team_id: '1D', away_team_id: '3B/E/F/I/J' },
    { id: 'match-082', stage: 'round32', home_team_id: '1G', away_team_id: '3A/E/H/I/J' },
    { id: 'match-094', stage: 'round16', home_team_id: 'W81', away_team_id: 'W82' },
  ]);

  assert.deepEqual(columns.map((column) => column.map((match) => match.id)), [
    ['match-081', 'match-082'],
    ['match-094'],
  ]);
});
