import assert from 'node:assert/strict';
import test from 'node:test';

import { buildDependencyBracketColumns, getBracketSourceNumbers, splitDependencyBracketSide } from './knockoutBracketLayout';

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
  { id: 'match-101', stage: 'semi', home_team_id: 'W97', away_team_id: 'W98' },
  { id: 'match-102', stage: 'semi', home_team_id: 'W99', away_team_id: 'W100' },
  { id: 'match-104', stage: 'final', home_team_id: 'W101', away_team_id: 'W102' },
];

test('groups source matches before the next match they feed', () => {
  const columns = buildDependencyBracketColumns(matches.filter((match) => ['match-081', 'match-082', 'match-094'].includes(match.id)));

  assert.deepEqual(columns.map((column) => column.map((match) => match.id)), [
    ['match-081', 'match-082'],
    ['match-094'],
  ]);
});

test('keeps final source branches together from root outward', () => {
  const split = (stage: string, side: 'left' | 'right') => splitDependencyBracketSide(matches.filter((match) => match.stage === stage), side, matches).map((match) => match.id);

  assert.deepEqual(split('semi', 'right'), ['match-101']);
  assert.deepEqual(split('quarter', 'right'), ['match-097', 'match-098']);
  assert.deepEqual(split('round16', 'right'), ['match-090', 'match-089', 'match-094', 'match-093']);
  assert.deepEqual(split('round32', 'right'), [
    'match-073',
    'match-075',
    'match-074',
    'match-077',
    'match-081',
    'match-082',
    'match-083',
    'match-084',
  ]);

  assert.deepEqual(split('semi', 'left'), ['match-102']);
  assert.deepEqual(split('quarter', 'left'), ['match-099', 'match-100']);
  assert.deepEqual(split('round16', 'left'), ['match-091', 'match-092', 'match-096', 'match-095']);
  assert.deepEqual(split('round32', 'left'), [
    'match-076',
    'match-078',
    'match-079',
    'match-080',
    'match-085',
    'match-087',
    'match-086',
    'match-088',
  ]);
});

test('matches knockout dependencies from the 2026 worldcup schedule json', () => {
  assert.deepEqual(
    Object.fromEntries(Array.from({ length: 16 }, (_, index) => {
      const matchNumber = index + 89;
      return [matchNumber, getBracketSourceNumbers(matchNumber)];
    })),
    {
      89: [74, 77],
      90: [73, 75],
      91: [76, 78],
      92: [79, 80],
      93: [83, 84],
      94: [81, 82],
      95: [86, 88],
      96: [85, 87],
      97: [89, 90],
      98: [93, 94],
      99: [91, 92],
      100: [95, 96],
      101: [97, 98],
      102: [99, 100],
      103: [],
      104: [101, 102],
    },
  );
});
