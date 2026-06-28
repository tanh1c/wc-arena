import assert from 'node:assert/strict';
import test from 'node:test';

import { buildConfirmedBracketAdvancement, type BracketMatchRow, type BracketTeamRow } from './bracketAdvancement.ts';

function team(id: string, groupCode: string | null = null): BracketTeamRow {
  return { id, name: id, short_name: id, country_code: id, group_code: groupCode };
}

function match(input: Partial<BracketMatchRow> & Pick<BracketMatchRow, 'id' | 'home_team_id' | 'away_team_id'>): BracketMatchRow {
  return {
    id: input.id,
    home_team_id: input.home_team_id,
    away_team_id: input.away_team_id,
    stage: input.stage ?? 'group',
    group_code: input.group_code ?? null,
    status: input.status ?? 'finished',
    home_score: input.home_score ?? null,
    away_score: input.away_score ?? null,
    espn_home_winner: input.espn_home_winner ?? null,
    espn_away_winner: input.espn_away_winner ?? null,
  };
}

function teamMap(teams: BracketTeamRow[]) {
  return new Map(teams.map((value) => [value.id, value]));
}

test('advances winner and runner-up after source groups are complete', () => {
  const teams = [team('A1', 'A'), team('A2', 'A'), team('B1', 'B'), team('B2', 'B'), team('1A'), team('2B')];
  const matches = [
    match({ id: 'a-final', home_team_id: 'A1', away_team_id: 'A2', group_code: 'A', home_score: 2, away_score: 0 }),
    match({ id: 'b-final', home_team_id: 'B1', away_team_id: 'B2', group_code: 'B', home_score: 0, away_score: 1 }),
    match({ id: 'wc2026-073', stage: 'round32', home_team_id: '1A', away_team_id: '2B', status: 'scheduled' }),
  ];

  assert.deepEqual(buildConfirmedBracketAdvancement(matches, teamMap(teams)), [
    { matchId: 'wc2026-073', home_team_id: 'A1', away_team_id: 'B1' },
  ]);
});

test('does not advance group slots until every match in that group is finished', () => {
  const teams = [team('A1', 'A'), team('A2', 'A'), team('A3', 'A'), team('1A')];
  const matches = [
    match({ id: 'a-1', home_team_id: 'A1', away_team_id: 'A2', group_code: 'A', home_score: 2, away_score: 0 }),
    match({ id: 'a-2', home_team_id: 'A1', away_team_id: 'A3', group_code: 'A', status: 'scheduled' }),
    match({ id: 'wc2026-073', stage: 'round32', home_team_id: '1A', away_team_id: 'A2', status: 'scheduled' }),
  ];

  assert.deepEqual(buildConfirmedBracketAdvancement(matches, teamMap(teams)), []);
});

test('advances third-place slots only after all group matches are complete', () => {
  const teams = [team('A1', 'A'), team('A2', 'A'), team('A3', 'A'), team('B1', 'B'), team('B2', 'B'), team('B3', 'B'), team('3A/B')];
  const matches = [
    match({ id: 'a-1', home_team_id: 'A1', away_team_id: 'A3', group_code: 'A', home_score: 1, away_score: 0 }),
    match({ id: 'a-2', home_team_id: 'A2', away_team_id: 'A3', group_code: 'A', home_score: 1, away_score: 0 }),
    match({ id: 'b-1', home_team_id: 'B1', away_team_id: 'B3', group_code: 'B', home_score: 1, away_score: 0 }),
    match({ id: 'b-2', home_team_id: 'B2', away_team_id: 'B3', group_code: 'B', home_score: 0, away_score: 0 }),
    match({ id: 'wc2026-074', stage: 'round32', home_team_id: 'A1', away_team_id: '3A/B', status: 'scheduled' }),
  ];

  assert.deepEqual(buildConfirmedBracketAdvancement(matches, teamMap(teams)), [
    { matchId: 'wc2026-074', away_team_id: 'B3' },
  ]);
});

test('advances knockout winner and loser from finished source matches', () => {
  const teams = [team('POR'), team('COL'), team('W73'), team('L73')];
  const matches = [
    match({ id: 'wc2026-073', stage: 'round32', home_team_id: 'POR', away_team_id: 'COL', home_score: 1, away_score: 1, espn_away_winner: true }),
    match({ id: 'wc2026-089', stage: 'round16', home_team_id: 'W73', away_team_id: 'L73', status: 'scheduled' }),
  ];

  assert.deepEqual(buildConfirmedBracketAdvancement(matches, teamMap(teams)), [
    { matchId: 'wc2026-089', home_team_id: 'COL', away_team_id: 'POR' },
  ]);
});
