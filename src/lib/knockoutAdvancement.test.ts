import assert from 'node:assert/strict';
import test from 'node:test';

import { buildKnockoutTeamProjection } from './knockoutAdvancement';
import type { MatchRow } from '../services/matches';
import type { TeamRow } from '../services/teams';

function team(id: string, groupCode: string | null = null): TeamRow {
  return {
    id,
    name: id,
    short_name: id,
    country_code: id,
    fifa_rank: null,
    group_code: groupCode,
  };
}

function match(input: Partial<MatchRow> & Pick<MatchRow, 'id' | 'home_team_id' | 'away_team_id'>): MatchRow {
  return {
    id: input.id,
    home_team_id: input.home_team_id,
    away_team_id: input.away_team_id,
    kickoff_at: input.kickoff_at ?? '2026-06-01T00:00:00+00:00',
    lock_at: input.lock_at ?? '2026-06-01T00:00:00+00:00',
    status: input.status ?? 'finished',
    stage: input.stage ?? 'group',
    group_code: input.group_code ?? null,
    matchday: input.matchday ?? null,
    stadium: input.stadium ?? 'Test Stadium',
    city: input.city ?? 'Test City',
    home_score: input.home_score ?? null,
    away_score: input.away_score ?? null,
    result_updated_at: input.result_updated_at ?? null,
    espn_event_id: null,
    espn_competition_id: null,
    espn_state: null,
    espn_status: null,
    espn_status_detail: null,
    espn_display_clock: null,
    espn_home_win_pct: null,
    espn_draw_pct: null,
    espn_away_win_pct: null,
    espn_prediction_updated_at: null,
    espn_home_logo: null,
    espn_away_logo: null,
    espn_home_record: null,
    espn_away_record: null,
    espn_home_color: null,
    espn_away_color: null,
    espn_home_winner: input.espn_home_winner ?? null,
    espn_away_winner: input.espn_away_winner ?? null,
    espn_attendance: null,
    espn_play_by_play_available: null,
    espn_summary_updated_at: null,
    espn_updated_at: null,
    espn_stats_normalized_at: null,
    espn_summary: null,
  };
}

function teamMap(teams: TeamRow[]) {
  return new Map(teams.map((value) => [value.id, value]));
}

test('resolves group winner and runner-up slots from current standings', () => {
  const teams = [team('A1', 'A'), team('A2', 'A'), team('B1', 'B'), team('B2', 'B'), team('1A'), team('2B')];
  const matches = [
    match({ id: 'a-final', home_team_id: 'A1', away_team_id: 'A2', group_code: 'A', home_score: 2, away_score: 0 }),
    match({ id: 'b-final', home_team_id: 'B1', away_team_id: 'B2', group_code: 'B', home_score: 0, away_score: 1 }),
    match({ id: 'wc2026-073', stage: 'round32', home_team_id: '1A', away_team_id: '2B', status: 'scheduled' }),
  ];

  const projection = buildKnockoutTeamProjection(matches, teamMap(teams));

  assert.equal(projection.get('wc2026-073')?.home.teamId, 'A1');
  assert.equal(projection.get('wc2026-073')?.away.teamId, 'B1');
});

test('resolves best unused third-place team from allowed groups', () => {
  const teams = [team('A1', 'A'), team('A2', 'A'), team('A3', 'A'), team('B1', 'B'), team('B2', 'B'), team('B3', 'B'), team('3A/B')];
  const matches = [
    match({ id: 'a-1', home_team_id: 'A1', away_team_id: 'A3', group_code: 'A', home_score: 1, away_score: 0 }),
    match({ id: 'a-2', home_team_id: 'A2', away_team_id: 'A3', group_code: 'A', home_score: 1, away_score: 0 }),
    match({ id: 'b-1', home_team_id: 'B1', away_team_id: 'B3', group_code: 'B', home_score: 1, away_score: 0 }),
    match({ id: 'wc2026-074', stage: 'round32', home_team_id: 'A1', away_team_id: '3A/B', status: 'scheduled' }),
  ];

  const projection = buildKnockoutTeamProjection(matches, teamMap(teams));

  assert.equal(projection.get('wc2026-074')?.away.teamId, 'B3');
});

test('resolves knockout winner and loser slots from ESPN winner flags', () => {
  const teams = [team('POR'), team('COL'), team('W73'), team('L73')];
  const matches = [
    match({ id: 'wc2026-073', stage: 'round32', home_team_id: 'POR', away_team_id: 'COL', home_score: 1, away_score: 1, espn_away_winner: true }),
    match({ id: 'wc2026-089', stage: 'round16', home_team_id: 'W73', away_team_id: 'L73', status: 'scheduled' }),
  ];

  const projection = buildKnockoutTeamProjection(matches, teamMap(teams));

  assert.equal(projection.get('wc2026-089')?.home.teamId, 'COL');
  assert.equal(projection.get('wc2026-089')?.away.teamId, 'POR');
});

test('resolves knockout winner from score when ESPN winner flags are absent', () => {
  const teams = [team('POR'), team('COL'), team('W73')];
  const matches = [
    match({ id: 'wc2026-073', stage: 'round32', home_team_id: 'POR', away_team_id: 'COL', home_score: 2, away_score: 0 }),
    match({ id: 'wc2026-089', stage: 'round16', home_team_id: 'W73', away_team_id: 'COL', status: 'scheduled' }),
  ];

  const projection = buildKnockoutTeamProjection(matches, teamMap(teams));

  assert.equal(projection.get('wc2026-089')?.home.teamId, 'POR');
});

test('keeps unfinished source slots unresolved', () => {
  const teams = [team('POR'), team('COL'), team('W73')];
  const matches = [
    match({ id: 'wc2026-073', stage: 'round32', home_team_id: 'POR', away_team_id: 'COL', status: 'scheduled', home_score: null, away_score: null }),
    match({ id: 'wc2026-089', stage: 'round16', home_team_id: 'W73', away_team_id: 'COL', status: 'scheduled' }),
  ];

  const projection = buildKnockoutTeamProjection(matches, teamMap(teams));

  assert.equal(projection.get('wc2026-089')?.home.teamId, 'W73');
  assert.equal(projection.get('wc2026-089')?.home.projected, true);
});
