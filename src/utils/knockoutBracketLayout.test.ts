import assert from 'node:assert/strict';
import test from 'node:test';

import { buildDependencyBracketColumns, splitDependencyBracketSide } from './knockoutBracketLayout';

const matches = [
  { id: 'match-073', stage: 'round32', home_team_id: '2A', away_team_id: '2B' },
  { id: 'match-074', stage: 'round32', home_team_id: '1E', away_team_id: '3A/B/C/D/F' },
  { id: 'match-075', stage: 'round32', home_team_id: '1A', away_team_id: '3C/E/F/H/I' },
  { id: 'match-076', stage: 'round32', home_team_id: '1L', away_team_id: '3E/H/I/J/K' },
  { id: 'match-077', stage: 'round32', home_team_id: '1I', away_team_id: '3C/D/F/G/H' },
  { id: 'match-078', stage: 'round32', home_team_id: '2E', away_team_id: '2I' },
  { id: 'match-079', stage: 'round32', home_team_id: '1F', away_team_id: '2C' },
  { id: 'match-080', stage: 'round32', home_team_id: '1C', away_team_id: '3D/E/F/I/J' },
  { id: 'match-081', stage: 'round32', home_team_id: '1D', away_team_id: '3B/E/F/I/J' },
  { id: 'match-082', stage: 'round32', home_team_id: '1G', away_team_id: '3A/E/H/I/J' },
  { id: 'match-083', stage: 'round32', home_team_id: '2K', away_team_id: '2L' },
  { id: 'match-084', stage: 'round32', home_team_id: '1H', away_team_id: '2J' },
  { id: 'match-085', stage: 'round32', home_team_id: '1B', away_team_id: '3E/F/G/I/J' },
  { id: 'match-086', stage: 'round32', home_team_id: '1J', away_team_id: '2H' },
  { id: 'match-087', stage: 'round32', home_team_id: '1K', away_team_id: '3D/E/I/J/L' },
  { id: 'match-088', stage: 'round32', home_team_id: '2D', away_team_id: '2G' },
  { id: 'match-089', stage: 'round16', home_team_id: 'W74', away_team_id: 'W77' },
  { id: 'match-090', stage: 'round16', home_team_id: 'W73', away_team_id: 'W75' },
  { id: 'match-091', stage: 'round16', home_team_id: 'W76', away_team_id: 'W78' },
  { id: 'match-092', stage: 'round16', home_team_id: 'W79', away_team_id: 'W80' },
  { id: 'match-093', stage: 'round16', home_team_id: 'W83', away_team_id: 'W84' },
  { id: 'match-094', stage: 'round16', home_team_id: 'W81', away_team_id: 'W82' },
  { id: 'match-095', stage: 'round16', home_team_id: 'W86', away_team_id: 'W88' },
  { id: 'match-096', stage: 'round16', home_team_id: 'W85', away_team_id: 'W87' },
  { id: 'match-097', stage: 'quarter', home_team_id: 'W89', away_team_id: 'W90' },
  { id: 'match-098', stage: 'quarter', home_team_id: 'W93', away_team_id: 'W94' },
  { id: 'match-099', stage: 'quarter', home_team_id: 'W91', away_team_id: 'W92' },
  { id: 'match-100', stage: 'quarter', home_team_id: 'W95', away_team_id: 'W96' },
];

test('groups source matches before the next match they feed', () => {
  const columns = buildDependencyBracketColumns(matches.filter((match) => ['match-081', 'match-082', 'match-094'].includes(match.id)));

  assert.deepEqual(columns.map((column) => column.map((match) => match.id)), [
    ['match-081', 'match-082'],
    ['match-094'],
  ]);
});

test('aligns left knockout lane by adjacent sources', () => {
  assert.deepEqual(splitDependencyBracketSide(matches.filter((match) => match.stage === 'round32'), 'left', matches).map((match) => match.id), [
    'match-073',
    'match-075',
    'match-074',
    'match-077',
    'match-076',
    'match-078',
    'match-079',
    'match-080',
  ]);
  assert.deepEqual(splitDependencyBracketSide(matches.filter((match) => match.stage === 'round16'), 'left', matches).map((match) => match.id), ['match-090', 'match-089', 'match-091', 'match-092']);
});

test('keeps right-side knockout lane ordered by source matches', () => {
  assert.deepEqual(splitDependencyBracketSide(matches.filter((match) => match.stage === 'round32'), 'right', matches).map((match) => match.id), [
    'match-081',
    'match-082',
    'match-083',
    'match-084',
    'match-085',
    'match-087',
    'match-086',
    'match-088',
  ]);
  assert.deepEqual(splitDependencyBracketSide(matches.filter((match) => match.stage === 'round16'), 'right', matches).map((match) => match.id), ['match-094', 'match-093', 'match-096', 'match-095']);
});
